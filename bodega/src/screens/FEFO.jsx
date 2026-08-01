import { api, useLoad, usingMock } from "../api.js";

// FEFO POR LOTE — despacho preciso por lote, ordenado por el que vence antes.
// Usa /inventory/lotes/expiring (capa de lotes Fase B). Si no hay lotes (catálogo
// legacy sin recepción por lote), cae al endpoint producto-nivel /expiring-soon
// para no perder cobertura. Datos demo de respaldo.

const colorDias = (d) => (d == null ? "inherit" : d <= 3 ? "var(--danger)" : d <= 7 ? "var(--warn)" : "inherit");

const dayOffset = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const daysLeft = (d) => {
  if (!d) return null;
  const ms = new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Number.isNaN(ms) ? null : Math.round(ms / 86400000);
};

// Mock por LOTE (mismo shape que /inventory/lotes/expiring).
const MOCK = {
  items: [
    { batch_id: "b2", lot_code: "R260620-3", product_name: "Yogurt natural 1L", qty_remaining: 24, expiry_date: dayOffset(3), days_left: 3, location: { code: "A-03-5" } },
    { batch_id: "b1", lot_code: "R260624-1", product_name: "Leche entera 1L", qty_remaining: 180, expiry_date: dayOffset(7), days_left: 7, location: { code: "A-03-2" } },
    { batch_id: "b4", lot_code: "R260615-2", product_name: "Pan de molde grande", qty_remaining: 18, expiry_date: dayOffset(10), days_left: 10, location: { code: "B-01-3" } },
    { batch_id: "b5", lot_code: "R260610-1", product_name: "Jamón pierna 1kg", qty_remaining: 8, expiry_date: dayOffset(20), days_left: 20, location: { code: "F-02-1" } },
  ],
  count: 4,
};

// Normaliza una fila de lote o de producto-nivel (fallback) a un shape común.
const normLote = (b) => ({
  key: b.batch_id || b._id,
  lote: b.lot_code || null,
  name: b.product_name || b.name || "Sin nombre",
  qty: b.qty_remaining,
  expiry_date: b.expiry_date,
  days_left: b.days_left != null ? b.days_left : daysLeft(b.expiry_date),
  location: typeof b.location === "string" ? b.location : (b.location?.code || ""),
  porLote: true,
});
const normProducto = (p) => ({
  key: p._id,
  lote: null,
  name: p.name || "Sin nombre",
  qty: p.stock,
  expiry_date: p.expiry_date,
  days_left: p.days_left != null ? p.days_left : daysLeft(p.expiry_date),
  location: "",
  porLote: false,
});

export default function FEFO() {
  // 1ª opción: lotes por vencer. 2º: si vienen 0 lotes, fallback producto-nivel.
  const lotes = useLoad(() => api.lotesExpiring(60), MOCK, []);
  const loteItems = usingMock ? MOCK.items : (lotes.data?.items || []);
  const useFallback = !usingMock && !lotes.loading && loteItems.length === 0;
  const legacy = useLoad(
    () => (useFallback ? api.expiringSoon(60) : Promise.resolve({ items: [] })),
    { items: [] },
    [useFallback],
  );

  if (lotes.loading) return <div className="card" style={{ padding: 20 }}>Cargando…</div>;

  const rows = useFallback
    ? (legacy.data?.items || []).map(normProducto)
    : loteItems.map(normLote);
  rows.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
  const porLote = !useFallback;

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>FEFO por lote</h2>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        First-Expired-First-Out {porLote ? "por lote" : "(productos legacy sin lote)"}: se despacha primero el lote que vence antes · {rows.length} {porLote ? (rows.length === 1 ? "lote" : "lotes") : (rows.length === 1 ? "producto" : "productos")} en los próximos 60 días
      </div>

      {!rows.length ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Sin vencimientos próximos</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Ningún lote vence en los próximos 60 días.</div>
        </div>
      ) : (
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: porLote ? 640 : 480 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-soft)", textAlign: "left" }}>
              <th style={th}>Producto</th>
              {porLote ? <th style={th}>Lote</th> : null}
              <th style={{ ...th, textAlign: "center" }}>Vence</th>
              <th style={{ ...th, textAlign: "center" }}>Días</th>
              <th style={{ ...th, textAlign: "right" }}>{porLote ? "Restante" : "Stock"}</th>
              {porLote ? <th style={th}>Ubicación</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.key} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                {porLote ? (
                  <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 13, fontWeight: 700 }}>
                    {p.lote || <span style={{ color: "var(--muted)", fontWeight: 400, fontFamily: "inherit" }}>Sin código</span>}
                  </td>
                ) : null}
                <td style={{ ...td, textAlign: "center", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {p.expiry_date ? String(p.expiry_date).slice(0, 10) : "Sin fecha"}
                </td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, color: colorDias(p.days_left), whiteSpace: "nowrap" }}>
                  {p.days_left != null ? (p.days_left < 0 ? `Vencido hace ${Math.abs(p.days_left)} d` : `${p.days_left} d`) : <span style={{ color: "var(--muted)", fontWeight: 400 }}>Sin dato</span>}
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{p.qty != null ? `${p.qty} u` : <span style={{ color: "var(--muted)" }}>Sin dato</span>}</td>
                {porLote ? (
                  <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 13 }}>
                    {p.location || <span style={{ color: "var(--muted)", fontFamily: "inherit" }}>Sin asignar</span>}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

const th = { padding: "10px 14px", fontWeight: 700, color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "9px 14px" };
