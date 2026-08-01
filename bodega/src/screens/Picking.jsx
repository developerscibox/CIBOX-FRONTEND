import { useEffect, useMemo, useRef, useState } from "react";
import { api, useLoad, usingMock, streamUrl } from "../api.js";
import { ORDERS_RES } from "../data.js";
import { clp } from "../theme.js";
import { StatusBadge } from "../ui.jsx";
import { useAuth } from "../auth.jsx";
import { imprimirTicketPicking, imprimirEtiquetasZona, imprimirEtiquetaDespacho, agruparItemsPorSector } from "../print.js";

// PICKING (relay etapa 3). Cola en vivo (SSE), claim atómico, avance PERSISTIDO en el
// backend (sobrevive recargas y lo continúa otro bodeguero), escaneo VINCULANTE (marcar
// a mano = override visible), flujo de FALTANTE/dañado, guía FEFO y cierre de EMPAQUE
// (nº de bultos) antes de marcar listo.

const normItems = (o) =>
  (o.items || []).map((it) => ({
    product_id: String(it.product_id ?? it._id ?? it.name),
    name: it.name,
    qty: it.quantity ?? it.qty ?? 1,
    cajas: it.cajas ?? null, // las etiquetas de zona hablan en cajas (como el monitor)
    barcode: it.barcode || null,
    location: it.location || null,
    sector: it.sector || it.location?.sector || "",
  }));

// ── Cola segmentada CHICOS / GRANDES ─────────────────────────────────────────
// Espejo de segmentoDe() del backend (relayOrderService): grande = total >=
// UMBRAL_GRANDE o más de 10 SKU. Si el umbral cambia en el backend, actualizar aquí.
const UMBRAL_GRANDE = 300000; // = UMBRAL_GRANDE backend (CLP, configurable allá)
const segmentoDe = (o) =>
  Number(o.total || 0) >= UMBRAL_GRANDE || (o.items || []).length > 10 ? "grande" : "chico";

// ── Incentivo por tiempo de preparación ──────────────────────────────────────
// Espejo de backend/src/incentivos/tiempo.js (tabla del cliente pendiente; la
// fuente de verdad es el backend — esto solo pinta el badge en vivo).
const TRAMOS = [
  { min_total: 0, max_total: 300000, min_sku: 0, meta_min: 20, premio: 1000 },
  { min_total: 300000, max_total: 1000000, min_sku: 0, meta_min: 30, premio: 1500 },
  { min_total: 1000000, max_total: Infinity, min_sku: 10, meta_min: 40, premio: 2000 },
];
// premio decae 25% del premio_full por cada 10 min completos sobre la meta, hasta 0,
// redondeado a $100. prep_min null → premio full (aún dentro de la meta / sin dato).
function premioPorTiempo({ total, n_sku, prep_min }) {
  // OJO: mismo operador que el backend (incentivos/tiempo.js) → n_sku ESTRICTAMENTE
  // mayor a min_sku. Con >= el badge difería del premio real en pedidos de exactamente min_sku.
  const tramo = TRAMOS.find((t) => total >= t.min_total && total < t.max_total && n_sku > t.min_sku);
  if (!tramo) return null;
  const premio_full = tramo.premio;
  let premio = premio_full;
  if (prep_min != null && prep_min > tramo.meta_min) {
    const bloques = Math.floor((prep_min - tramo.meta_min) / 10);
    premio = Math.round(Math.max(0, premio_full * (1 - 0.25 * bloques)) / 100) * 100;
  }
  return { meta_min: tramo.meta_min, premio_full, premio };
}

const ordNum = (o) => o.number || o.code || `#${String(o._id).slice(-6)}`;
const ordCust = (o) => {
  const c = o.customer;
  if (c && typeof c === "object") return c.fullName || c.name || c.email || "Cliente";
  return c || o.customer_name || o.contact_name || o.email || "Cliente";
};
const hydrate = (o) => ({ ...o, items: normItems(o), pick_progress: (o.pick_progress || []).map(String), pick_scanned: (o.pick_scanned || []).map(String) });

export default function Picking() {
  const { user, effectiveRole } = useAuth();
  const [tick, setTick] = useState(0);
  const load = useLoad(() => api.pendingToPrepare(), ORDERS_RES, [tick]);
  const exp = useLoad(() => (usingMock ? Promise.resolve({ items: [] }) : api.expiringSoon(30)), { items: [] });
  const [orders, setOrders] = useState([]);
  const [seg, setSeg] = useState("chico");
  const [selId, setSelId] = useState(null);
  // Reloj para el cronómetro del incentivo (30s de resolución basta para minutos).
  const [now, setNow] = useState(Date.now());
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sectoresOrden, setSectoresOrden] = useState({});
  const [faltanteFor, setFaltanteFor] = useState(null);
  const [faltaQty, setFaltaQty] = useState("");
  const [faltaMot, setFaltaMot] = useState("");
  const [empaque, setEmpaque] = useState(false);
  const [bultos, setBultos] = useState("");
  const [peso, setPeso] = useState("");
  const inputRef = useRef(null);

  // FEFO: product_id → días para vencer (guía visual; sin modelo de lotes no se fuerza).
  const fefo = useMemo(() => {
    const m = {}; (exp.data?.items || []).forEach((p) => { m[String(p._id)] = p.days_left; }); return m;
  }, [exp.data]);

  useEffect(() => {
    const list = (load.data?.orders || []).map(hydrate);
    setOrders(list);
    // Si la selección ya no existe, preferir el primer pedido del segmento activo.
    setSelId((cur) => {
      if (cur && list.some((o) => o._id === cur)) return cur;
      const delSeg = list.find((o) => segmentoDe(o) === seg);
      return delSeg?._id || list[0]?._id || null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.data]);

  useEffect(() => {
    if (usingMock) return;
    api.sectores().then((r) => { const m = {}; (r.sectores || []).forEach((s) => { m[s.nombre] = s.orden; }); setSectoresOrden(m); }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // En vivo: SSE + polling de respaldo (el bodeguero ve los pedidos recién cobrados).
  useEffect(() => {
    if (usingMock) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", () => setTick((n) => n + 1)); } } catch { /* polling */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  const sel = orders.find((o) => o._id === selId);
  const isPicked = (o, pid) => (o.pick_progress || []).includes(String(pid));
  const isScanned = (o, pid) => (o.pick_scanned || []).includes(String(pid));
  const pickedCount = sel ? sel.items.filter((it) => isPicked(sel, it.product_id)).length : 0;
  const totalItems = sel ? sel.items.length : 0;
  const allPicked = sel && totalItems > 0 && pickedCount === totalItems;

  // ── FIFO + asignación (espejo de aceptarPicking del backend) ────────────────
  const myId = String(user?._id || user?.id || "");
  const isBoss = effectiveRole === "admin" || effectiveRole === "manager"; // override implícito
  const asignadoId = (o) => (o.assigned_to?.user_id ? String(o.assigned_to.user_id) : null);
  const asignadoAMi = (o) => Boolean(myId) && asignadoId(o) === myId;
  const asignadoAOtro = (o) => Boolean(asignadoId(o)) && asignadoId(o) !== myId;
  // `orders` ya viene FIFO ascendente (pendingToPrepare): el "primero" del segmento
  // es el paid más antiguo no asignado a otra persona.
  const primeroDe = (s) => orders.find((o) => o.status === "paid" && segmentoDe(o) === s && !asignadoAOtro(o));
  const puedeTomar = (o) => {
    if (isBoss) return true; // admin/manager toman cualquiera
    if (asignadoAOtro(o)) return false; // solo lo toma el asignado
    if (asignadoAMi(o)) return true; // asignado a ti: aunque no sea el más antiguo
    return primeroDe(segmentoDe(o))?._id === o._id;
  };

  const visibles = orders.filter((o) => segmentoDe(o) === seg);
  const porTomar = visibles.filter((o) => o.status === "paid").length;

  const cambiarSeg = (s) => {
    setSeg(s);
    if (!sel || segmentoDe(sel) !== s) {
      const first = orders.find((o) => segmentoDe(o) === s);
      setSelId(first?._id || null);
      setMsg(null); setEmpaque(false); setFaltanteFor(null);
    }
  };

  const badgeAsignado = (o) =>
    asignadoId(o) ? (
      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", background: asignadoAMi(o) ? "#ecfdf5" : "#f3e8ff", color: asignadoAMi(o) ? "#166534" : "#6b21a8", border: `1px solid ${asignadoAMi(o) ? "#a7f3d0" : "#e9d5ff"}` }}>
        {asignadoAMi(o) ? "Asignado a ti" : `Asignado a ${o.assigned_to?.label || "otra persona"}`}
      </span>
    ) : null;

  // Badge del incentivo por tiempo (pedido en preparación): meta + premio vigente,
  // con cronómetro desde que se tomó (status_history preparing/started) si existe.
  const premioBadge = (o) => {
    const total = Number(o.total || 0);
    const n_sku = (o.items || []).length;
    const base = premioPorTiempo({ total, n_sku, prep_min: null });
    if (!base) return null;
    const start = (o.status_history || []).find((h) => h.status === "preparing" || h.status === "started")?.changed_at;
    const t0 = start ? new Date(start).getTime() : NaN;
    const min = Number.isFinite(t0) ? Math.max(0, Math.floor((now - t0) / 60000)) : null;
    const cur = min != null ? premioPorTiempo({ total, n_sku, prep_min: min }) : base;
    const enMeta = min == null || min <= base.meta_min;
    return (
      <div style={{ margin: "10px 18px 0", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "4px 12px", background: enMeta ? "#ecfdf5" : "#fff7ed", border: `1px solid ${enMeta ? "#a7f3d0" : "#fed7aa"}`, color: enMeta ? "var(--ok,#16a34a)" : "#c2410c" }}>
        ⏱ {min != null ? `${min} min · ` : ""}Meta: {base.meta_min} min → {clp(cur.premio)}
        {min != null && cur.premio < base.premio_full ? <span style={{ fontWeight: 600 }}>&nbsp;(de {clp(base.premio_full)})</span> : null}
      </div>
    );
  };
  const grupos = useMemo(() => (sel ? agruparItemsPorSector(sel.items.map((it) => ({ ...it, quantity: it.qty })), sectoresOrden) : []), [sel, sectoresOrden]);

  // Relay de área (monitores por zona): estado derivado por sector (contrato zonaEstado).
  // "lista" si sector ∈ zone_done (lo preparó el dueño del área) O todos sus ítems ya
  // están en pick_progress; si no, pendiente. zone_done: [{ sector, at, by_label }].
  const zonasDe = (o) => agruparItemsPorSector((o.items || []).map((it) => ({ ...it, quantity: it.qty })), sectoresOrden);
  const zonaPorArea = (o, sector) => (o.zone_done || []).some((z) => z.sector === sector);
  const zonaLista = (o, g) => zonaPorArea(o, g.sector) || (g.items.length > 0 && g.items.every((it) => isPicked(o, it.product_id)));

  const chipsZona = (o) => {
    const gs = zonasDe(o);
    if (!gs.length) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {gs.map((g) => {
          const lista = zonaLista(o, g);
          return (
            <span
              key={g.sector}
              title={lista ? "Preparado por el dueño del área" : "Zona pendiente de preparar"}
              style={{
                fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap",
                background: lista ? "#ecfdf5" : "#fefce8",
                color: lista ? "var(--ok,#16a34a)" : "#a16207",
                border: `1px solid ${lista ? "#a7f3d0" : "#fde68a"}`,
              }}
            >
              {lista ? `🟢 ${g.sector} ✔` : `🟡 ${g.sector}`}
            </span>
          );
        })}
      </div>
    );
  };

  function applyOrder(updated) {
    const h = hydrate(updated);
    setOrders((os) => os.map((o) => {
      if (o._id !== h._id) return o;
      // El backend no siempre enriquece items con barcode/location: preservar lo
      // ya conocido por product_id (📍 ubicación, código, sector) del estado previo.
      const prev = new Map((o.items || []).map((it) => [it.product_id, it]));
      const items = h.items.map((it) => {
        const p = prev.get(it.product_id);
        if (!p) return it;
        return { ...it, barcode: it.barcode || p.barcode || null, location: it.location || p.location || null, sector: it.sector || p.sector || "" };
      });
      return { ...o, ...h, items };
    }));
  }

  async function setPick(pid, picked, scanned) {
    if (!sel) return;
    // optimista
    setOrders((os) => os.map((o) => {
      if (o._id !== sel._id) return o;
      const prog = new Set((o.pick_progress || []).map(String));
      const scn = new Set((o.pick_scanned || []).map(String));
      if (picked) { prog.add(String(pid)); if (scanned) scn.add(String(pid)); } else { prog.delete(String(pid)); scn.delete(String(pid)); }
      return { ...o, pick_progress: [...prog], pick_scanned: [...scn] };
    }));
    try { if (!usingMock) { const r = await api.patchPick(sel._id, { product_id: pid, picked, scanned }); if (r.order) applyOrder(r.order); } }
    catch (e) { setMsg({ ok: false, text: e.message }); setTick((n) => n + 1); }
  }

  async function onScan(e) {
    e.preventDefault();
    const code = scan.trim(); setScan("");
    if (!code || !sel) return;
    try {
      let matchId = null;
      if (usingMock) matchId = sel.items.find((x) => x.barcode === code)?.product_id || null;
      else { const product = await api.byBarcode(code); const pid = String(product?._id); matchId = sel.items.some((x) => x.product_id === pid) ? pid : null; }
      if (!matchId) { setMsg({ ok: false, text: "El código no pertenece a este pedido" }); return; }
      if (isScanned(sel, matchId)) { setMsg({ ok: false, text: "Ese ítem ya estaba escaneado" }); return; }
      await setPick(matchId, true, true);
      const it = sel.items.find((x) => x.product_id === matchId);
      setMsg({ ok: true, text: `✓ ${it.name} verificado por escaneo` });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { inputRef.current?.focus(); }
  }

  async function tomar() {
    if (!sel || sel.status !== "paid") return;
    setBusy(true); setMsg(null);
    const ticketOrder = { _id: sel._id, customer: sel.customer, items: sel.items.map((it) => ({ name: it.name, quantity: it.qty, cajas: it.cajas, sector: it.sector })) };
    try {
      if (!usingMock) await api.aceptar(sel._id);
      setOrders((os) => os.map((o) => (o._id === sel._id ? { ...o, status: "preparing" } : o)));
      setMsg({ ok: true, text: `Pedido ${ordNum(sel)} asignado — ticket y etiquetas impresos, listo para preparar` });
      // Un solo trabajo de impresión: ticket de recorrido + una etiqueta por zona
      // (folio gigante) para pegar en cada bulto al recogerlo.
      imprimirTicketPicking(ticketOrder, sectoresOrden, { zonasListas: (sel.zone_done || []).map((z) => z.sector), etiquetas: true });
    } catch (err) {
      if (err.status === 409) {
        // 409 con causas distintas: ya tomado, FIFO ("toma el más antiguo") o
        // asignado a otra persona → mostrar el mensaje del backend y re-sincronizar.
        setMsg({ ok: false, text: err.message || "Este pedido ya fue asignado a otro bodeguero" });
        setTick((n) => n + 1);
      } else setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  }

  function reimprimir() {
    if (!sel) return;
    imprimirTicketPicking({ _id: sel._id, customer: sel.customer, items: sel.items.map((it) => ({ name: it.name, quantity: it.qty, sector: it.sector })) }, sectoresOrden, { zonasListas: (sel.zone_done || []).map((z) => z.sector) });
  }

  // Reimpresión del juego de ETIQUETAS DE ZONA (el original sale con el comprobante
  // en la caja): una etiqueta por sector, para pegar en cada bulto del recorrido.
  function reimprimirEtiquetas() {
    if (!sel) return;
    imprimirEtiquetasZona({ _id: sel._id, customer: sel.customer, items: sel.items.map((it) => ({ name: it.name, quantity: it.qty, cajas: it.cajas, sector: it.sector })) }, sectoresOrden);
  }

  async function confirmarFaltante() {
    if (!sel || !faltanteFor) return;
    // Cantidad real OBLIGATORIA (entero 0..esperado): sin esto, vacío = 0 y el
    // backend descontaría todas las unidades esperadas del stock sin aviso.
    const it = sel.items.find((x) => x.product_id === faltanteFor);
    const esperado = Number(it?.qty || 0);
    const n = Number(faltaQty);
    if (String(faltaQty).trim() === "" || !Number.isInteger(n) || n < 0 || n > esperado) {
      setMsg({ ok: false, text: `Indica la cantidad real encontrada (entero entre 0 y ${esperado}).` });
      return;
    }
    const merma = esperado - n;
    if (!window.confirm(`Faltante en "${it?.name}": encontraste ${n} de ${esperado}.\nSe descontarán ${merma} unidad${merma === 1 ? "" : "es"} del stock. ¿Continuar?`)) return;
    setBusy(true); setMsg(null);
    try {
      if (!usingMock) { const r = await api.faltante(sel._id, { product_id: faltanteFor, qty_real: n, motivo: faltaMot.trim() }); if (r.order) applyOrder(r.order); }
      else await setPick(faltanteFor, true, false);
      setMsg({ ok: true, text: "Faltante registrado · el pedido queda en revisión y se ajustó el inventario" });
      setFaltanteFor(null); setFaltaQty(""); setFaltaMot("");
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  }

  async function confirmarListo() {
    if (!sel) return;
    setBusy(true); setMsg(null);
    try {
      const nb = bultos === "" ? null : Math.round(Number(bultos));
      const np = peso === "" ? null : Number(peso);
      if (!usingMock) await api.marcarListo(sel._id, { bultos: nb, peso: np });
      imprimirEtiquetaDespacho({ _id: sel._id, customer: sel.customer }, { bultos: nb, peso: np });
      setOrders((os) => os.map((o) => (o._id === sel._id ? { ...o, status: "ready" } : o)));
      setMsg({ ok: true, text: `Pedido ${ordNum(sel)} empacado y LISTO${nb ? ` · ${nb} bulto${nb === 1 ? "" : "s"}` : ""} · ${nb > 1 ? "etiquetas impresas (una por bulto)" : "etiqueta impresa"}` });
      setEmpaque(false); setBultos(""); setPeso("");
    } catch (err) {
      if (err.status === 409 || err.status === 403) { setTick((n) => n + 1); setMsg({ ok: false, text: "Este pedido ya cambió de estado (lo completó o movió otra persona)." }); }
      else setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  }

  const fefoBadge = (pid) => {
    const d = fefo[String(pid)];
    if (d == null) return null;
    const color = d <= 3 ? "var(--danger,#b00020)" : d <= 7 ? "var(--warn,#d97706)" : "var(--muted,#6b7280)";
    return <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 6 }}>vence en {d} días</span>;
  };

  const tap = { minHeight: 44, minWidth: 44 };

  return (
    <div className="pick-grid">
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".5px", margin: "2px 4px 10px" }}>
          PEDIDOS POR PREPARAR ({visibles.length}){porTomar > 0 ? <span style={{ color: "var(--magenta,#E6007E)" }}> · {porTomar} nuevo{porTomar === 1 ? "" : "s"} por tomar</span> : null}
        </div>
        {/* Cola segmentada: pickers nuevos → Chicos; expertos → Grandes (total o nº SKU). */}
        <div style={{ display: "flex", gap: 6, margin: "0 4px 10px" }}>
          {[["chico", "Chicos"], ["grande", "Grandes"]].map(([k, label]) => {
            const n = orders.filter((o) => segmentoDe(o) === k).length;
            const act = seg === k;
            return (
              <button
                key={k}
                onClick={() => cambiarSeg(k)}
                style={{ flex: 1, minHeight: 38, borderRadius: 999, cursor: "pointer", fontWeight: 800, fontSize: 13, border: `1px solid ${act ? "var(--magenta,#E6007E)" : "#d9d2dc"}`, background: act ? "#fdf2f8" : "#fff", color: act ? "var(--magenta,#E6007E)" : "var(--muted)" }}
              >
                {label} ({n})
              </button>
            );
          })}
        </div>
        {load.loading ? (
          <div className="ord" style={{ color: "var(--muted)" }}>Cargando pedidos…</div>
        ) : visibles.length === 0 ? (
          <div className="ord" style={{ color: "var(--muted)" }}>{orders.length === 0 ? "No hay pedidos por preparar. La cola está al día." : `Sin pedidos ${seg === "chico" ? "chicos" : "grandes"} en la cola`}</div>
        ) : (
          visibles.map((o) => {
            const done = o.items.filter((it) => isPicked(o, it.product_id)).length;
            return (
              <div key={o._id} className={"ord" + (o._id === selId ? " sel" : "")} onClick={() => { setSelId(o._id); setMsg(null); setEmpaque(false); setFaltanteFor(null); }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="n">{ordNum(o)}</span>
                  {o.needs_review ? <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "1px 6px" }}>revisar</span> : null}
                  <div style={{ marginLeft: "auto" }}><StatusBadge status={o.status} /></div>
                </div>
                <div className="c">{ordCust(o)}</div>
                {asignadoId(o) ? <div style={{ marginTop: 4 }}>{badgeAsignado(o)}</div> : null}
                {chipsZona(o)}
                {o.status === "paid"
                  ? (puedeTomar(o)
                    ? <div style={{ fontSize: 12.5, color: "var(--magenta,#E6007E)", fontWeight: 700 }}>Nuevo · disponible para preparar</div>
                    : <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{asignadoAOtro(o) ? "Reservado" : "⏳ Primero el más antiguo"}</div>)
                  : <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{done}/{o.items.length} ítems pickeados</div>}
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        {/* Feedback a nivel de card: visible también cuando "Tomar" falla con 409
            (que deselecciona el pedido) o con error de red. */}
        {msg ? <div style={{ margin: "14px 18px 0", fontSize: 13.5, fontWeight: 600, color: msg.ok ? "var(--ok)" : "var(--danger)" }}>{msg.text}</div> : null}
        {!sel ? (
          <div className="empty">Selecciona un pedido de la cola para comenzar el picking.</div>
        ) : (
          <>
            <div className="card-h">
              <h2>Picking · {ordNum(sel)}</h2>
              <div className="spacer" />
              {sel.status === "preparing" ? (
                <>
                  <button className="btn btn-ghost" style={{ marginRight: 8 }} onClick={reimprimir}>Ticket</button>
                  <button className="btn btn-ghost" style={{ marginRight: 8 }} onClick={reimprimirEtiquetas}>Etiquetas</button>
                </>
              ) : null}
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{ordCust(sel)}</span>
            </div>
            <div className="prog" style={{ marginTop: 14 }}>
              <i style={{ width: (totalItems ? (pickedCount / totalItems) * 100 : 0) + "%" }} />
            </div>

            {sel.status === "paid" ? (
              <div style={{ margin: "12px 18px 4px", padding: "12px 14px", borderRadius: 12, background: "#fdf2f8", border: "1px solid var(--rosa-soft,#FBCFE8)" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Pedido nuevo en cola · {segmentoDe(sel) === "grande" ? "Grande" : "Chico"}
                  {badgeAsignado(sel)}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Tómalo para empezar a prepararlo. Quedará a tu cargo y pasará a “En preparación”.</div>
                <button className="btn btn-primary" style={tap} onClick={tomar} disabled={busy || !puedeTomar(sel)}>Tomar este pedido</button>
                {!puedeTomar(sel) ? (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#b45309", marginTop: 8 }}>
                    {asignadoAOtro(sel)
                      ? `Este pedido está asignado a ${sel.assigned_to?.label || "otra persona"}`
                      : "⏳ Primero el más antiguo: toma el primer pedido de tu cola"}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div style={{ margin: "10px 18px 0" }}>{chipsZona(sel)}</div>
                {premioBadge(sel)}
                {grupos.map((g) => {
                  const porArea = zonaPorArea(sel, g.sector);
                  return (
                  <div key={g.sector}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: porArea ? "var(--ok,#16a34a)" : "var(--magenta-d,#9B007A)", textTransform: "uppercase", letterSpacing: ".4px", margin: "12px 18px 2px" }}>{porArea ? "✔ " : ""}{g.sector}</div>
                    {porArea ? (
                      <div style={{ margin: "4px 18px 2px", padding: "6px 10px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: 12, fontWeight: 600, color: "var(--ok,#16a34a)" }}>
                        ✔ Cajas preparadas por el área — retíralas en la mesa de entrega
                      </div>
                    ) : null}
                    {g.items.map((it) => {
                      const ok = isPicked(sel, it.product_id);
                      const scanned = isScanned(sel, it.product_id);
                      const sinEscanear = ok && !scanned && it.barcode;
                      return (
                        <div key={it.product_id} className={"pick-item" + (ok ? " ok" : "")} onClick={() => setPick(it.product_id, !ok, false)} style={{ cursor: "pointer" }}>
                          <div className="chk" style={{ minWidth: 28, minHeight: 28 }}>{ok ? "✓" : ""}</div>
                          <div className="nm">
                            <b>{it.qty} × {it.name}</b>{fefoBadge(it.product_id)}
                            <div className="bc">
                              {it.location?.code ? <>📍 <span className="loc">{it.location.code}</span> &nbsp;</> : null}
                              {it.barcode ? <>cod. {it.barcode}</> : <span style={{ color: "var(--muted)" }}>sin código</span>}
                              {scanned ? <span style={{ color: "var(--ok,#16a34a)", fontWeight: 700 }}> · ✓ escaneado</span> : sinEscanear ? <span style={{ color: "#d97706", fontWeight: 700 }}> · ⚠ a mano</span> : null}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                            <button className="btn btn-ghost" style={{ ...tap, color: "var(--danger,#b00020)" }} onClick={() => { setFaltanteFor(it.product_id); setFaltaQty(""); setFaltaMot(""); }}>Falta</button>
                            <button className={ok ? "btn btn-ghost" : "btn btn-primary"} style={tap} onClick={() => setPick(it.product_id, !ok, false)}>{ok ? "Deshacer" : "Marcar"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })}

                {faltanteFor ? (
                  <div style={{ margin: "10px 18px", padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Reportar faltante / dañado</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input value={faltaQty} onChange={(e) => setFaltaQty(e.target.value)} inputMode="numeric" placeholder="Cantidad real" style={{ width: 120, padding: "9px 10px", borderRadius: 8, border: "1px solid #d9d2dc" }} />
                      <input value={faltaMot} onChange={(e) => setFaltaMot(e.target.value)} placeholder="Motivo (ej: dañado)" style={{ flex: 1, minWidth: 140, padding: "9px 10px", borderRadius: 8, border: "1px solid #d9d2dc" }} />
                      <button className="btn btn-primary" style={tap} onClick={confirmarFaltante} disabled={busy}>Registrar</button>
                      <button className="btn btn-ghost" style={tap} onClick={() => setFaltanteFor(null)}>Cancelar</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Ajusta el inventario y deja el pedido en revisión (no lo cancela).</div>
                  </div>
                ) : null}

                <form className="scan" onSubmit={onScan}>
                  <input ref={inputRef} value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Escanee el código de barras para verificar el ítem…" autoFocus />
                  <button className="btn btn-primary" style={tap} type="submit">Verificar</button>
                </form>

                {empaque ? (
                  <div style={{ margin: "0 18px 16px", padding: 14, borderRadius: 12, background: "#f3eef6", border: "1px solid #e3d5e8" }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Empaque · cierre del pedido</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                      <label style={{ fontSize: 13 }}>Nº de bultos
                        <input value={bultos} onChange={(e) => setBultos(e.target.value)} inputMode="numeric" placeholder="ej: 3" style={{ display: "block", marginTop: 4, width: 110, padding: "9px 10px", borderRadius: 8, border: "1px solid #d9d2dc" }} />
                      </label>
                      <label style={{ fontSize: 13 }}>Peso kg (opcional)
                        <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" placeholder="ej: 24.5" style={{ display: "block", marginTop: 4, width: 130, padding: "9px 10px", borderRadius: 8, border: "1px solid #d9d2dc" }} />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" style={{ ...tap, flex: 1 }} onClick={confirmarListo} disabled={busy}>{busy ? "Guardando…" : "Empacado · marcar como listo"}</button>
                      <button className="btn btn-ghost" style={tap} onClick={() => setEmpaque(false)}>Volver</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "0 18px 18px" }}>
                    <button className="btn btn-primary" style={{ width: "100%", minHeight: 48 }} disabled={!allPicked || busy} onClick={() => setEmpaque(true)}>
                      {allPicked ? "Empacar y marcar como listo" : `Faltan ${totalItems - pickedCount} ítems por pickear`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
