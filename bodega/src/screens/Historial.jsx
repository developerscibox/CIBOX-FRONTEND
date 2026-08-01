import { api, useLoad, usingMock } from "../api.js";
import { clp } from "../theme.js";

// Historial de boletas del propio vendedor (lo que vendió), más recientes primero.
// Cada venta queda guardada a su nombre en el sistema.

const ESTADO = {
  pending: { t: "Por pagar", bg: "#fef3c7", c: "#92400e" },
  paid: { t: "Cobrado", bg: "#dbeafe", c: "#1e40af" },
  preparing: { t: "En preparación", bg: "#fde7f1", c: "#9d174d" },
  ready: { t: "Listo", bg: "#dcfce7", c: "#166534" },
  delivered: { t: "Entregado", bg: "#ede9fe", c: "#6b21a8" },
  shipped: { t: "Despachado", bg: "#e0f2fe", c: "#075985" },
  cancelled: { t: "Anulado", bg: "#fee2e2", c: "#b91c1c" },
  refunded: { t: "Reembolsado", bg: "#ffe4e6", c: "#9f1239" },
};
const fecha = (x) => { try { return new Date(x).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "sin fecha"; } };

const MOCK = [
  { _id: "demo1", cliente: "Minimarket La Esquina", rut: "76.123.456-7", total: 84990, status: "delivered", fecha: "2026-06-26T11:20:00", items: 4 },
  { _id: "demo2", cliente: "Cliente mostrador", rut: null, total: 23980, status: "paid", fecha: "2026-06-26T10:55:00", items: 2 },
  { _id: "demo3", cliente: "Almacén Doña Rosa", rut: "15.987.654-3", total: 145600, status: "pending", fecha: "2026-06-26T10:30:00", items: 7 },
];

export default function Historial() {
  const { data, loading, error } = useLoad(() => api.misPedidos(50), usingMock ? MOCK : null, []);
  const pedidos = data || (usingMock ? MOCK : []);
  // Solo lo efectivamente cobrado: fuera "Por pagar", anulados y reembolsados.
  const totalVendido = pedidos.filter((p) => !["pending", "cancelled", "refunded"].includes(p.status)).reduce((a, p) => a + (p.total || 0), 0);

  if (loading && !data) return <div className="card" style={{ padding: 18 }}>Cargando tu historial…</div>;
  if (error && !data) return <div className="card" style={{ padding: 18, color: "var(--danger)" }}>No se pudo cargar: {error}</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card" style={{ padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Mis boletas</div><b style={{ fontSize: 18 }}>{pedidos.length}</b></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "var(--muted)" }}>Total vendido</div><b style={{ fontSize: 18, color: "var(--ok)" }}>{clp(totalVendido)}</b><div style={{ fontSize: 10.5, color: "var(--muted)" }}>últimas 50 boletas · sin “Por pagar”</div></div>
      </div>

      {pedidos.length === 0 ? (
        <div className="card" style={{ padding: 22, color: "var(--muted)", textAlign: "center" }}>Aún no hay ventas registradas. Registre el primer pedido en <b>Vender</b>.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pedidos.map((p) => {
            const e = ESTADO[p.status] || { t: p.status || "Sin estado", bg: "var(--border-soft)", c: "var(--muted)" };
            return (
              <div key={p._id} className="card" style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.cliente}{p.rut ? <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}> · {p.rut}</span> : null}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>#{String(p._id).slice(-6).toUpperCase()} · {p.items} ítems · {fecha(p.fecha)}</div>
                </div>
                <span className="badge" style={{ background: e.bg, color: e.c, whiteSpace: "nowrap" }}>{e.t}</span>
                <b style={{ minWidth: 78, textAlign: "right" }}>{clp(p.total)}</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
