import { api, useLoad } from "../api.js";
import { MOVEMENTS_RES } from "../data.js";
import { t, clp, MOVEMENT } from "../theme.js";

const CAT_COLORS = ["#4E9B27", "#2E6116", "#C3E062", "#2E6116", "#3B7A1D", "#6B8F4E", "#A8CC7A", "#7BA84F"];
const SUMMARY_FALLBACK = { totals: { sku: 0, units: 0, cajas: 0, low: 0, value: 0 }, by_category: [], top_products: [] };

// Mock para modo demostración (usingMock) de "Productos por vencer".
const dayOffset = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10); // YYYY-MM-DD
};
const EXPIRING_MOCK = {
  items: [
    { _id: "e1", name: "Yogur Natural 1L", stock: 8, expiry_date: dayOffset(-2), days_left: -2 },
    { _id: "e2", name: "Pan de molde integral", stock: 12, expiry_date: dayOffset(3), days_left: 3 },
    { _id: "e3", name: "Leche entera 1L", stock: 24, expiry_date: dayOffset(6), days_left: 6 },
    { _id: "e4", name: "Jamón laminado 500g", stock: 5, expiry_date: dayOffset(18), days_left: 18 },
  ],
  count: 4,
};

// Formatea YYYY-MM-DD a fecha es-CL legible.
const fmtDate = (s) => {
  if (!s) return "Sin fecha";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Productos por vencer ────────────────────────────────────────────────────────
function ExpiringSoon() {
  const exp = useLoad(() => api.expiringSoon(30), EXPIRING_MOCK, []);
  const items = exp.data?.items || [];

  return (
    <div className="card">
      <div className="card-h">
        <h2>Productos por vencer</h2>
        <div className="spacer" />
        <span style={{ fontSize: 13, color: t.muted }}>próximos 30 días</span>
      </div>
      {exp.loading ? (
        <div style={{ padding: 18, color: t.muted }}>Cargando vencimientos…</div>
      ) : exp.error ? (
        <div style={{ padding: 18, color: t.danger }}>Error: {exp.error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 22, textAlign: "center", color: t.muted, fontSize: 14 }}>
          Sin productos próximos a vencer en los próximos 30 días.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: "center" }}>Stock</th>
              <th>Vencimiento</th>
              <th style={{ textAlign: "right" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const dl = Number(it.days_left);
              const vencido = dl < 0;
              const critico = !vencido && dl <= 7;
              const badgeBg = vencido ? "#fee2e2" : critico ? "#fef3c7" : "#eef4e7";
              const badgeText = vencido ? "#b91c1c" : critico ? "#92400e" : t.muted;
              const label = vencido
                ? "VENCIDO"
                : dl === 0
                ? "Vence hoy"
                : `${dl} día${dl === 1 ? "" : "s"}`;
              return (
                <tr key={it._id}>
                  <td>
                    <b style={{ color: vencido ? t.danger : t.text }}>{it.name}</b>
                  </td>
                  <td style={{ textAlign: "center" }}>{it.stock}</td>
                  <td style={{ color: t.muted, fontSize: 13.5 }}>{fmtDate(it.expiry_date)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: badgeBg,
                        color: badgeText,
                      }}
                    >
                      {label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function Donut({ data, size = 190, thickness = 28, centerLabel = "unidades" }) {
  const total = data.reduce((a, d) => a + (d.value || 0), 0) || 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
      <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
        <circle r={r} fill="none" stroke="#eef4e7" strokeWidth={thickness} />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={i} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return el;
        })}
      </g>
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="24" fontWeight="800" fill={t.text}>{total}</text>
      <text x={size / 2} y={size / 2 + 17} textAnchor="middle" fontSize="11" fill={t.muted}>{centerLabel}</text>
    </svg>
  );
}

// ── Barras horizontales ───────────────────────────────────────────────────────
function HBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Sin datos.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
            <span style={{ fontWeight: 600, color: t.text }}>{it.label}</span>
            <span style={{ color: t.muted, fontWeight: 600 }}>{it.display ?? it.value}</span>
          </div>
          <div style={{ height: 10, background: "#eef4e7", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: it.color || t.magenta, borderRadius: 6, minWidth: it.value > 0 ? 4 : 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Inventario({ onNav } = {}) {
  const sum = useLoad(() => api.stockSummary(10), SUMMARY_FALLBACK);
  const mov = useLoad(() => api.movements({ limit: 200 }), MOVEMENTS_RES);
  // Conteo de productos bajo su mínimo → banner que enlaza a Reposición.
  const reorder = useLoad(
    () => (api.reorderList ? api.reorderList() : Promise.resolve({ count: 0, items: [] })),
    { count: 0, items: [] },
  );
  const reorderCount = reorder.data?.count ?? 0;

  const data = sum.data || SUMMARY_FALLBACK;
  const totals = data.totals || {};
  const cats = (data.by_category || []).map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] }));
  const top = data.top_products || [];
  const movItems = mov.data?.items || [];

  // Movimientos por tipo (conteo) desde el kardex.
  const byType = {};
  for (const m of movItems) byType[m.type] = (byType[m.type] || 0) + 1;
  const movBars = Object.entries(byType)
    .map(([type, n]) => ({ label: MOVEMENT[type]?.label || type, value: n, color: MOVEMENT[type]?.color || t.morado }))
    .sort((a, b) => b.value - a.value);

  const kpis = [
    { ic: "📦", bg: "#e9f3da", v: totals.sku ?? 0, l: "SKUs activos" },
    { ic: "🟪", bg: "#fde7f1", v: (totals.cajas ?? 0).toLocaleString("es-CL"), l: "Cajas en bodega" },
    { ic: "🔢", bg: "#e0f2fe", v: (totals.units ?? 0).toLocaleString("es-CL"), l: "Unidades sueltas" },
    { ic: "💰", bg: "#ede9fe", v: clp(totals.value ?? 0), l: "Valor venta del inventario" },
  ];

  if (sum.loading) {
    return <div className="card" style={{ padding: 24, color: t.muted }}>Cargando inventario…</div>;
  }
  if (sum.error) {
    return <div className="card" style={{ padding: 24, color: t.danger }}>Error: {sum.error}</div>;
  }

  return (
    <div>
      {reorderCount > 0 ? (
        <button
          type="button"
          onClick={() => onNav && onNav("reposicion")}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            textAlign: "left", cursor: "pointer", marginBottom: 16,
            background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12,
            padding: "12px 16px", color: "#92400e", fontSize: 14, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ flex: 1 }}>
            {reorderCount} producto{reorderCount === 1 ? "" : "s"} bajo mínimo — revisa la reposición
          </span>
          <span style={{ fontWeight: 700 }}>Ir a Reposición →</span>
        </button>
      ) : null}

      <div className="kpis">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="ic" style={{ background: k.bg }}>{k.ic}</div>
            <div className="v">{k.v}</div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="dash-row">
        {/* Donut por categoría */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h"><h2>Cajas por categoría</h2></div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", padding: "6px 4px" }}>
            <Donut data={cats.map((c) => ({ value: c.cajas, color: c.color }))} centerLabel="cajas" />
            <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 8 }}>
              {cats.length === 0 ? (
                <span style={{ color: t.muted, fontSize: 13 }}>Sin productos cargados.</span>
              ) : cats.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: c.color, flex: "0 0 auto" }} />
                  <span style={{ fontWeight: 600, color: t.text, flex: 1 }}>{c.category}</span>
                  <span style={{ color: t.muted }}>{c.cajas} cajas · {c.units} u</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movimientos por tipo */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2>Movimientos por tipo</h2>
            <div className="spacer" />
            <span style={{ fontSize: 13, color: t.muted }}>{movItems.length} en kardex</span>
          </div>
          <div style={{ padding: "6px 2px" }}>
            <HBars items={movBars} />
          </div>
        </div>
      </div>

      {/* Top productos por cajas */}
      <div className="card">
        <div className="card-h">
          <h2>Top productos por cajas</h2>
          <div className="spacer" />
          <span style={{ fontSize: 13, color: t.muted }}>cajas disponibles</span>
        </div>
        <div style={{ padding: "6px 2px" }}>
          <HBars items={top.map((p) => ({
            label: p.name,
            value: p.cajas,
            display: `${p.cajas} cajas · ${p.stock} u`,
            color: p.stock <= 10 ? t.danger : t.magenta,
          }))} />
        </div>
      </div>

      {/* Productos por vencer (control de caducidad) */}
      <ExpiringSoon />
    </div>
  );
}
