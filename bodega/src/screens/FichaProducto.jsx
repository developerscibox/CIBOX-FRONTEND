import { api, useLoad } from "../api.js";
import { Kpi, Tabla, Skel } from "../components/Ui.jsx";
import { clp } from "../theme.js";

// Ficha técnica de un producto: overlay grande con datos comerciales, tendencia
// de ventas (30 días), estado de bodega y lotes. Solo lectura — se abre desde
// la tabla de Productos con { productId, onClose }.

// Mock para el modo demostración (misma forma que GET /products/:id/ficha).
const MOCK_SERIE = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return { dia: d.toISOString().slice(0, 10), unidades: (i * 7) % 9 };
});
const MOCK_FICHA = {
  producto: {
    sku: "CIB-R01", barcode: "7801000001", nombre: "Aceite vegetal 900ml",
    categoria: "Abarrotes", imagen: "", is_active: true,
    precio_compra: 980, precio_venta: 1449, box_qty: 12,
    margen_bruto: 469, margen_pct: 32.4,
  },
  ventas: {
    por_dia: 4.2, por_semana: 29.4, por_mes: 126, unidades_30d: 126,
    monto_30d: 182574, serie_30d: MOCK_SERIE,
  },
  bodega: {
    stock: 120, reserved: 6, allocated: 10, disponible: 104,
    cobertura_dias: 28.5, edad_prom_stock_dias: 12.3, proxima_expiracion: "2026-10-15",
    lotes: [
      { lot_code: "L-2606-01", qty_remaining: 48, unit_cost: 980, received_at: "2026-06-10", expiry_date: "2026-10-15", dias_en_bodega: 23 },
      { lot_code: "L-2606-02", qty_remaining: 72, unit_cost: 995, received_at: "2026-06-24", expiry_date: "2027-01-30", dias_en_bodega: 9 },
    ],
  },
  meta: {},
};

const n1 = (x) => Number(x || 0).toLocaleString("es-CL", { maximumFractionDigits: 1 });
const num = (x) => (Number(x) || 0).toLocaleString("es-CL");
const fecha = (x) => (x ? new Date(x).toLocaleDateString("es-CL") : "—");
const diasHasta = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null);

// Color del margen: ≥25% ok, 10-25% warn, <10% danger.
const margenColor = (pct) =>
  pct == null ? "var(--muted)" : pct >= 25 ? "var(--ok)" : pct >= 10 ? "var(--warn)" : "var(--danger)";

// Estilo del badge de vencimiento según urgencia (≤7 d rojo, ≤30 d ámbar).
const venceStyle = (d) => {
  const dias = diasHasta(d);
  if (dias == null) return null;
  if (dias <= 7) return { background: "#fee2e2", color: "#b91c1c" };
  if (dias <= 30) return { background: "#fef3c7", color: "#92400e" };
  return { background: "#dcfce7", color: "#166534" };
};

function VenceBadge({ date }) {
  const s = venceStyle(date);
  if (!s) return <span style={{ color: "var(--muted)" }}>—</span>;
  const dias = diasHasta(date);
  return (
    <span className="badge" style={{ ...s, whiteSpace: "nowrap" }}>
      {fecha(date)}{dias < 0 ? " · vencido" : ` · ${dias} d`}
    </span>
  );
}

// Gráfico de área de la serie de 30 días: línea suave + degradado de marca,
// grilla ligera, peak destacado con su valor y punto final "hoy".
function Serie30({ data }) {
  const arr = data || [];
  const vals = arr.map((d) => Number(d.unidades) || 0);
  const max = Math.max(1, ...vals);
  const W = 760, H = 150, padL = 34, padR = 10, padTop = 16, padBot = 20;
  const iw = W - padL - padR, ih = H - padTop - padBot;
  const X = (i) => padL + (arr.length > 1 ? (i / (arr.length - 1)) * iw : iw / 2);
  const Y = (v) => padTop + ih - (v / max) * ih;
  const pts = vals.map((v, i) => [X(i), Y(v)]);

  // Curva suave (Catmull-Rom → Bézier) para que la línea no sea un serrucho.
  const d = pts.map((p, i, a) => {
    if (i === 0) return `M ${p[0]},${p[1]}`;
    const p0 = a[i - 2] || a[i - 1], p1 = a[i - 1], p2 = p, p3 = a[i + 1] || p;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }).join(" ");
  const area = `${d} L ${pts[pts.length - 1][0]},${H - padBot} L ${pts[0][0]},${H - padBot} Z`;

  const iMax = vals.indexOf(Math.max(...vals));
  const last = pts[pts.length - 1];
  const fmtDia = (s) => { const [, m, dd] = String(s).split("-"); return `${Number(dd)}/${Number(m)}`; };
  const everyLabel = Math.max(1, Math.ceil(arr.length / 8));
  const gid = "s30grad"; // el overlay es único: sin colisión de ids

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 150 }} role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--magenta)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--magenta)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grilla horizontal ligera con su escala */}
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={Y(max * f)} y2={Y(max * f)} stroke="var(--border-soft)" strokeWidth="1" strokeDasharray={f ? "3 4" : undefined} />
          <text x={padL - 6} y={Y(max * f) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {/* área + línea */}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke="var(--magenta-d)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* peak destacado con su valor */}
      {vals[iMax] > 0 ? (
        <g>
          <circle cx={pts[iMax][0]} cy={pts[iMax][1]} r="4" fill="#fff" stroke="var(--magenta-d)" strokeWidth="2.2" />
          <text x={pts[iMax][0]} y={Math.max(11, pts[iMax][1] - 9)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--magenta-d)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {vals[iMax]}
          </text>
        </g>
      ) : null}
      {/* punto final (hoy) */}
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--magenta-d)" />
      {/* fechas + columnas de hover con tooltip */}
      {arr.map((p, i) => (
        <g key={i}>
          <title>{`${fmtDia(p.dia)} · ${vals[i]} unidades`}</title>
          <rect x={X(i) - (iw / Math.max(1, arr.length - 1)) / 2} y="0" width={iw / Math.max(1, arr.length - 1)} height={H} fill="transparent" />
          {i % everyLabel === 0 ? (
            <text x={X(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{fmtDia(p.dia)}</text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function Titulo({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "18px 2px 8px" }}>
      {children}
    </div>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 };

export default function FichaProducto({ productId, onClose }) {
  const res = useLoad(() => api.ficha(productId), MOCK_FICHA, [productId]);
  const d = res.data;
  const p = d?.producto || {};
  const v = d?.ventas || {};
  const b = d?.bodega || {};
  const lotes = b.lotes || [];
  const diasVence = diasHasta(b.proxima_expiracion);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 880, maxWidth: "100%", marginBottom: 0, maxHeight: "94vh", overflowY: "auto" }}
      >
        <div className="card-h">
          <h2>Ficha técnica</h2>
          <div className="spacer" />
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        {res.loading ? (
          <div style={{ padding: "12px 4px", display: "grid", gap: 12 }}>
            <Skel h={84} />
            <Skel h={110} />
            <Skel h={140} />
            <Skel h={160} />
          </div>
        ) : res.error && !d ? (
          <div style={{ padding: "16px 4px", color: "var(--danger)" }}>No se pudo cargar la ficha: {res.error}</div>
        ) : (
          <div style={{ padding: "6px 4px 4px" }}>
            {/* ── Cabecera del producto ──────────────────────────────────── */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {p.imagen ? (
                <img src={p.imagen} alt={p.nombre || ""} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border-soft)", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 84, height: 84, borderRadius: 10, border: "1px solid var(--border-soft)", background: "#faf5f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }} aria-hidden="true">📦</div>
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{p.nombre || "—"}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, fontFamily: "ui-monospace,monospace" }}>
                  {[p.sku, p.barcode].filter(Boolean).join(" · ") || "sin códigos"}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  {p.categoria || "—"}
                </div>
              </div>
              <span className="badge" style={p.is_active ? { background: "#dcfce7", color: "#166534" } : { background: "#fee2e2", color: "#b91c1c" }}>
                {p.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            {/* ── Comercial + ventas ─────────────────────────────────────── */}
            <Titulo>Comercial y ventas</Titulo>
            <div style={grid}>
              <Kpi label="Precio compra" value={p.precio_compra != null ? clp(p.precio_compra) : "—"} />
              <Kpi label="Precio venta" value={p.precio_venta != null ? clp(p.precio_venta) : "—"} sub={Number(p.box_qty) > 1 ? `caja de ${p.box_qty} un` : null} />
              <Kpi
                label="Margen bruto"
                value={<span style={{ color: margenColor(p.margen_pct) }}>{p.margen_bruto != null ? clp(p.margen_bruto) : "—"}</span>}
                sub={p.margen_pct != null ? <span style={{ color: margenColor(p.margen_pct), fontWeight: 700 }}>{n1(p.margen_pct)}% de margen</span> : "sin costo cargado"}
              />
              <Kpi label="Venta por día" value={`${n1(v.por_dia)} un`} />
              <Kpi label="Venta por semana" value={`${n1(v.por_semana)} un`} />
              <Kpi label="Venta por mes" value={`${n1(v.por_mes)} un`} />
              <Kpi label="Últimos 30 días" value={clp(v.monto_30d)} sub={`${num(v.unidades_30d)} unidades`} />
            </div>

            {/* ── Tendencia 30 días ──────────────────────────────────────── */}
            <Titulo>Tendencia 30 días · unidades por día</Titulo>
            {(v.serie_30d || []).some((s) => Number(s.unidades) > 0) ? (
              <Serie30 data={v.serie_30d} />
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "4px 2px" }}>Sin ventas registradas en los últimos 30 días.</div>
            )}

            {/* ── Bodega ─────────────────────────────────────────────────── */}
            <Titulo>Bodega</Titulo>
            <div style={grid}>
              <Kpi label="Stock físico" value={num(b.stock)} />
              <Kpi label="Disponible" value={num(b.disponible)} />
              <Kpi label="Reservado" value={num(b.reserved)} />
              <Kpi label="Comprometido" value={num(b.allocated)} />
              <Kpi label="Cobertura" value={b.cobertura_dias != null ? `${n1(b.cobertura_dias)} días` : "—"} sub="al ritmo de venta actual" />
              <Kpi label="Edad prom. stock" value={b.edad_prom_stock_dias != null ? `${n1(b.edad_prom_stock_dias)} días` : "—"} />
              <Kpi
                label="Próxima expiración"
                value={b.proxima_expiracion ? <span style={{ color: (venceStyle(b.proxima_expiracion) || {}).color }}>{fecha(b.proxima_expiracion)}</span> : "—"}
                sub={diasVence != null ? (diasVence < 0 ? "ya vencida" : `en ${diasVence} días`) : "sin lotes con vencimiento"}
              />
            </div>

            {/* ── Lotes ──────────────────────────────────────────────────── */}
            <Titulo>Lotes en bodega · {lotes.length}</Titulo>
            <Tabla
              head={["Lote", "Restante", "Costo unit.", "Ingreso", "Días en bodega", "Vencimiento"]}
              aligns={["l", "r", "r", "l", "r", "l"]}
              rows={lotes.map((l) => [
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{l.lot_code || "—"}</span>,
                num(l.qty_remaining),
                l.unit_cost != null ? clp(l.unit_cost) : "—",
                fecha(l.received_at),
                l.dias_en_bodega != null ? `${l.dias_en_bodega} d` : "—",
                <VenceBadge date={l.expiry_date} />,
              ])}
              empty="Sin lotes con stock restante."
            />
          </div>
        )}
      </div>
    </div>
  );
}
