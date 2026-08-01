import { useEffect, useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { llamarSiguienteTurno } from "../turnosApi.js";
import { LOW_STOCK_RES } from "../data.js";
import { t, clp } from "../theme.js";

// Venta manual presencial — registra una venta que NO pasó por la app.
// Descuenta stock y deja el movimiento en el kardex, igual que una venta web.
// Payload backend: POST /orders/admin/manual
//   { items:[{product_id, cajas}], customer:{fullName, rut?}, payment_method, status:'delivered' }
export default function VentaManual() {
  // Catálogo para el selector: productos con stock (el validador exige
  // in_stock "true"/"false" y acepta limit hasta 500).
  const [prodNonce, setProdNonce] = useState(0);
  const prod = useLoad(() => api.products({ in_stock: "true", limit: 500 }), LOW_STOCK_RES, [prodNonce]);
  const products = prod.data?.items || [];

  // Líneas de la venta: { product_id, cajas }
  const [lines, setLines] = useState([{ product_id: "", cajas: 1 }]);
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_pickup");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  // ── Atención de fila: módulo del vendedor + turno que está atendiendo ────────
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(() => {
    try { return localStorage.getItem("b12_modulo") || ""; } catch { return ""; }
  });
  const [attending, setAttending] = useState(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callMsg, setCallMsg] = useState("");
  const [waiting, setWaiting] = useState([]); // clientes en espera de ser atendidos

  function refreshWaiting() {
    if (usingMock) return;
    api.turnosAdmin()
      .then((d) => setWaiting((d.items || []).filter((x) => x.status === "waiting")))
      .catch(() => { /* sin conexión */ });
  }

  useEffect(() => {
    if (usingMock) return;
    api.modules(true)
      .then((d) => {
        const list = d.items || [];
        setModules(list);
        setSelectedModule((cur) => cur || (list[0]?.name ?? ""));
      })
      .catch(() => { /* sin módulos configurados */ });
    // Cola de espera en vivo: avisa cuando hay clientes esperando.
    refreshWaiting();
    const id = setInterval(refreshWaiting, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseModule(name) {
    setSelectedModule(name);
    try { localStorage.setItem("b12_modulo", name); } catch { /* sin storage */ }
  }

  async function callNext() {
    if (callBusy || usingMock) return;
    setCallBusy(true); setCallMsg("");
    try {
      // Fila de TIENDA (T-…): los turnos de pedidos de internet (P-…) los llama la Caja.
      const d = await llamarSiguienteTurno({ module: selectedModule || undefined, tipo: "compra" });
      if (!d.turno) {
        setAttending(null);
        setCallMsg("No hay turnos en espera.");
      } else {
        setAttending({ id: d.turno._id, code: d.turno.code, name: d.turno.name, module: d.turno.module });
        setFullName(d.turno.name || ""); // precarga el nombre del cliente en la venta
      }
      refreshWaiting();
    } catch (e) { setCallMsg(e.message); } finally { setCallBusy(false); }
  }

  async function skipAttending() {
    if (!attending?.id || callBusy || usingMock) return;
    setCallBusy(true);
    try { await api.cancelTurno(attending.id); setAttending(null); setCallMsg("Turno anulado (no se presentó)."); refreshWaiting(); }
    catch (e) { setCallMsg(e.message); } finally { setCallBusy(false); }
  }

  const byId = useMemo(() => {
    const m = {};
    for (const p of products) m[p._id] = p;
    return m;
  }, [products]);

  // Estima cajas → unidades con box_qty del tier de mayor min_qty (o tiers[].box_qty).
  function boxQty(p) {
    const tiers = p?.pricing?.tiers || [];
    if (!tiers.length) return 1;
    const box = tiers.reduce((a, b) => ((b.min_qty || 0) > (a.min_qty || 0) ? b : a), tiers[0]);
    return Number(box.box_qty || box.min_qty || 1) || 1;
  }
  // Precio por UNIDAD del tier caja (server recalcula; esto es solo estimación visual).
  function unitPrice(p) {
    const tiers = p?.pricing?.tiers || [];
    if (!tiers.length) return Number(p?.price || 0);
    const box = tiers.reduce((a, b) => ((b.min_qty || 0) > (a.min_qty || 0) ? b : a), tiers[0]);
    return Number(box.price || p?.price || 0);
  }

  function lineTotal(l) {
    const p = byId[l.product_id];
    if (!p) return 0;
    return boxQty(p) * unitPrice(p) * (Number(l.cajas) || 0);
  }

  const total = lines.reduce((a, l) => a + lineTotal(l), 0);

  const validLines = lines.filter((l) => l.product_id && Number(l.cajas) >= 1);
  const canSubmit = !busy && fullName.trim() && validLines.length > 0;

  function setLine(i, patch) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { product_id: "", cajas: 1 }]);
  }
  function removeLine(i) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));
  }

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setDone(null);

    // Contrato del backend (manualOrderSchema): customer / payment_method / status planos.
    const payload = {
      items: validLines.map((l) => ({ product_id: l.product_id, cajas: Number(l.cajas) })),
      customer: { fullName: fullName.trim(), ...(rut.trim() ? { rut: rut.trim() } : {}) },
      payment_method: paymentMethod,
      // La venta manual entra al flujo de bodega: queda "pagada" → pasa a
      // preparación (Picking) → lista → el cliente la retira. No se entrega de una.
      status: "paid",
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      const res = usingMock
        ? { order_number: "DEMO-0001", total }
        : await api.createManualOrder(payload); // → { order: {...} }
      const o = res?.order || res || {};
      setDone({
        number: o._id ? "#" + String(o._id).slice(-6).toUpperCase() : (o.order_number || "sin número"),
        total: o.total ?? total,
        items: validLines.length,
        client: fullName.trim(),
      });
      // Si veníamos atendiendo un turno, ciérralo (best-effort).
      if (attending?.id) {
        api.doneTurno(attending.id).catch(() => {});
        setAttending(null);
      }
      // Reset del formulario para la siguiente venta.
      setLines([{ product_id: "", cajas: 1 }]);
      setFullName("");
      setRut("");
      setNotes("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      {/* ── Atención de fila: llamar al siguiente con módulo ─────────────────── */}
      <div className="card" style={{ padding: 18 }}>
        <div className="card-h" style={{ border: 0, padding: 0, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Atención de fila</h2>
          {waiting.length > 0 ? (
            <span className="fila-wait" style={{ background: t.magenta, color: "#fff", fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "3px 11px" }}>
              {waiting.length} en espera
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {modules.length > 0 ? (
            <label style={{ fontSize: 13, color: t.muted, display: "flex", alignItems: "center", gap: 6 }}>
              Tu módulo:
              <select
                value={selectedModule}
                onChange={(e) => chooseModule(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
              >
                {modules.map((m) => <option key={m._id} value={m.name}>{m.name}</option>)}
              </select>
            </label>
          ) : (
            <span style={{ fontSize: 13, color: t.muted }}>
              Sin módulos configurados (Reportes · admin → Módulos). Igual puedes llamar al siguiente.
            </span>
          )}
          <button className="btn btn-primary" onClick={callNext} disabled={callBusy || usingMock}>
            Llamar al siguiente
          </button>
        </div>

        {/* Cola de espera: quién está esperando ser atendido */}
        {waiting.length > 0 ? (
          <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 12, background: "#fdf2f8", border: `1px solid ${t.rosaSoft}`, fontSize: 13.5 }}>
            <b style={{ color: t.magenta }}>{waiting.length} cliente{waiting.length === 1 ? "" : "s"} en espera</b> — toca “Llamar al siguiente” para atender.
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {waiting.slice(0, 12).map((w) => (
                <span key={w._id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px", fontSize: 12.5 }}>
                  <b style={{ fontFamily: "ui-monospace,monospace", color: "var(--magenta-d)" }}>{w.code}</b> · {w.name}
                </span>
              ))}
              {waiting.length > 12 ? <span style={{ color: t.muted, fontSize: 12.5 }}>+{waiting.length - 12}</span> : null}
            </div>
          </div>
        ) : !attending && !usingMock ? (
          <div className="hint" style={{ marginTop: 10 }}>Nadie en espera por ahora.</div>
        ) : null}

        {attending ? (
          <div className="ok-msg" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              Atendiendo: <b>{attending.code}</b> · {attending.name}
              {attending.module ? ` (${attending.module})` : ""} — su nombre ya está en el formulario.
            </span>
            <button className="btn" style={{ padding: "6px 10px", fontSize: 13, color: t.danger }} onClick={skipAttending} disabled={callBusy}>
              ✕ No se presentó
            </button>
          </div>
        ) : callMsg ? (
          <div className="hint" style={{ marginTop: 8 }}>{callMsg}</div>
        ) : null}
      </div>

      {/* ── Venta manual presencial ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-h"><h2>Venta manual presencial</h2></div>
      {prod.error ? (
        <div className="ok-msg" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c", margin: "12px 20px 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>No se pudo cargar el catálogo: {prod.error}</span>
          <button type="button" className="btn" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setProdNonce((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      ) : null}
      <form className="form" style={{ padding: 20 }} onSubmit={submit}>
        {/* ── Líneas de productos ─────────────────────────────────────────── */}
        <div className="field">
          <label>Productos · venta por caja</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.map((l, i) => {
              const p = byId[l.product_id];
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <select
                    style={{ flex: "1 1 280px", minWidth: 220 }}
                    value={l.product_id}
                    onChange={(e) => setLine(i, { product_id: e.target.value })}
                    disabled={prod.loading}
                  >
                    <option value="">{prod.loading ? "Cargando…" : "Seleccionar producto…"}</option>
                    {products.map((pr) => (
                      <option key={pr._id} value={pr._id}>{pr.name} · stock {pr.stock}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    style={{ width: 92 }}
                    value={l.cajas}
                    onChange={(e) => setLine(i, { cajas: Number(e.target.value) })}
                    aria-label="Cajas"
                    title="Cantidad en cajas"
                  />
                  <div style={{ minWidth: 96, textAlign: "right", paddingTop: 9, fontWeight: 600, color: t.text }}>
                    {clp(lineTotal(l))}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "8px 12px", color: t.danger }}
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    title="Quitar línea"
                  >✕</button>
                  {p ? (
                    <div style={{ flexBasis: "100%", fontSize: 12, color: t.muted, marginTop: -2 }}>
                      {boxQty(p)} u/caja · {clp(unitPrice(p))} c/u — total línea {boxQty(p) * (Number(l.cajas) || 0)} u
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn" style={{ marginTop: 10, alignSelf: "flex-start" }} onClick={addLine}>
            + Agregar producto
          </button>
        </div>

        {/* ── Cliente ─────────────────────────────────────────────────────── */}
        <div className="field">
          <label>Cliente <span style={{ color: "var(--danger)" }}>*</span></label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre del cliente"
          />
        </div>
        <div className="field">
          <label>RUT · opcional</label>
          <input
            type="text"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="Ej: 12.345.678-9"
          />
        </div>

        {/* ── Pago ────────────────────────────────────────────────────────── */}
        <div className="field">
          <label>Método de pago</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash_on_pickup">Efectivo</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>

        <div className="field">
          <label>Nota · opcional</label>
          <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observación interna de la venta" />
        </div>

        {/* ── Total estimado ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 14px", borderRadius: 10, background: "#fce7f3",
            border: `1px solid ${t.rosaSoft}`, fontWeight: 700, color: t.text,
          }}
        >
          <span>Total estimado</span>
          <span style={{ fontSize: 20, color: t.magenta }}>{clp(total)}</span>
        </div>
        <div className="hint">
          El precio definitivo lo calcula el servidor (tier por caja). Se descuenta stock y se escribe el kardex en una sola transacción.
        </div>

        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {busy ? "Registrando venta…" : "Registrar venta"}
        </button>

        {error ? (
          <div className="ok-msg" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" }}>
            No se pudo registrar: {error}
          </div>
        ) : null}
        {done ? (
          <div className="ok-msg">
            ✓ Venta registrada — pedido <b>{done.number}</b> para “{done.client}”
            {done.total != null ? <> por <b>{clp(done.total)}</b></> : null} ({done.items} ítem{done.items === 1 ? "" : "s"}).
            <div style={{ fontWeight: 400, fontSize: 13, marginTop: 4 }}>
              Stock descontado y movimiento de venta escrito en el kardex.
            </div>
          </div>
        ) : null}
      </form>
      </div>
    </div>
  );
}
