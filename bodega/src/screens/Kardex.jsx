import { useState } from "react";
import { api, useLoad } from "../api.js";
import { MOVEMENTS_RES } from "../data.js";
import { MOVEMENT } from "../theme.js";

const fdate = (s) =>
  new Date(s).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Kardex() {
  const [filter, setFilter] = useState("");
  const mv = useLoad(() => api.movements({ type: filter, limit: 100 }), MOVEMENTS_RES, [filter]);
  const rows = (mv.data?.items || []).filter((m) => !filter || m.type === filter);

  return (
    <div>
      <div className="card">
        <div className="card-h">
          <h2>Kardex de inventario</h2>
          <div className="spacer" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar por tipo de movimiento"
            style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}
          >
            <option value="">Todos los movimientos</option>
            {Object.entries(MOVEMENT).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock final</th><th>Motivo</th><th>Quién</th></tr>
          </thead>
          <tbody>
            {mv.loading ? (
              <tr><td colSpan="7" style={{ color: "var(--muted)", padding: 22, textAlign: "center" }}>Cargando kardex…</td></tr>
            ) : mv.error ? (
              <tr><td colSpan="7" style={{ color: "var(--danger)", padding: 22, textAlign: "center" }}>Error al cargar el kardex: {mv.error}</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ color: "var(--muted)", padding: "28px 22px", textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin movimientos registrados</div>
                  <div style={{ fontSize: 13 }}>{filter ? "No hay movimientos de este tipo. Prueba con otro filtro." : "Los movimientos de inventario aparecerán aquí."}</div>
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const meta = MOVEMENT[m.type] || { label: m.type, color: "#666" };
                return (
                  <tr key={m._id}>
                    <td className="mono" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fdate(m.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                    <td><span className="badge" style={{ background: meta.color + "1a", color: meta.color }}>{meta.label}</span></td>
                    <td className={m.quantity < 0 ? "qneg mono" : "qpos mono"}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                    <td className="mono">{m.stock_after ?? <span style={{ color: "var(--muted)" }}>Sin dato</span>}</td>
                    <td style={{ color: "var(--muted)", fontSize: 13 }}>{m.reason || <span style={{ fontStyle: "italic" }}>Sin motivo</span>}</td>
                    <td style={{ fontSize: 13 }}>{m.by?.label || "sistema"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
        Registro inmutable: cada movimiento se escribe en la misma transacción que el cambio de stock, así kardex y stock nunca se desincronizan.
      </p>
    </div>
  );
}
