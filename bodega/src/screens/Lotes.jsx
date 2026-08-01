import { useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { t, clp } from "../theme.js";

// Lotes (capa aditiva Fase B) — ledger paralelo de Batch. Doble función:
//  • Trazabilidad: qué lotes hay, de qué proveedor/doc, dónde y vencimiento.
//  • Histórico de costos: costo de compra por lote a lo largo del tiempo, y
//    valor del inventario a COSTO (Σ qty_remaining × unit_cost).
// Product.stock sigue siendo la verdad de disponibilidad; esto es un ledger.

// Días restantes a un vencimiento (YYYY-MM-DD o ISO). null si no hay fecha.
const daysLeft = (d) => {
  if (!d) return null;
  const ms = new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Number.isNaN(ms) ? null : Math.round(ms / 86400000);
};

const fmtDate = (s) => {
  if (!s) return null;
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

// Badge de vencimiento por urgencia (mismo lenguaje visual que ExpiringSoon).
function VencBadge({ expiry }) {
  const dl = daysLeft(expiry);
  if (dl == null) return <span style={{ color: t.muted, fontSize: 13 }}>sin fecha</span>;
  const vencido = dl < 0;
  const critico = !vencido && dl <= 7;
  const proximo = !vencido && !critico && dl <= 30;
  const bg = vencido ? "#fee2e2" : critico ? "#fef3c7" : proximo ? "#fde7f1" : "#eef4e7";
  const fg = vencido ? "#b91c1c" : critico ? "#92400e" : proximo ? "#6B8F4E" : t.muted;
  const label = vencido ? "VENCIDO" : dl === 0 ? "Vence hoy" : `${dl} día${dl === 1 ? "" : "s"}`;
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color: fg }}>
      {label}
    </span>
  );
}

// Datos demo (sin backend): 3 lotes representativos.
const today = new Date();
const dayOffset = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const MOCK = {
  items: [
    {
      _id: "b1", product_name: "Leche entera 1L", lot_code: "R260624-1",
      qty_received: 240, qty_remaining: 180, unit_cost: 690, expiry_date: dayOffset(12),
      location: { code: "A-03-2" }, supplier: "Distribuidora Sur", doc_ref: "Factura 12345",
      status: "open", received_at: dayOffset(-2), received_by: { label: "Recepción · operario" },
    },
    {
      _id: "b2", product_name: "Yogurt natural 1L", lot_code: "R260620-3",
      qty_received: 120, qty_remaining: 24, unit_cost: 820, expiry_date: dayOffset(4),
      location: { code: "A-03-5" }, supplier: "Distribuidora Sur", doc_ref: "Factura 12290",
      status: "open", received_at: dayOffset(-6), received_by: { label: "Recepción · operario" },
    },
    {
      _id: "b3", product_name: "Arroz grado 1 · 1kg", lot_code: "R260601-2",
      qty_received: 300, qty_remaining: 0, unit_cost: 1050, expiry_date: dayOffset(300),
      location: { code: "C-11-1" }, supplier: "Comercial Andes", doc_ref: "Guía 8842",
      status: "depleted", received_at: dayOffset(-25), received_by: { label: "Recepción · operario" },
    },
  ],
  count: 3,
};

export default function Lotes() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open"); // open | depleted | todos

  // El backend filtra por status (default open) y soporta el sentinel "todos"
  // (sin filtro). Se manda siempre: omitirlo haría que "Todos" mostrara solo open.
  // limit 200 = máximo del backend (listBatches capea ahí).
  const { data, loading, error } = useLoad(
    () => api.lotes({ status, limit: 200 }),
    MOCK,
    [status],
  );

  const all = usingMock ? MOCK.items : (data?.items || []);
  // Si hay más lotes que la página cargada, el KPI de valor es parcial.
  const totalLotes = usingMock ? MOCK.count : (data?.pagination?.total ?? all.length);
  const kpiParcial = totalLotes > all.length;

  // Filtro de texto y de estado en cliente (cubre el modo demo y refina el server).
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((b) => {
      if (status !== "todos" && b.status !== status) return false;
      if (!needle) return true;
      return (
        String(b.product_name || "").toLowerCase().includes(needle) ||
        String(b.lot_code || "").toLowerCase().includes(needle)
      );
    });
  }, [all, q, status]);

  // KPIs sobre TODO el conjunto cargado (no sobre el filtro de texto).
  const kpis = useMemo(() => {
    const open = all.filter((b) => b.status === "open");
    const valor = open.reduce((a, b) => a + Number(b.qty_remaining || 0) * Number(b.unit_cost || 0), 0);
    const porVencer = open.filter((b) => {
      const dl = daysLeft(b.expiry_date);
      return dl != null && dl <= 30;
    }).length;
    return { abiertos: open.length, valor, porVencer };
  }, [all]);

  if (loading) return <div className="card" style={{ padding: 24, color: t.muted }}>Cargando lotes…</div>;

  return (
    <div>
      <div className="kpis">
        <div className="kpi">
          <div className="ic" style={{ background: "#fde7f1" }}>🧫</div>
          <div className="v">{kpis.abiertos}</div>
          <div className="l">Lotes abiertos</div>
        </div>
        <div className="kpi">
          <div className="ic" style={{ background: "#ede9fe" }}>💰</div>
          <div className="v">{clp(kpis.valor)}</div>
          <div className="l">{kpiParcial ? `Valor a costo (primeros ${all.length} de ${totalLotes} lotes)` : "Valor del inventario a costo"}</div>
        </div>
        <div className="kpi">
          <div className="ic" style={{ background: "#fef3c7" }}>⏰</div>
          <div className="v">{kpis.porVencer}</div>
          <div className="l">Lotes por vencer ≤30 días</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="card-h" style={{ flexWrap: "wrap", gap: 10 }}>
          <h2>Lotes · trazabilidad y costo</h2>
          <div className="spacer" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto o lote…"
            style={{ border: "1.5px solid var(--border)", borderRadius: 9, padding: "8px 12px", fontSize: 14, minWidth: 220 }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ border: "1.5px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 14 }}
          >
            <option value="open">Abiertos</option>
            <option value="depleted">Agotados</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {error ? (
          <div style={{ padding: 22, textAlign: "center", color: t.danger, fontSize: 14 }}>
            No se pudieron cargar los lotes: {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 22, textAlign: "center", color: t.muted, fontSize: 14 }}>
            {q ? "Ningún lote coincide con la búsqueda." : "Sin lotes registrados. Recibe mercadería para crear lotes."}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th style={{ textAlign: "right" }}>Restante / recibido</th>
                <th style={{ textAlign: "right" }}>Costo unit.</th>
                <th>Ubicación</th>
                <th>Recibido</th>
                <th>Proveedor / doc.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const rem = Number(b.qty_remaining || 0);
                const rec = Number(b.qty_received || 0);
                const agotado = b.status === "depleted" || rem === 0;
                return (
                  <tr key={b._id || b.batch_id} style={{ opacity: agotado ? 0.6 : 1 }}>
                    <td><b>{b.product_name || <span style={{ color: t.muted, fontWeight: 400 }}>Sin nombre</span>}</b></td>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{b.lot_code || <span style={{ color: t.muted, fontWeight: 400 }}>sin código</span>}</td>
                    <td><VencBadge expiry={b.expiry_date} /></td>
                    <td style={{ textAlign: "right" }}>
                      <b>{rem}</b> <span style={{ color: t.muted }}>/ {rec} u</span>
                      {agotado ? (
                        <span className="badge" style={{ marginLeft: 8, background: "#f3f4f6", color: "#6b7280" }}>agotado</span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {b.unit_cost != null ? clp(b.unit_cost) : <span style={{ color: t.muted, fontWeight: 400, fontSize: 13 }}>sin costo</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {b.location?.code ? <b className="mono">{b.location.code}</b> : <span style={{ color: t.muted }}>sin ubicación</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{fmtDate(b.received_at) || <span style={{ color: t.muted }}>sin registro</span>}</div>
                      {b.received_by?.label ? <div style={{ color: t.muted, fontSize: 12 }}>{b.received_by.label}</div> : null}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{b.supplier || <span style={{ color: t.muted }}>sin proveedor</span>}</div>
                      {b.doc_ref ? <div style={{ color: t.muted, fontSize: 12 }}>{b.doc_ref}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
