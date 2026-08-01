import { useEffect, useState } from "react";
import { api, useLoad, usingMock, streamUrl } from "../api.js";

// RETIRO / MOSTRADOR — cierra el relay: la cajera entrega los pedidos LISTOS y los
// marca como retirados (ready→delivered). Antes este cierre dependía de abrir la lista
// general de "Pedidos"; sin dueño, el pedido quedaba "Listo" para siempre en el tablero.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const METODO = { cash_on_pickup: "Efectivo", transfer: "Transferencia", card: "Tarjeta", efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
const hora = (x) => { try { return new Date(x).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }); } catch { return "Sin hora"; } };

const MOCK = [
  { _id: "r1", customer: { fullName: "Minimarket La Esquina" }, total: 84990, packing: { bultos: 3 }, payment: { method: "transfer", status: "approved" }, created_at: new Date().toISOString() },
  { _id: "r2", customer: { fullName: "Cliente mostrador" }, total: 23980, packing: { bultos: 1 }, payment: { method: "cash_on_pickup", status: "approved" }, needs_review: true, created_at: new Date().toISOString() },
];

export default function Retiro() {
  const [tick, setTick] = useState(0);
  // Solo RETIRO en tienda: sin delivery_method=pickup se colaban pedidos web de despacho.
  const load = useLoad(() => (usingMock ? Promise.resolve({ orders: MOCK }) : api.orders({ status: "ready", delivery_method: "pickup", limit: 50 })), { orders: MOCK }, [tick]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [cobro, setCobro] = useState(null); // { order, monto } — cobro efectivo inline cuando el guard 409 exige cobrar antes de entregar
  const orders = load.data?.orders || [];

  useEffect(() => {
    if (usingMock) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", () => setTick((n) => n + 1)); } } catch { /* polling */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  async function entregar(o, confirmado = false) {
    if (!confirmado && !window.confirm(`¿Entregar el pedido #${String(o._id).slice(-6).toUpperCase()} de ${o.customer?.fullName || "Mostrador"}?`)) return false;
    setBusy(o._id); setMsg(null);
    try {
      if (!usingMock) await api.setOrderStatus(o._id, "delivered");
      setMsg({ ok: true, text: `#${String(o._id).slice(-6).toUpperCase()} entregado al cliente` });
      setCobro(null);
      setTick((n) => n + 1);
      return true;
    } catch (e) {
      if (e.status === 409 && /cobra/i.test(e.message || "")) {
        // Guard del backend: efectivo impago no se entrega — ofrecer el cobro aquí mismo.
        setCobro({ order: o, monto: "" });
        setMsg({ ok: false, text: `${e.message} Ingresa el efectivo recibido para cobrar y entregar.` });
      } else if (e.status === 409 || e.status === 403) { setTick((n) => n + 1); setMsg({ ok: false, text: "Ese pedido ya cambió de estado." }); }
      else setMsg({ ok: false, text: e.message });
      return false;
    } finally { setBusy(null); }
  }

  // Cobra el efectivo (pay-cash) y reintenta la entrega en un solo paso.
  async function cobrarYEntregar() {
    const o = cobro?.order;
    if (!o) return;
    const totalN = Math.round(Number(o.total) || 0);
    const recibido = Math.round(Number(cobro.monto) || 0);
    if (recibido < totalN) { setMsg({ ok: false, text: "El efectivo recibido es menor al total" }); return; }
    setBusy(o._id); setMsg(null);
    try {
      if (!usingMock) await api.markPaidCash(o._id, { amount_received: recibido });
      setCobro(null);
      const ok = await entregar(o, true);
      if (ok) setMsg({ ok: true, text: `#${String(o._id).slice(-6).toUpperCase()} cobrado (vuelto ${clp(recibido - totalN)}) y entregado` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="card" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 16 }}>Listos para retiro</b>
        <span className="badge" style={{ background: "#dcfce7", color: "var(--ok)" }}>{orders.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)", display: "inline-block" }} />
          en vivo
        </span>
      </div>

      {msg ? <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: msg.ok ? "#ecfdf3" : "#fee2e2", color: msg.ok ? "var(--ok)" : "var(--danger)", fontWeight: 600 }}>{msg.text}</div> : null}

      {/* Cobro efectivo inline: aparece cuando el backend exige cobrar antes de entregar (409) */}
      {cobro ? (
        <div className="card" style={{ marginBottom: 12, padding: "12px 14px", background: "#fff7e6" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Cobrar efectivo · #{String(cobro.order._id).slice(-6).toUpperCase()} · total {clp(cobro.order.total)}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input value={cobro.monto} onChange={(e) => setCobro((c) => ({ ...c, monto: e.target.value }))} inputMode="numeric" placeholder="Efectivo recibido $" autoFocus
              style={{ width: 150, padding: "9px 10px", fontSize: 15, borderRadius: 8, border: "1px solid var(--border-soft)" }} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              vuelto <b style={{ color: "var(--ok)" }}>{clp(Math.max(0, Math.round(Number(cobro.monto) || 0) - Math.round(Number(cobro.order.total) || 0)))}</b>
            </span>
            <button className="btn btn-primary" disabled={busy === cobro.order._id} onClick={cobrarYEntregar}>
              {busy === cobro.order._id ? "Procesando…" : "Cobrar y entregar"}
            </button>
            <button onClick={() => setCobro(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border-soft)", background: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="card" style={{ padding: "30px 26px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No hay pedidos listos para retirar</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Los pedidos aparecerán aquí en cuanto bodega los marque como listos.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {orders.map((o) => {
            const bultos = o.packing?.bultos;
            const metodo = METODO[o.payment?.method] || o.payment?.method || "Sin método";
            return (
              <div key={o._id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800 }}>
                    #{String(o._id).slice(-6).toUpperCase()} · {o.customer?.fullName || "Mostrador"}
                    {o.needs_review ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", background: "#fef3c7", borderRadius: 6, padding: "1px 6px", marginLeft: 8 }}>revisar</span> : null}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {clp(o.total)} · {metodo} · {bultos != null ? <b>{bultos} bulto{bultos === 1 ? "" : "s"}</b> : "Sin dato"} · listo {hora(o.status_history ? o.status_history[o.status_history.length - 1]?.changed_at : o.created_at)}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ minHeight: 46 }} disabled={busy === o._id} onClick={() => entregar(o)}>
                  {busy === o._id ? "Procesando…" : "Marcar retirada"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
