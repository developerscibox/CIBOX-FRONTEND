import { useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { clp } from "../theme.js";

// Logística inversa: aprueba/rechaza solicitudes de reembolso. El backend
// (refundController) repone el stock de forma idempotente y devuelve el dinero
// por Transbank al aprobar. Solo admin (las rutas /refunds/admin usan requireAdmin).
const MOCK = {
  items: [
    { _id: "r1", order_id: "650f1a2b3c4d5e6f7a8b9c01", type: "full", amount: 23980, status: "pending", reason: "Producto dañado", created_at: new Date().toISOString() },
    { _id: "r2", order_id: "650f1a2b3c4d5e6f7a8b9c02", type: "partial", amount: 4990, status: "processed", reason: "Faltante en la caja", created_at: new Date().toISOString() },
  ],
  total: 2,
};

const RF_STATUS = {
  pending: { label: "Pendiente", bg: "#fef3c7", text: "#92400e" },
  approved: { label: "Aprobado", bg: "#dcfce7", text: "#166534" },
  processed: { label: "Procesado", bg: "#dcfce7", text: "#166534" },
  rejected: { label: "Rechazado", bg: "#fee2e2", text: "#b91c1c" },
  failed: { label: "Falló", bg: "#fee2e2", text: "#b91c1c" },
};

function fmt(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return isNaN(d) ? "Sin fecha" : d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Refunds() {
  const [status, setStatus] = useState("");
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const res = useLoad(() => api.refundsAdmin({ status, limit: 100 }), MOCK, [status, nonce]);
  const items = res.data?.items || [];
  const refresh = () => setNonce((n) => n + 1);

  async function act(fn, ...args) {
    setBusy(true); setErr(""); setMsg("");
    try {
      if (usingMock) { setMsg("Acción simulada · demo."); return; }
      await fn(...args);
      setMsg("Reembolso actualizado.");
      refresh();
    } catch (e) {
      setErr(e.message || "No se pudo procesar el reembolso.");
    } finally {
      setBusy(false);
    }
  }
  function approve(r) {
    // eslint-disable-next-line no-alert
    if (window.confirm(`¿Aprobar el reembolso de ${clp(r.amount)}? Repone stock y devuelve el dinero por Transbank.`)) {
      act(api.approveRefund, r._id);
    }
  }
  function reject(r) {
    // eslint-disable-next-line no-alert
    const reason = window.prompt("Motivo del rechazo:");
    if (reason != null) act(api.rejectRefund, r._id, reason.trim() || "Sin motivo");
  }

  return (
    <div>
      <div className="filters">
        <div className="field">
          <label>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(RF_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {msg ? <div className="ok-msg" style={{ marginTop: 0, marginBottom: 14 }}>✓ {msg}</div> : null}
      {err ? <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "11px 16px", borderRadius: 12, fontWeight: 600, fontSize: 13.5, marginBottom: 14 }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-h">
          <h2>Devoluciones</h2>
          <span className="badge" style={{ background: "#e9f3da", color: "#6B8F4E" }}>{res.loading ? "…" : `${items.length}`}</span>
        </div>
        <table>
          <thead>
            <tr><th>Pedido</th><th>Tipo</th><th>Monto</th><th>Motivo</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {res.loading ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--muted)" }}>Cargando devoluciones…</td></tr>
            ) : res.error ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--danger)" }}>Error: {res.error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--muted)" }}>Sin devoluciones para el filtro actual.</td></tr>
            ) : items.map((r) => {
              const m = RF_STATUS[r.status] || { label: r.status, bg: "#f3f4f6", text: "#374151" };
              return (
                <tr key={r._id}>
                  <td className="mono" style={{ fontWeight: 700 }}>#{String(r.order_id).slice(-6)}</td>
                  <td>{r.type === "full" ? "Total" : "Parcial"}</td>
                  <td style={{ fontWeight: 700 }}>{clp(r.amount)}</td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{r.reason || "Sin motivo indicado"}</td>
                  <td style={{ fontSize: 13 }}>{fmt(r.created_at)}</td>
                  <td><span className="badge" style={{ background: m.bg, color: m.text }}>{m.label}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.status === "pending" ? (
                      <>
                        <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 13, marginRight: 6 }} disabled={busy} onClick={() => approve(r)}>Aprobar</button>
                        <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 13, color: "var(--danger)" }} disabled={busy} onClick={() => reject(r)}>Rechazar</button>
                      </>
                    ) : <span style={{ color: "var(--muted)", fontSize: 13 }}>{r.status === "processed" ? "Resuelto" : m.label}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usingMock ? <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>Modo demostración: las acciones no se persisten.</div> : null}
      </div>
    </div>
  );
}
