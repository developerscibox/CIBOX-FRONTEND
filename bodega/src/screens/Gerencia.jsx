import { useEffect, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { Kpi, Tabla, Seg, Skel } from "../components/Ui.jsx";
import FichaProducto from "./FichaProducto.jsx";

// CENTRO DE MANDO del gerente/dueño. Dashboard ejecutivo, datos 100% REALES
// (sin mock: lo que no hay viene en 0/[]). Secciones: Resumen, Ventas, Equipo,
// Productos, Operación, Finanzas. Selector de periodo. Aislado y profesional.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const mm = (n) => {
  const v = Math.round(Number(n) || 0);
  return Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "M" : clp(v);
};
const num = (n) => (Number(n) || 0).toLocaleString("es-CL");
const dAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const hoy = () => new Date().toISOString().slice(0, 10);
// Fecha en formato chileno dd/mm/aaaa a partir de un ISO (yyyy-mm-dd).
const fmtCL = (iso) => { const s = String(iso).slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : iso; };

const PERIODOS = {
  hoy: { label: "Hoy", days: 0 },
  semana: { label: "7 días", days: 6 },
  mes: { label: "30 días", days: 29 },
  trimestre: { label: "Trimestre", days: 89 },
};
const TABS = ["Resumen", "Ventas", "Equipo", "Productos", "Operación", "Finanzas", "Trazabilidad", "Bitácora"];
const ETAPA_LABEL = { pending: "Tomado (por pagar)", paid: "Cobrado", preparing: "En preparación", ready: "Listo para retiro", shipped: "Despachado", delivered: "Entregado", cancelled: "Anulado", refunded: "Reembolsado" };
const ACCION = { "usuario.rol": "Cambió rol", "usuario.estado": "Cambió estado de usuario", "producto.crear": "Creó producto", "producto.editar": "Editó producto" };
const fmtFecha = (x) => new Date(x).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const Card = ({ children, p = 16, style, onClick, className = "" }) => (
  <div className={`card${className ? " " + className : ""}`} onClick={onClick} style={{ padding: p, ...style }}>{children}</div>
);

// Card con barra de título + tabla del kit dentro. Conserva la navegación
// (onClick/irA) que tenía la tabla inline anterior.
function TCard({ titulo, extra, onClick, irA, children, style }) {
  return (
    <Card p={0} onClick={onClick} className={onClick ? "card-link" : ""} style={{ overflow: "hidden", ...style }}>
      <div title={irA ? `Ver ${irA}` : undefined} style={{ padding: "11px 14px", fontWeight: 700, fontSize: 13.5, borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span>{titulo}{extra ? <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}> {extra}</span> : null}</span>
        {onClick ? <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }}>›</span> : null}
      </div>
      {children}
    </Card>
  );
}

// Formato compacto de dinero para el eje Y ($1,2M · $850k).
const mShort = (v) => {
  const n = Math.abs(Number(v) || 0);
  if (n >= 1e6) return `$${(v / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",")}M`;
  if (n >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
};

function Bars({ data, label, value, tip, accentMax, height = 200, fmt }) {
  const arr = data || [];
  const max = Math.max(1, ...arr.map(value));
  const W = 760, H = height;
  const padL = 56, padR = 14, padT = 14, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = arr.length ? plotW / arr.length : 0;
  const everyLabel = Math.max(1, Math.ceil(arr.length / 14));
  const fmtY = fmt || ((v) => v);
  const TICKS = 4;
  const gridVals = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * i);
  const yOf = (v) => padT + plotH - (v / max) * plotH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} role="img" preserveAspectRatio="none">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6007E" />
          <stop offset="100%" stopColor="#9B007A" />
        </linearGradient>
        <linearGradient id="barGradMax" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {/* Cuadrícula horizontal + valores del eje Y */}
      {gridVals.map((gv, i) => {
        const y = yOf(gv);
        return (
          <g key={"grid" + i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eceaf0" strokeWidth="1" />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="#9aa0ab" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtY(gv)}</text>
          </g>
        );
      })}
      {/* Barras */}
      {arr.map((d, i) => {
        const v = value(d) || 0;
        const h = (v / max) * plotH;
        const x = padL + i * bw, y = padT + plotH - h;
        const isMax = accentMax && v === max && v > 0;
        return (
          <g key={i}>
            <title>{tip ? tip(d) : `${label(d)}: ${v}`}</title>
            <rect x={x} y={padT} width={bw} height={plotH} fill="transparent" />
            <rect x={x + bw * 0.2} y={y} width={Math.max(1.5, bw * 0.6)} height={Math.max(0, h)} rx="3" fill={isMax ? "url(#barGradMax)" : "url(#barGrad)"} opacity={isMax ? 1 : 0.72 + 0.28 * (v / max)} />
            {i % everyLabel === 0 ? <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="10.5" fill="#9aa0ab">{label(d)}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.k} title={`${r.k}: ${r.txt}`} style={{ marginBottom: 9, cursor: "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: "var(--muted)" }}>{r.k}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{r.txt}</b>
          </div>
          <div style={{ height: 9, background: "var(--border-soft)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${(r.v / max) * 100}%`, height: "100%", background: r.c || "var(--magenta-d)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Punto de estado de 6px (reemplaza los emojis de las píldoras de acciones).
const Dot = ({ tone }) => (
  <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${tone})`, flexShrink: 0, display: "inline-block" }} />
);
// 3 variantes fijas de chip: fondo suave + borde 1px + punto del color de estado.
const TONO = {
  danger: { bg: "#fdecee", border: "#f4c6cc" },
  warn: { bg: "#fdf5e3", border: "#eeddb4" },
  ok: { bg: "#eaf6ee", border: "#c5e5cf" },
};

function AccionesBand({ items, onGoto }) {
  if (!items.length) return (
    <div className="card" style={{ padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <Dot tone="ok" /><b style={{ fontSize: 13 }}>Sin alertas críticas — todo en orden hoy.</b>
    </div>
  );
  return (
    <div className="card" style={{ padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Acciones recomendadas hoy</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((a, i) => {
          const t = TONO[a.tone] || TONO.warn;
          return (
            <button key={i} onClick={() => onGoto(a.goto)} title={`Ir a ${a.goto}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: t.bg, color: "inherit", border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              <Dot tone={a.tone} />{a.txt}<span style={{ opacity: 0.45, fontWeight: 700 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const subCell = (main, sub) => (
  <>{main}<div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div></>
);

export default function Gerencia({ onNav }) {
  const [periodo, setPeriodo] = useState("mes");
  const [tab, setTab] = useState("Resumen");
  const cfg = PERIODOS[periodo];
  const from = dAgo(cfg.days);
  const to = hoy();
  // Salto directo al módulo operativo correspondiente (Cobranza, Precios, etc.).
  const ir = (v) => (onNav ? () => onNav(v) : undefined);

  const [selOrder, setSelOrder] = useState(null);
  const [fichaId, setFichaId] = useState(null); // ficha técnica del producto clickeado
  const g = useLoad(() => api.gerencia({ from, to }), null, [periodo]);
  const cob = useLoad(() => api.cobranzaResumen(), null, []);
  const ord = useLoad(() => api.orders({ limit: 25 }), null, []);
  const aud = useLoad(() => api.audit(60), null, []);
  const d = g.data;

  // Frescura: "Actualizado hace Xs/min" en vez de "· actualizando…".
  const [loadedAt, setLoadedAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { if (d) { setLoadedAt(Date.now()); setNowTick(Date.now()); } }, [d]);
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 10000); return () => clearInterval(t); }, []);
  const segundos = loadedAt ? Math.max(0, Math.round((nowTick - loadedAt) / 1000)) : null;
  const frescura = segundos == null ? null : segundos < 60 ? `hace ${segundos}s` : `hace ${Math.round(segundos / 60)} min`;

  if (usingMock) return <Card style={{ color: "var(--muted)" }}>El centro de mando usa datos reales del negocio. Conéctalo al backend (VITE_API_URL) para verlo.</Card>;
  if (g.loading && !d) return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Skel h={34} w={320} /><Skel h={14} w={170} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={88} />)}
      </div>
      <Skel h={260} />
    </div>
  );
  if (g.error && !d) return <Card style={{ color: "var(--danger)" }}>No se pudo cargar: {g.error}</Card>;
  if (!d) return <Card style={{ color: "var(--muted)" }}>Sin datos.</Card>;

  const { ventas, operacion, equipo, productos, cobros, inventario, finanzas } = d;
  const aging = cob.data?.aging;
  const llamarHoy = cob.data?.llamarHoy || [];
  const chequesPorVencer = cob.data?.chequesPorVencer || [];
  const vencido = aging ? (aging.total || 0) - (aging.buckets?.vigente || 0) : 0;
  // Franja de acciones: dónde se fuga la plata / qué atender hoy. Cada chip salta a su pestaña.
  const acciones = [
    vencido > 0 && { tone: "danger", txt: `Vencido por cobrar ${mm(vencido)}`, goto: "Finanzas" },
    llamarHoy.length > 0 && { tone: "warn", txt: `Cobrar hoy: ${llamarHoy.length} ${llamarHoy.length === 1 ? "cliente" : "clientes"}`, goto: "Finanzas" },
    chequesPorVencer.length > 0 && { tone: "warn", txt: `${chequesPorVencer.length} cheque${chequesPorVencer.length === 1 ? "" : "s"} por vencer`, goto: "Finanzas" },
    inventario.quiebresCount > 0 && { tone: "danger", txt: `${inventario.quiebresCount} quiebre${inventario.quiebresCount === 1 ? "" : "s"} de stock`, goto: "Productos" },
    (operacion.cola?.paid || 0) > 0 && { tone: "ok", txt: `${operacion.cola.paid} por preparar`, goto: "Operación" },
    operacion.cuello && { tone: "warn", txt: `Cuello: ${operacion.cuello.etapa} ${operacion.cuello.minutos}m`, goto: "Operación" },
  ].filter(Boolean);
  const thr = operacion.throughput_hora >= 1 ? `${operacion.throughput_hora}/hora` : `${Math.round(operacion.throughput_hora * 24 * 10) / 10}/día`;
  const deltaVentas = ventas.variacionPct == null ? null : { pct: ventas.variacionPct, good: ventas.variacionPct >= 0 };
  const subVencido = aging
    ? <span style={{ color: vencido > 0 ? "var(--danger)" : "var(--muted)", fontWeight: vencido > 0 ? 600 : 400 }}>vencido {mm(vencido)}</span>
    : cob.error ? "no disponible" : null;

  return (
    <div>
      {/* Encabezado ejecutivo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>Periodo</span>
          <Seg options={Object.entries(PERIODOS).map(([k, v]) => ({ value: k, label: v.label }))} value={periodo} onChange={setPeriodo} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtCL(from)} → {fmtCL(to)}{frescura ? ` · Actualizado ${frescura}` : ""}</div>
      </div>

      {/* Tabs — mismo patrón segmented, con scroll horizontal en móvil */}
      <div style={{ marginBottom: 16, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
        <Seg options={TABS.map((t) => ({ value: t, label: t }))} value={tab} onChange={setTab} />
      </div>

      {/* RESUMEN */}
      {tab === "Resumen" && (
        <>
          <AccionesBand items={acciones} onGoto={setTab} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
            <Kpi label="Venta del periodo" value={mm(ventas.total)} delta={deltaVentas} sub={deltaVentas ? null : "sin comparación"} onClick={() => setTab("Ventas")} />
            <Kpi label="Pedidos" value={num(ventas.pedidos)} sub={`ticket ${clp(ventas.ticket)}`} onClick={() => setTab("Ventas")} />
            <Kpi label="Utilidad estimada" value={mm(productos.utilidadTotal)} sub={productos.margenPromedio != null ? `margen ${productos.margenPromedio}%` : "carga costos"} onClick={() => setTab("Productos")} />
            <Kpi label="Por cobrar" value={aging ? mm(aging.total) : "Sin datos"} sub={subVencido} onClick={() => setTab("Finanzas")} />
            <Kpi label="Entregados" value={num(operacion.entregados)} sub={thr} onClick={() => setTab("Operación")} />
            <Kpi label="Cuello de botella" value={operacion.cuello ? operacion.cuello.etapa : "Ninguno"} sub={operacion.cuello ? <span style={{ color: "var(--warn)", fontWeight: 600 }}>{operacion.cuello.minutos} min</span> : <span style={{ color: "var(--ok)", fontWeight: 600 }}>flujo al día</span>} onClick={() => setTab("Operación")} />
          </div>
          <Card className="card-link" onClick={() => setTab("Ventas")} style={{ marginBottom: 14 }}><div style={{ fontWeight: 700, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Ventas por día <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· pasa el cursor para ver el monto</span></span><span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }} title="Ver Ventas">›</span></div><Bars data={ventas.serie} value={(x) => x.total} label={(x) => x.dia.slice(8)} tip={(x) => `${x.dia}: ${clp(x.total)} · ${x.pedidos} ped.`} /></Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            <TCard titulo={`Preparación por persona · ${Math.min(5, (equipo?.preparacion || []).length)}`} onClick={() => setTab("Equipo")} irA="Equipo">
              <Tabla head={["Persona", "Preparados", "Prom."]} aligns={["l", "r", "r"]} empty="Sin preparaciones en el periodo."
                rows={(equipo?.preparacion || []).slice(0, 5).map((b) => [b.label, num(b.preparados), <b>{`${b.prep_prom_min} min`}</b>])} />
            </TCard>
            <TCard titulo={`Más vendidos · ${Math.min(5, productos.top.length)}`} onClick={() => setTab("Productos")} irA="Productos">
              <Tabla head={["Producto", "Unid.", "$"]} aligns={["l", "r", "r"]}
                onRowClick={(i) => productos.top[i]?.product_id && setFichaId(productos.top[i].product_id)}
                rows={productos.top.slice(0, 5).map((p) => [p.name, num(p.qty), <b>{clp(p.revenue)}</b>])} />
            </TCard>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 14 }}>
            {/* Pulso de sala en vivo */}
            <Card className="card-link" onClick={() => setTab("Operación")}>
              <div style={{ fontWeight: 700, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>Pulso de la operación <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }}>›</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
                <div><div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(operacion.cola?.paid || 0)}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Por preparar</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(operacion.en_cola_total || 0)}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>En cola</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(operacion.entregados)}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Entregados</div></div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
                {operacion.cuello ? <>Cuello: <b style={{ color: "var(--warn)" }}>{operacion.cuello.etapa}</b> · {operacion.cuello.minutos} min · throughput {thr}</> : `Throughput ${thr}`}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* VENTAS */}
      {tab === "Ventas" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
            <Kpi label="Venta del periodo" value={clp(ventas.total)} delta={deltaVentas} sub={deltaVentas ? null : "sin comparación"} onClick={ir("ventas")} />
            <Kpi label="Pedidos" value={num(ventas.pedidos)} onClick={ir("pedidos")} />
            <Kpi label="Ticket promedio" value={clp(ventas.ticket)} onClick={ir("ventas")} />
            <Kpi label="Periodo anterior" value={clp(ventas.prev.total)} sub={`${num(ventas.prev.pedidos)} pedidos`} onClick={ir("reportes")} />
          </div>
          <Card className={onNav ? "card-link" : ""} onClick={ir("reportes")} style={{ marginBottom: 14 }}><div style={{ fontWeight: 700, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Tendencia de ventas (por día)</span>{onNav ? <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }} title="Ver Reportes">›</span> : null}</div><Bars data={ventas.serie} value={(x) => x.total} label={(x) => x.dia.slice(5)} tip={(x) => `${x.dia}: ${clp(x.total)} · ${x.pedidos} ped.`} fmt={mShort} /></Card>
          <Card className={onNav ? "card-link" : ""} onClick={ir("ventas")}><div style={{ fontWeight: 700, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Ventas por hora del día <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· el peak en verde · pasa el cursor</span></span>{onNav ? <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }} title="Ver Ventas · Negocio">›</span> : null}</div><Bars data={ventas.porHora} value={(x) => x.total} label={(x) => x.hora} tip={(x) => `${String(x.hora).padStart(2, "0")}:00 hrs · ${clp(x.total)}`} accentMax fmt={mShort} /></Card>
        </>
      )}

      {/* EQUIPO */}
      {tab === "Equipo" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          <TCard titulo={`Preparación · ${(equipo?.preparacion || []).length}`} extra="· velocidad">
            <Tabla head={["Persona", "Preparados", "Prom."]} aligns={["l", "r", "r"]} empty="Sin preparaciones."
              rows={(equipo?.preparacion || []).map((b) => [b.label, num(b.preparados), <b>{`${b.prep_prom_min} min`}</b>])} />
          </TCard>
        </div>
      )}

      {/* PRODUCTOS */}
      {tab === "Productos" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
            <Kpi label="Productos distintos" value={num(productos.distintos)} sub="vendidos en el periodo" onClick={ir("productos")} />
            <Kpi label="Utilidad estimada" value={mm(productos.utilidadTotal)} onClick={ir("precios")} />
            <Kpi label="Margen promedio" value={productos.margenPromedio != null ? `${productos.margenPromedio}%` : "Sin datos"} sub={productos.margenPromedio == null ? "carga costos en Productos" : null} onClick={ir("precios")} />
            <Kpi label="Quiebres de stock" value={num(inventario.quiebresCount)} sub={<span style={{ color: inventario.quiebresCount ? "var(--danger)" : "var(--muted)", fontWeight: inventario.quiebresCount ? 600 : 400 }}>{num(inventario.bajosCount)} con stock bajo</span>} onClick={ir("reposicion")} />
          </div>
          {/* Click en cualquier producto → su ficha técnica (gráfico, lotes, margen). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
            <TCard titulo={`Más vendidos · ${productos.top.length}`} onClick={ir("ventas")} irA="Ventas">
              <Tabla head={["Producto", "Unid.", "$"]} aligns={["l", "r", "r"]}
                onRowClick={(i) => productos.top[i]?.product_id && setFichaId(productos.top[i].product_id)}
                rows={productos.top.map((p) => [p.name, num(p.qty), <b>{clp(p.revenue)}</b>])} />
            </TCard>
            <TCard titulo="Menos vendidos" extra="· liquidar" onClick={ir("precios")} irA="Precios y márgenes">
              <Tabla head={["Producto", "Unid.", "$"]} aligns={["l", "r", "r"]}
                onRowClick={(i) => productos.bottom[i]?.product_id && setFichaId(productos.bottom[i].product_id)}
                rows={productos.bottom.map((p) => [p.name, num(p.qty), <b>{clp(p.revenue)}</b>])} />
            </TCard>
            <TCard titulo="Rentabilidad" extra="· utilidad" onClick={ir("precios")} irA="Precios y márgenes">
              <Tabla head={["Producto", "Margen", "Utilidad"]} aligns={["l", "r", "r"]} empty="Carga el costo de los productos para ver la utilidad."
                onRowClick={(i) => productos.margen[i]?.product_id && setFichaId(productos.margen[i].product_id)}
                rows={productos.margen.map((p) => [p.name, `${p.margenPct}%`, <b>{clp(p.utilidad)}</b>])} />
            </TCard>
            <TCard titulo="Quiebres / stock bajo" onClick={ir("reposicion")} irA="Reposición">
              <Tabla head={["Producto", "Disp."]} aligns={["l", "r"]} empty="Sin quiebres de stock."
                onRowClick={(i) => { const l = [...inventario.quiebres, ...inventario.bajos].slice(0, 12); if (l[i]?.product_id) setFichaId(l[i].product_id); }}
                rows={[...inventario.quiebres, ...inventario.bajos].slice(0, 12).map((p) => [p.name, <b style={{ color: p.stock <= 0 ? "var(--danger)" : "var(--warn)" }}>{p.stock}</b>])} />
            </TCard>
          </div>
        </>
      )}

      {/* OPERACIÓN */}
      {tab === "Operación" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
            <Kpi label="Entregados" value={num(operacion.entregados)} onClick={ir("pedidos")} />
            <Kpi label="Throughput" value={thr} onClick={ir("actividad")} />
            <Kpi label="Tiempo total prom." value={`${operacion.tiempos.total} min`} onClick={ir("pedidos")} />
            <Kpi label="Cuello de botella" value={operacion.cuello ? operacion.cuello.etapa : "Ninguno"} sub={operacion.cuello ? <span style={{ color: "var(--warn)", fontWeight: 600 }}>{operacion.cuello.minutos} min</span> : <span style={{ color: "var(--ok)", fontWeight: 600 }}>flujo al día</span>} onClick={ir("actividad")} />
            <Kpi label="En cola ahora" value={num(operacion.en_cola_total)} sub={`${operacion.cola.paid} por preparar`} onClick={ir("picking")} />
          </div>
          <Card className={onNav ? "card-link" : ""} onClick={ir("pedidos")}><div style={{ fontWeight: 700, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Tiempo promedio por etapa (min)</span>{onNav ? <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }} title="Ver Pedidos">›</span> : null}</div>
            <HBars rows={[
              { k: "Espera de pago", v: operacion.tiempos.espera_pago, txt: `${operacion.tiempos.espera_pago} min` },
              { k: "Espera en cola", v: operacion.tiempos.espera_cola, txt: `${operacion.tiempos.espera_cola} min` },
              { k: "Preparación", v: operacion.tiempos.preparacion, txt: `${operacion.tiempos.preparacion} min` },
              { k: "Espera de entrega", v: operacion.tiempos.espera_entrega, txt: `${operacion.tiempos.espera_entrega} min` },
            ]} />
          </Card>

          <div style={{ fontWeight: 700, margin: "18px 0 8px" }}>Preparación por persona</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            <TCard titulo="Packing" extra="· tiempo real por persona">
              <Tabla head={["Persona", "Preparados", "Prep. media"]} aligns={["l", "r", "r"]} empty="Sin preparaciones."
                rows={(equipo?.preparacion || []).map((b) => [b.label, num(b.preparados), <b>{`${b.prep_prom_min} min`}</b>])} />
            </TCard>
          </div>
        </>
      )}

      {/* FINANZAS — estado de resultados del periodo */}
      {tab === "Finanzas" && finanzas && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 8 }}>
            <Kpi label="Ingresos · Ventas" value={mm(finanzas.ingresos.ventas)} sub="facturado en el periodo" onClick={ir("ventas")} />
            <Kpi label="Costo de lo vendido" value={`− ${mm(finanzas.egresos.cogs)}`} sub="costo de los productos vendidos" onClick={ir("lotes")} />
            <Kpi label="Utilidad bruta" value={mm(finanzas.utilidadBruta)} sub={finanzas.margenBrutoPct != null ? `margen ${finanzas.margenBrutoPct}%` : null} onClick={ir("precios")} />
            <Kpi label="Compras" value={`− ${mm(finanzas.egresos.compras)}`} sub="reposición de inventario" onClick={ir("lotes")} />
            {/* Desglose por método (antes "Cobrado (caja)", que era siempre ≡ Ventas) */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Ventas por método</div>
              {[["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"], ["transferencia", "Transferencia"], ["webpay", "Webpay"]].map(([k, lab]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, marginTop: 5 }}>
                  <span style={{ color: "var(--muted)" }}>{lab}</span>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>{clp(finanzas.ingresos.por_metodo?.[k] || 0)}</b>
                </div>
              ))}
            </div>
            <Kpi label="Por cobrar" value={aging ? mm(aging.total) : "Sin datos"} sub={subVencido} onClick={ir("cobranza")} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
            Utilidad bruta = ventas − costo de lo vendido{finanzas.sinCosto > 0 ? ` (margen sobre los productos con costo; ${finanzas.sinCosto} sin costo cargado)` : ""}. Los <b>gastos operativos</b> (sueldos, arriendo, servicios) se llevan aparte.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Cobros del periodo · {clp(cobros?.total || 0)} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>({num(cobros?.count || 0)} cobros)</span></div>
            <HBars rows={Object.entries(cobros?.byMethod || {}).map(([k, v]) => ({ k: k.charAt(0).toUpperCase() + k.slice(1), v, txt: clp(v) }))} />
            {!Object.keys(cobros?.byMethod || {}).length ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin cobros en el periodo.</div> : null}
          </Card>
          <Card className={onNav ? "card-link" : ""} onClick={ir("cobranza")}>
            <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Cuentas por cobrar {aging ? `· ${clp(aging.total)}` : ""} {vencido > 0 ? <span style={{ fontWeight: 400, color: "var(--danger)", fontSize: 12 }}>· vencido {clp(vencido)}</span> : null}</span>{onNav ? <span style={{ color: "var(--muted)", opacity: 0.55, fontWeight: 700 }} title="Ver Cobranza">›</span> : null}</div>
            {aging ? (
              <HBars rows={[
                { k: "Vigente", c: "var(--ok)" }, { k: "0-30 días", c: "var(--warn)" }, { k: "31-60 días", c: "var(--warn)" }, { k: "61-90 días", c: "var(--danger)" }, { k: "+90 días", c: "var(--danger)" },
              ].map((b, idx) => { const key = ["vigente", "0-30", "31-60", "61-90", "+90"][idx]; const v = aging.buckets?.[key] || 0; return { k: b.k, v, txt: clp(v), c: b.c }; })} />
            ) : <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin datos de cobranza.</div>}
          </Card>
          </div>
          {/* Cobranza accionable — el dolor nº1 del mayorista */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 }}>
            <TCard titulo="A quién cobrar hoy" onClick={ir("cobranza")} irA="Cobranza">
              <Tabla head={["Cliente", "Días", "Monto"]} aligns={["l", "r", "r"]} empty="Sin vencidos por cobrar."
                rows={llamarHoy.slice(0, 6).map((c) => [
                  subCell(c.cliente, c.documento),
                  <b style={{ color: c.diasVencida > 90 ? "var(--danger)" : "var(--warn)" }}>{num(c.diasVencida)}</b>,
                  <b>{clp(c.monto)}</b>,
                ])} />
            </TCard>
            <TCard titulo="Cheques por vencer" onClick={ir("cobranza")} irA="Cobranza">
              <Tabla head={["Cliente / cheque", "Vence", "Monto"]} aligns={["l", "r", "r"]} empty="Sin cheques próximos."
                rows={chequesPorVencer.slice(0, 6).map((c) => [
                  subCell(c.cliente, `${c.numero} · ${c.banco}`),
                  <b style={{ color: c.diasParaVencer <= 3 ? "var(--danger)" : "var(--warn)" }}>{num(c.diasParaVencer)} d</b>,
                  <b>{clp(c.monto)}</b>,
                ])} />
            </TCard>
          </div>
        </>
      )}

      {/* TRAZABILIDAD — ficha + línea de tiempo de cada pedido */}
      {tab === "Trazabilidad" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <TCard titulo="Pedidos recientes" onClick={ir("pedidos")} irA="Pedidos" style={{ maxHeight: 540, overflowY: "auto" }}>
            {(ord.data?.orders || []).map((o) => (
              <button key={o._id} onClick={(e) => { e.stopPropagation(); setSelOrder(o); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", borderTop: "1px solid var(--border-soft)", background: selOrder?._id === o._id ? "#f1f1f4" : "#fff", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums" }}><b>#{String(o._id).slice(-6).toUpperCase()}</b><span>{clp(o.total)}</span></div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{o.customer?.fullName || "Mostrador"} · {ETAPA_LABEL[o.status] || o.status}</div>
              </button>
            ))}
            {!(ord.data?.orders || []).length ? <div style={{ padding: 14, color: "var(--muted)" }}>{ord.loading ? "Cargando…" : "Sin pedidos."}</div> : null}
          </TCard>
          <Card>
            {!selOrder ? (
              <div style={{ color: "var(--muted)" }}>
                Elige un pedido para ver su trazabilidad completa: quién hizo cada paso y cuándo.
                {onNav ? <div style={{ marginTop: 10 }}><button onClick={ir("pedidos")} style={{ border: "1px solid var(--border-soft)", background: "#fff", color: "var(--magenta-d)", borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>Ver todos en Pedidos ›</button></div> : null}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>#{String(selOrder._id).slice(-6).toUpperCase()} · {selOrder.customer?.fullName || "Mostrador"}</div>
                  {onNav ? <button onClick={ir("pedidos")} title="Abrir la sección Pedidos" style={{ border: "1px solid var(--border-soft)", background: "#fff", color: "var(--magenta-d)", borderRadius: 8, padding: "4px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>Ver en Pedidos ›</button> : null}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 14 }}>{clp(selOrder.total)} · {selOrder.payment?.method || "sin pago registrado"}{selOrder.payment?.change != null ? ` · vuelto ${clp(selOrder.payment.change)}` : ""}</div>
                {(selOrder.status_history || []).map((h, i, arr) => {
                  const dur = i > 0 ? Math.round((new Date(h.changed_at).getTime() - new Date(arr[i - 1].changed_at).getTime()) / 60000) : null;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, background: "var(--magenta-d)", marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{ETAPA_LABEL[h.status] || h.status}{dur != null ? <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}> · +{dur} min</span> : null}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{h.changed_by?.label || "Sistema"}{h.changed_by?.role ? ` (${h.changed_by.role})` : ""} · {fmtFecha(h.changed_at)}</div>
                      </div>
                    </div>
                  );
                })}
                {!(selOrder.status_history || []).length ? <div style={{ color: "var(--muted)" }}>Sin historial registrado.</div> : null}
                <div style={{ fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Ítems</div>
                {(selOrder.items || []).map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>
                    <span>{it.quantity}× {it.name}{it.sector ? <span style={{ color: "var(--muted)", fontSize: 11 }}> · {it.sector}</span> : null}</span><span>{clp(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* BITÁCORA — auditoría de acciones sensibles */}
      {tab === "Bitácora" && (
        <TCard titulo="Bitácora de acciones sensibles" onClick={ir("autorizaciones")} irA="Autorizaciones">
          <Tabla head={["Cuándo", "Quién", "Acción", "Sobre"]} aligns={["l", "l", "l", "l"]}
            empty={aud.loading ? "Cargando…" : "Sin registros aún. Aquí quedan los cambios de precio, de rol y de estado de usuarios."}
            rows={(aud.data?.items || []).map((a) => [
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtFecha(a.at)}</span>,
              subCell(a.actor?.label || "Sistema", a.actor?.role || ""),
              subCell(ACCION[a.action] || a.action, a.detail || ""),
              a.target || "",
            ])} />
        </TCard>
      )}

      {/* Ficha técnica del producto clickeado en cualquier tabla de productos. */}
      {fichaId ? <FichaProducto productId={fichaId} onClose={() => setFichaId(null)} /> : null}
    </div>
  );
}
