import { useEffect, useRef, useState } from "react";
import { api, useLoad, usingMock, streamUrl } from "../api.js";
import { ORDERS_RES } from "../data.js";
import { StatusBadge } from "../ui.jsx";
import { useAuth } from "../auth.jsx";

// PREPARACIÓN DE PEDIDOS. Cola en vivo (SSE), claim atómico al tomar, avance
// PERSISTIDO en el backend (sobrevive recargas y lo continúa otra persona),
// escaneo VINCULANTE (marcar a mano = override visible), flujo de FALTANTE/dañado,
// guía FEFO y cierre de EMPAQUE (nº de bultos) antes de marcar listo.

const normItems = (o) =>
  (o.items || []).map((it) => ({
    product_id: String(it.product_id ?? it._id ?? it.name),
    name: it.name,
    qty: it.quantity ?? it.qty ?? 1,
    cajas: it.cajas ?? null,
    barcode: it.barcode || null,
    location: it.location || null,
  }));

const ordNum = (o) => o.number || o.code || `#${String(o._id).slice(-6)}`;
const ordCust = (o) => {
  const c = o.customer;
  if (c && typeof c === "object") return c.fullName || c.name || c.email || "Cliente";
  return c || o.customer_name || o.contact_name || o.email || "Cliente";
};
const hydrate = (o) => ({ ...o, items: normItems(o), pick_progress: (o.pick_progress || []).map(String), pick_scanned: (o.pick_scanned || []).map(String) });

// ── Fusión del avance local con lo que llega del servidor ────────────────────
// Cada clic se pinta al instante (optimista) y recién después el backend lo
// confirma. Pero la lista se refresca cada 20 s Y en cada evento SSE — eventos
// que dispara el propio clic —, así que un refresco que llegue con datos un
// pelo más viejos que el último clic lo borraba de la pantalla.
//
// Solución: en vez de reemplazar el pedido entero con lo del servidor, se
// guarda la INTENCIÓN de cada clic (marcar / desmarcar / tomar / marcar listo)
// y se vuelve a aplicar encima de lo que llega, hasta que el servidor la
// refleje. Se guarda la intención y no "la unión de lo marcado" porque la unión
// ingenua nunca dejaría DESMARCAR: el servidor sigue contestando por unos
// milisegundos que el ítem está marcado y la unión lo volvería a marcar solo.
// Con la intención ("este ítem lo quiero desmarcado") el desmarcado también
// sobrevive al refresco, y la intención se descarta apenas el servidor coincide.
const RANGO_ESTADO = { pending: 0, paid: 1, preparing: 2, ready: 3, delivered: 4 };

// Red de seguridad: si el servidor nunca confirma (otra persona movió el pedido,
// un PATCH que se perdió), la intención se suelta al minuto para que la pantalla
// no quede clavada mostrando algo que ya no es cierto.
const TTL_INTENCION = 60000;

// ¿el pedido que llegó del servidor ya refleja esta intención sobre un ítem?
const itemConfirmado = (srv, pid, intento) => {
  const marcado = (srv.pick_progress || []).includes(pid);
  const escaneado = (srv.pick_scanned || []).includes(pid);
  if (!intento.picked) return !marcado && !escaneado; // desmarcar: limpio en ambos
  if (intento.scanned) return marcado && escaneado;   // marcado por escaneo
  return marcado;                                      // marcado a mano: el escaneo da igual
};

// ¿el servidor ya alcanzó (o pasó) el estado que dejó el clic? Un estado que no
// está en el ranking (cancelled, etc.) también cuenta como confirmado: el pedido
// se salió del flujo normal y manda el servidor.
const estadoConfirmado = (srv, intento) => {
  const rSrv = RANGO_ESTADO[srv.status];
  const rLocal = RANGO_ESTADO[intento];
  if (rSrv == null || rLocal == null) return true;
  return rSrv >= rLocal;
};

// Deja vivas solo las intenciones que el servidor todavía no refleja.
function podarIntenciones(mapa, srv, ahora) {
  const p = mapa.get(srv._id);
  if (!p) return null;
  p.items.forEach((intento, pid) => {
    if (ahora - intento.at > TTL_INTENCION || itemConfirmado(srv, pid, intento)) p.items.delete(pid);
  });
  if (p.status && (ahora - p.status.at > TTL_INTENCION || estadoConfirmado(srv, p.status.value))) p.status = null;
  if (p.items.size === 0 && !p.status) { mapa.delete(srv._id); return null; }
  return p;
}

// El backend no siempre enriquece items con barcode/location: preservar lo ya
// conocido por product_id (📍 ubicación, código) del estado previo.
const fundirItems = (prevItems, nextItems) => {
  const prev = new Map((prevItems || []).map((it) => [it.product_id, it]));
  return nextItems.map((it) => {
    const p = prev.get(it.product_id);
    if (!p) return it;
    return { ...it, barcode: it.barcode || p.barcode || null, location: it.location || p.location || null };
  });
};

// Pedido del servidor + las intenciones locales que todavía están pendientes.
function fundirPedido(local, srv, pendiente) {
  const items = fundirItems(local?.items, srv.items);
  if (!pendiente) return { ...srv, items };
  const prog = new Set(srv.pick_progress || []);
  const scn = new Set(srv.pick_scanned || []);
  pendiente.items.forEach((intento, pid) => {
    if (intento.picked) { prog.add(pid); if (intento.scanned) scn.add(pid); }
    else { prog.delete(pid); scn.delete(pid); }
  });
  return {
    ...srv,
    items,
    pick_progress: [...prog],
    pick_scanned: [...scn],
    status: pendiente.status ? pendiente.status.value : srv.status,
  };
}

export default function Picking() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const load = useLoad(() => api.pendingToPrepare(), ORDERS_RES, [tick]);
  const exp = useLoad(() => (usingMock ? Promise.resolve({ items: [] }) : api.expiringSoon(30)), { items: [] });
  const [orders, setOrders] = useState([]);
  const [selId, setSelId] = useState(null);
  const [scan, setScan] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [faltanteFor, setFaltanteFor] = useState(null);
  const [faltaQty, setFaltaQty] = useState("");
  const [faltaMot, setFaltaMot] = useState("");
  const [empaque, setEmpaque] = useState(false);
  const [bultos, setBultos] = useState("");
  const [peso, setPeso] = useState("");
  const inputRef = useRef(null);
  // Intenciones locales todavía no confirmadas por el servidor:
  // order_id → { items: Map(product_id → {picked, scanned, at}), status: {value, at} }
  const pend = useRef(new Map());

  const bolsa = (oid) => {
    let b = pend.current.get(oid);
    if (!b) { b = { items: new Map(), status: null }; pend.current.set(oid, b); }
    return b;
  };
  const anotarItem = (oid, pid, intento) => { bolsa(oid).items.set(String(pid), { ...intento, at: Date.now() }); };
  const anotarEstado = (oid, value) => { bolsa(oid).status = { value, at: Date.now() }; };
  const olvidarItem = (oid, pid) => { pend.current.get(oid)?.items.delete(String(pid)); };

  // FEFO: product_id → días para vencer (guía visual; sin modelo de lotes no se fuerza).
  const fefo = {};
  (exp.data?.items || []).forEach((p) => { fefo[String(p._id)] = p.days_left; });

  // Llegada de datos del servidor: FUNDIR, no reemplazar. Los pedidos nuevos
  // entran tal cual, los que ya no vienen del servidor salen de la lista, y los
  // que siguen conservan el avance local que el servidor aún no refleja.
  useEffect(() => {
    const list = (load.data?.orders || []).map(hydrate);
    const ahora = Date.now();
    const vigentes = new Set(list.map((o) => o._id));
    // Un pedido que ya salió de la cola no necesita intenciones guardadas.
    [...pend.current.keys()].forEach((id) => { if (!vigentes.has(id)) pend.current.delete(id); });
    const podadas = new Map();
    list.forEach((srv) => { const p = podarIntenciones(pend.current, srv, ahora); if (p) podadas.set(srv._id, p); });
    setOrders((prev) => {
      const prevById = new Map(prev.map((o) => [o._id, o]));
      return list.map((srv) => fundirPedido(prevById.get(srv._id), srv, podadas.get(srv._id)));
    });
    setSelId((cur) => (cur && vigentes.has(cur) ? cur : list[0]?._id || null));
  }, [load.data]);

  // En vivo: SSE + polling de respaldo (se ven los pedidos recién pagados).
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
  const porTomar = orders.filter((o) => o.status === "paid").length;

  // ── Asignación manual (espejo de aceptarPicking del backend) ────────────────
  const myId = String(user?._id || user?.id || "");
  const asignadoId = (o) => (o.assigned_to?.user_id ? String(o.assigned_to.user_id) : null);
  const asignadoAMi = (o) => Boolean(myId) && asignadoId(o) === myId;
  const asignadoAOtro = (o) => Boolean(asignadoId(o)) && asignadoId(o) !== myId;
  const puedeTomar = (o) => !asignadoAOtro(o);

  const badgeAsignado = (o) =>
    asignadoId(o) ? (
      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", background: asignadoAMi(o) ? "#ecfdf5" : "#f3e8ff", color: asignadoAMi(o) ? "#166534" : "#6b21a8", border: `1px solid ${asignadoAMi(o) ? "#a7f3d0" : "#93C4D8"}` }}>
        {asignadoAMi(o) ? "Asignado a ti" : `Asignado a ${o.assigned_to?.label || "otra persona"}`}
      </span>
    ) : null;

  // Respuesta de una acción puntual (PATCH de avance, faltante). También se funde
  // con las intenciones pendientes: si la persona alcanzó a dar otro clic mientras
  // esta respuesta viajaba, ese clic no se pierde.
  function applyOrder(updated) {
    const h = hydrate(updated);
    const p = podarIntenciones(pend.current, h, Date.now());
    setOrders((os) => os.map((o) => (o._id === h._id ? { ...o, ...fundirPedido(o, h, p) } : o)));
  }

  async function setPick(pid, picked, scanned) {
    if (!sel) return;
    // optimista + se anota la intención para que el próximo refresco no la pise
    anotarItem(sel._id, pid, { picked, scanned });
    setOrders((os) => os.map((o) => {
      if (o._id !== sel._id) return o;
      const prog = new Set((o.pick_progress || []).map(String));
      const scn = new Set((o.pick_scanned || []).map(String));
      if (picked) { prog.add(String(pid)); if (scanned) scn.add(String(pid)); } else { prog.delete(String(pid)); scn.delete(String(pid)); }
      return { ...o, pick_progress: [...prog], pick_scanned: [...scn] };
    }));
    try { if (!usingMock) { const r = await api.patchPick(sel._id, { product_id: pid, picked, scanned }); if (r.order) applyOrder(r.order); } }
    // Si el PATCH falla se borra la intención: si no, quedaría pisando al servidor
    // para siempre y la pantalla mostraría un avance que nunca se guardó.
    catch (e) { olvidarItem(sel._id, pid); setMsg({ ok: false, text: e.message }); setTick((n) => n + 1); }
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
    try {
      if (!usingMock) await api.aceptar(sel._id);
      anotarEstado(sel._id, "preparing");
      setOrders((os) => os.map((o) => (o._id === sel._id ? { ...o, status: "preparing" } : o)));
      setMsg({ ok: true, text: `Pedido ${ordNum(sel)} a tu cargo — puedes empezar a prepararlo` });
    } catch (err) {
      if (err.status === 409) {
        // 409: ya lo tomó otra persona o está asignado a alguien más.
        setMsg({ ok: false, text: err.message || "Este pedido ya fue tomado por otra persona" });
        setTick((n) => n + 1);
      } else setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
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
      // Antes acá se abría el diálogo de impresión con la etiqueta de bulto. Se
      // sacó: el seguimiento del despacho es por computador y nadie pega etiquetas.
      // El helper imprimirEtiquetaDespacho() de print.js sigue disponible si algún
      // día se quiere de vuelta (basta volver a llamarlo desde acá).
      anotarEstado(sel._id, "ready");
      setOrders((os) => os.map((o) => (o._id === sel._id ? { ...o, status: "ready" } : o)));
      setMsg({ ok: true, text: `Pedido ${ordNum(sel)} empacado y LISTO${nb ? ` · ${nb} bulto${nb === 1 ? "" : "s"}` : ""}` });
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
          PEDIDOS POR PREPARAR ({orders.length}){porTomar > 0 ? <span style={{ color: "var(--magenta,#004568)" }}> · {porTomar} nuevo{porTomar === 1 ? "" : "s"} por tomar</span> : null}
          {/* Aviso discreto de refresco: la lista NO se reemplaza por "Cargando". */}
          {load.loading && load.data ? <span style={{ fontWeight: 600, opacity: .7 }}> · actualizando…</span> : null}
        </div>
        {/* "Cargando pedidos…" SOLO en la primera carga (load.data todavía vacío).
            Los refrescos siguen mostrando la lista: antes cada refresco —y el SSE
            dispara uno por cada clic— la borraba y parecía que se pegaba. */}
        {load.loading && !load.data ? (
          <div className="ord" style={{ color: "var(--muted)" }}>Cargando pedidos…</div>
        ) : orders.length === 0 ? (
          // Sin datos + error de red decía "la cola está al día", que es mentira:
          // avisar que no se pudo cargar en vez de dar por vacía la cola.
          load.error && !load.data ? (
            <div className="ord" style={{ color: "var(--danger)" }}>No se pudo cargar la cola de pedidos. Se reintenta solo en unos segundos.</div>
          ) : (
            <div className="ord" style={{ color: "var(--muted)" }}>No hay pedidos por preparar. La cola está al día.</div>
          )
        ) : (
          orders.map((o) => {
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
                {o.status === "paid"
                  ? (puedeTomar(o)
                    ? <div style={{ fontSize: 12.5, color: "var(--magenta,#004568)", fontWeight: 700 }}>Nuevo · disponible para preparar</div>
                    : <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Reservado</div>)
                  : <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{done}/{o.items.length} ítems preparados</div>}
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
          <div className="empty">Selecciona un pedido de la cola para comenzar a prepararlo.</div>
        ) : (
          <>
            <div className="card-h">
              <h2>Preparación · {ordNum(sel)}</h2>
              <div className="spacer" />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{ordCust(sel)}</span>
            </div>
            <div className="prog" style={{ marginTop: 14 }}>
              <i style={{ width: (totalItems ? (pickedCount / totalItems) * 100 : 0) + "%" }} />
            </div>

            {sel.status === "paid" ? (
              <div style={{ margin: "12px 18px 4px", padding: "12px 14px", borderRadius: 12, background: "#f4f9ee", border: "1px solid var(--rosa-soft,#E8F4CE)" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Pedido nuevo en cola
                  {badgeAsignado(sel)}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Tómalo para empezar a prepararlo. Quedará a tu cargo y pasará a “En preparación”.</div>
                <button className="btn btn-primary" style={tap} onClick={tomar} disabled={busy || !puedeTomar(sel)}>Tomar este pedido</button>
                {!puedeTomar(sel) ? (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#b45309", marginTop: 8 }}>
                    Este pedido está asignado a {sel.assigned_to?.label || "otra persona"}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {sel.items.map((it) => {
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
                      {allPicked ? "Empacar y marcar como listo" : `Faltan ${totalItems - pickedCount} ítems por preparar`}
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
