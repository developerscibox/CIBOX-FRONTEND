// ============================================================
// DashboardGerencial360.jsx — Bodega 12 · Plataforma 360°
// Vista ejecutiva del rol GERENTE. Diseño de la maqueta aprobada.
// Requiere: tailwindcss, recharts, lucide-react.
// Datos: GET /gerencia/dashboard360 (api.dashboard360). Sin backend
// (modo demo, usingMock) usa ./dashboardMockData.js tal cual.
// El diseño visual (clases, colores, estructura de tarjetas) es el
// de la maqueta; solo cambia la fuente de datos.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, PackageOpen, Truck,
  DollarSign, Tag, ClipboardList, Package, CheckCircle2,
  AlertTriangle, PackageX, Clock, CalendarClock, TrendingDown,
  ArrowUpRight, ArrowDownRight, Send, ClipboardCheck,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  BRAND, HEADER, KPIS, ALERTAS, VENTAS, INVENTARIO, ABASTECIMIENTO,
  LOGISTICA, PRODUCTIVIDAD, RENTABILIDAD, fmtCLP, fmtDec,
} from "./dashboardMockData.js";
import { api, useLoad, usingMock } from "../api.js";
import "../dashboard360.css";

// ---------- mapas de iconos (los datos usan strings) ----------
const KPI_ICONS = { dollar: DollarSign, tag: Tag, clipboard: ClipboardList, package: Package, check: CheckCircle2, truck: Truck };
const ALERT_ICONS = { tag: Tag, packagex: PackageX, clock: Clock, truck: Truck, calendar: CalendarClock, merma: TrendingDown };
const PIPE_ICONS = { send: Send, package: Package, cart: ShoppingCart, packing: PackageOpen, check: ClipboardCheck, truck: Truck };

// Icono de etapa del pipeline por NOMBRE (las etapas vienen dinámicas del backend).
function pipeIcon(nombre) {
  const s = String(nombre || "").toLowerCase();
  if (s.includes("ingres")) return Send;
  if (s.includes("asign")) return Package;
  if (s.includes("picking") || s.includes("prepar")) return ShoppingCart;
  if (s.includes("packing") || s.includes("empaq")) return PackageOpen;
  if (s.includes("listo")) return ClipboardCheck;
  if (s.includes("entreg") || s.includes("despach")) return Truck;
  return Package;
}

// Vista del panel a la que salta cada etapa del pipeline (por nombre).
function pipeNav(nombre) {
  const s = String(nombre || "").toLowerCase();
  if (s.includes("prepar")) return { nav: "picking", titulo: "Preparación" };
  return { nav: "pedidos", titulo: "Pedidos" };
}

// ---------- helpers de formato es-CL (tolerantes a null → "—") ----------
const money = (n) => (n == null ? "—" : fmtCLP(n));
const num = (n) => (n == null ? "—" : Math.round(Number(n) || 0).toLocaleString("es-CL"));
const pad2 = (n) => String(n).padStart(2, "0");
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// "YYYY-MM-DD" → "8 Jul" (sin new Date(): evita el corrimiento de día por zona horaria)
const diaLabel = (iso) => {
  const p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? `${parseInt(p[2], 10)} ${MES_CORTO[(parseInt(p[1], 10) || 1) - 1]}` : String(iso || "");
};
// Eje Y del gráfico de ventas ($ → 12M / 850k)
const ejeMonto = (v) => (v >= 1e6 ? `${fmtDec(v / 1e6, v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));

// Delta % vs valor previo: (hoy − prev) / prev × 100, 1 decimal con coma.
// prev 0/null → null (la tarjeta muestra "sin comparación"). Sube = good
// (todas las métricas con delta del contrato son "más es mejor").
function calcDelta(cur, prev) {
  const c = Number(cur), p = Number(prev);
  if (cur == null || prev == null || !Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  const pct = ((c - p) / Math.abs(p)) * 100;
  return { delta: `${fmtDec(Math.abs(pct))}%`, arrow: pct >= 0 ? "up" : "down", tone: pct >= 0 ? "good" : "bad" };
}

// ============================================================
// View-model: misma estructura para datos reales y demo.
// ============================================================

const CAT_COLORS = ["#E0127A", "#F472B6", "#A855F7", "#C084FC", "#F9A8D4", "#E9D5FF"];
const PIPE_COLORS = ["#E0127A", "#EC4899", "#A855F7", "#8B5CF6", "#EC4899", "#E0127A"];

// Contrato GET /gerencia/dashboard360 → estructuras de la maqueta.
function buildVM(d) {
  const k = d.kpisDia || {};
  const al = d.alertas || {};
  const vn = d.ventasMes || {};
  const inv = d.inventario || {};
  const ab = d.abastecimiento || {};
  const lg = d.logistica || {};
  const pr = d.productividad || {};
  const rt = d.rentabilidad || {};

  // ---- KPIs del día (sin barra de meta: no hay metas configuradas) ----
  const dVen = calcDelta(k.ventasHoy, k.ventasAyer);
  const dMar = calcDelta(k.margenBrutoPct, k.margenAyerPct);
  const dIng = calcDelta(k.ingresados, k.ingresadosAyer);
  const dEnt = calcDelta(k.entregados, k.entregadosAyer);
  // nav = vista del panel a la que salta el KPI al hacer clic (mismo patrón
  // que el Centro de mando: cada dato lleva a su área).
  const conDelta = (delta) => (delta ? { ...delta, sub: "vs ayer" } : { delta: null, sub: "sin comparación" });
  const kpis = [
    { label: "VENTAS DEL DÍA", valor: money(k.ventasHoy), ...conDelta(dVen), icono: "dollar", color: "#E0127A", spark: k.sparkVentas, nav: "ventas", navTitulo: "Ventas · Negocio" },
    { label: "MARGEN BRUTO", valor: k.margenBrutoPct == null ? "—" : `${fmtDec(k.margenBrutoPct)}%`, ...conDelta(dMar), icono: "tag", color: "#E0127A", spark: null, nav: "precios", navTitulo: "Precios y márgenes" },
    { label: "PEDIDOS INGRESADOS", valor: num(k.ingresados), ...conDelta(dIng), icono: "clipboard", color: "#8B5CF6", spark: k.sparkIngresados, nav: "pedidos", navTitulo: "Pedidos" },
    { label: "PEDIDOS EN PREPARACIÓN", valor: num(k.enPreparacion), delta: null, sub: "En picking ahora", icono: "package", color: "#E0127A", spark: null, nav: "picking", navTitulo: "Picking" },
    { label: "PEDIDOS LISTOS", valor: num(k.listos), delta: null, sub: "Listos para retiro", icono: "check", color: "#E0127A", spark: null, nav: "retiro", navTitulo: "Retiro / Mostrador" },
    { label: "PEDIDOS ENTREGADOS", valor: num(k.entregados), ...conDelta(dEnt), icono: "truck", color: "#E0127A", spark: k.sparkEntregados, nav: "pedidos", navTitulo: "Pedidos" },
  ];

  // ---- Alertas críticas ----
  const mesNombre = new Date().toLocaleDateString("es-CL", { month: "long" });
  const alertas = [
    { valor: num(al.stockCritico), texto: "Productos en stock crítico", icono: "tag", nav: "reposicion", navTitulo: "Reposición" },
    { valor: num(al.sinStock), texto: "Productos sin stock", icono: "packagex", nav: "reposicion", navTitulo: "Reposición" },
    { valor: num(al.atrasadosPreparacion), texto: "Pedidos atrasados en preparación", icono: "clock", nav: "picking", navTitulo: "Picking" },
    { valor: num(al.porVencer7d), texto: "Productos próximos a vencer (7 días)", icono: "calendar", nav: "fefo", navTitulo: "FEFO · por vencer" },
    { valor: money(al.mermaMes), texto: `Merma del mes (${mesNombre})`, icono: "merma", nav: "kardex", navTitulo: "Movimientos" },
  ];

  // ---- Ventas del mes ----
  const serie = (vn.serie || []).map((s) => ({ dia: diaLabel(s.dia), monto: Number(s.monto) || 0 }));
  const labels = serie.map((s) => s.dia);
  const step = Math.max(1, Math.ceil(labels.length / 6));
  const ticks = labels.filter((_, i) => i % step === 0);
  if (labels.length && ticks[ticks.length - 1] !== labels[labels.length - 1]) ticks.push(labels[labels.length - 1]);
  const ventas = {
    total: money(vn.total),
    delta: calcDelta(vn.total, vn.prevTotal),
    deltaSub: "vs mes anterior",
    serie,
    ticks,
    topProductos: (vn.topProductos || []).map((p) => ({ nombre: p.nombre, monto: money(p.monto) })),
  };

  // ---- Inventario ----
  const inventario = {
    stockTotal: money(inv.stockValorizado),
    delta: null, // el contrato no trae valor previo del stock
    deltaSub: "vs mes anterior",
    categorias: (inv.categorias || []).map((c, i) => ({
      nombre: c.nombre, pct: Math.round(Number(c.pct) || 0), monto: money(c.monto), color: CAT_COLORS[i % CAT_COLORS.length],
    })),
    tiles: [
      { label: "Stock crítico", valor: num(inv.stockCritico), sub: "productos", tone: "pink", nav: "reposicion", navTitulo: "Reposición" },
      { label: "Sin stock", valor: num(inv.sinStock), sub: "productos", tone: "pink", nav: "reposicion", navTitulo: "Reposición" },
      { label: "Días de cobertura promedio", valor: num(inv.coberturaDias), sub: "días", tone: "violet", nav: "inventario", navTitulo: "Inventario" },
      { label: "Rotación inventario (mes)", valor: inv.rotacionMes == null ? "—" : `${fmtDec(inv.rotacionMes)}x`, sub: "", tone: "violet", nav: "inventario", navTitulo: "Inventario" },
    ],
  };

  // ---- Abastecimiento (sin dona de cumplimiento: no hay datos reales) ----
  const abastecimiento = {
    comprasTotales: money(ab.compras30d),
    delta: calcDelta(ab.compras30d, ab.comprasPrev30d),
    deltaSub: "vs 30 días anteriores",
    segmentos: (ab.segmentos || []).map((s) => ({ nombre: s.nombre, pct: Math.round(Number(s.pct) || 0) })),
    topProveedores: (ab.topProveedores || []).map((p) => ({ nombre: p.nombre, monto: money(p.monto) })),
  };

  // ---- Logística operativa (etapas dinámicas del backend) ----
  const t = lg.tiempos || {};
  const logistica = {
    leyenda: "Ingresados y Entregados: acumulado del día · etapas intermedias: pedidos en esa etapa ahora (incluye ingresos de días previos).",
    pipeline: (lg.etapas || []).map((e, i) => ({
      etapa: e.etapa, n: num(e.n), color: PIPE_COLORS[i % PIPE_COLORS.length], Icon: pipeIcon(e.etapa),
    })),
    metricas: [
      { label: "Tiempo prom. preparación", valor: t.preparacionMin == null ? "—" : `${Math.round(t.preparacionMin)} min` },
      { label: "Tiempo total prom.", valor: t.totalMin == null ? "—" : `${Math.round(t.totalMin)} min` },
      { label: "Pedidos atrasados", valor: num(lg.atrasados), tone: "bad" },
      { label: "Nivel de servicio (SLA)", valor: lg.slaPct == null ? "—" : `${fmtDec(lg.slaPct)}%` },
    ],
  };

  // ---- Productividad de preparación ----
  const minutos = (v) => (v == null ? "—" : `${Math.round(v)} min`);
  const productividad = {
    preparacion: {
      label: "Preparación",
      filas: pr.preparacion || [],
      columns: [
        { header: "Pedidos", cell: (f) => num(f.pedidos) },
        { header: "Tiempo prom.", cell: (f) => minutos(f.tiempoPromMin) },
        { header: "Productividad", bar: true, value: (f) => Number(f.pedidosHora) || 0, cell: (f) => (f.pedidosHora == null ? "—" : `${fmtDec(f.pedidosHora)} ped/h`) },
      ],
    },
  };

  // ---- Rentabilidad ----
  const dTick = calcDelta(rt.ticket, rt.ticketPrev);
  const mermaPct = rt.mermaMes != null && Number(vn.total) > 0 ? (Number(rt.mermaMes) / Number(vn.total)) * 100 : null;
  const rentabilidad = {
    stats: [
      { label: "Margen bruto", valor: money(rt.margenBruto), sub: rt.margenPct == null ? "—" : `${fmtDec(rt.margenPct)}%`, subTone: "good" },
      { label: "Merma del mes", valor: money(rt.mermaMes), sub: mermaPct == null ? "—" : `${fmtDec(mermaPct, 2)}% de ventas`, subTone: "bad", labelTone: "bad" },
      { label: "Capital inmovilizado", valor: money(rt.capitalInmovilizado), sub: "Stock valorizado", subTone: "muted", labelTone: "bad" },
      { label: "Ticket promedio", valor: money(rt.ticket), sub: dTick ? `${dTick.arrow === "up" ? "+" : "-"}${dTick.delta} vs mes anterior` : "sin comparación", subTone: dTick ? dTick.tone : "muted" },
    ],
    margenSegmento: (rt.margenPorCategoria || []).map((c) => ({ nombre: c.nombre, pct: Number(c.pct) || 0 })),
    margenProducto: (rt.margenPorProducto || []).map((p) => ({ nombre: p.nombre, pct: p.pct == null ? "—" : `${fmtDec(p.pct)}%` })),
  };

  return { kpis, alertas, ventas, inventario, abastecimiento, logistica, productividad, rentabilidad };
}

// Fallback demo: el mock actual tal cual (sin fetch), adaptado a las mismas
// estructuras que consume la vista. Sin tab de Packers (no existe en la operación).
function buildMockVM() {
  const colsDemo = [
    { header: "Pedidos", cell: (f) => f.pedidos },
    { header: "Productos", cell: (f) => f.productos },
    { header: "Tiempo prom.", cell: (f) => f.tiempo },
    { header: "Productividad", bar: true, value: (f) => f.prod, cell: (f) => `${fmtDec(f.prod)} ped/h` },
  ];
  return {
    kpis: KPIS,
    alertas: ALERTAS,
    ventas: {
      total: VENTAS.total, delta: { delta: VENTAS.delta, arrow: "up", tone: "good" }, deltaSub: VENTAS.deltaSub,
      serie: VENTAS.serie, ticks: VENTAS.ticks, topProductos: VENTAS.topProductos,
    },
    inventario: {
      stockTotal: INVENTARIO.stockTotal, delta: { delta: INVENTARIO.delta, arrow: "up", tone: "good" }, deltaSub: INVENTARIO.deltaSub,
      categorias: INVENTARIO.categorias, tiles: INVENTARIO.tiles,
    },
    abastecimiento: {
      comprasTotales: ABASTECIMIENTO.comprasTotales, delta: { delta: ABASTECIMIENTO.delta, arrow: "up", tone: "good" }, deltaSub: ABASTECIMIENTO.deltaSub,
      segmentos: ABASTECIMIENTO.segmentos, topProveedores: ABASTECIMIENTO.topProveedores,
    },
    logistica: {
      leyenda: LOGISTICA.leyenda,
      pipeline: LOGISTICA.pipeline.map((s) => ({ etapa: s.etapa, n: s.n, color: s.color, Icon: PIPE_ICONS[s.icono] || Package })),
      metricas: LOGISTICA.metricas,
    },
    productividad: {
      preparacion: { label: PRODUCTIVIDAD.pickers.label, filas: PRODUCTIVIDAD.pickers.filas, columns: colsDemo },
    },
    rentabilidad: RENTABILIDAD,
  };
}

// ============================================================
// Piezas reutilizables
// ============================================================

function Delta({ arrow, tone = "good", children, className = "" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-500" : "text-slate-400";
  const Icon = arrow === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color} ${className}`}>
      {arrow && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

// Delta de tarjeta + leyenda ("12,5% vs ayer") o "sin comparación" si no hay previo.
function DeltaLine({ delta, sub, className = "" }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {delta ? (
        <>
          <Delta arrow={delta.arrow} tone={delta.tone}>{delta.delta}</Delta>
          <span className="text-[10px] text-slate-400">{sub}</span>
        </>
      ) : (
        <span className="text-[10px] text-slate-400">sin comparación</span>
      )}
    </div>
  );
}

const SinDatos = ({ className = "" }) => (
  <p className={`text-[11px] text-slate-400 ${className}`}>Sin datos del periodo.</p>
);

function Sparkline({ data, color = BRAND.primary }) {
  const pts = data.map((v, i) => ({ i, v: Number(v) || 0 }));
  return (
    <div className="h-9 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Etiqueta de periodo: texto plano (sin dropdown falso — nada decorativo que
// parezca interactivo y no lo sea).
function PeriodoLabel({ label }) {
  return <span className="rounded-lg bg-pink-50/60 px-2 py-1 text-[11px] font-semibold text-slate-500">{label}</span>;
}

// Acción de tarjeta: periodo + link REAL a la sección de detalle del panel.
function CardAction({ periodo, onVer, verTitulo }) {
  return (
    <div className="flex items-center gap-2">
      {periodo ? <PeriodoLabel label={periodo} /> : null}
      {onVer ? (
        <button
          type="button"
          onClick={onVer}
          title={verTitulo ? `Abrir ${verTitulo}` : "Ver la sección de detalle"}
          className="flex cursor-pointer items-center gap-0.5 rounded-lg border-0 bg-transparent px-2 py-1 text-[11px] font-bold text-[#E0127A] hover:bg-pink-50"
        >
          Ver detalle <span className="text-[13px] leading-none">›</span>
        </button>
      ) : null}
    </div>
  );
}

function Card({ title, action, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-pink-100 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Donut({ data, size = 136, inner = 38, outer = 60 }) {
  return (
    <PieChart width={size} height={size}>
      <Pie
        data={data} dataKey="pct" nameKey="nombre" cx="50%" cy="50%"
        innerRadius={inner} outerRadius={outer} paddingAngle={2}
        startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}
      >
        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
      </Pie>
      <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ fontSize: 11, borderRadius: 10, borderColor: "#F9D0E5" }} />
    </PieChart>
  );
}

function HBar({ label, value, max, right, labelWidth = "w-36" }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px]">
      <span title={label} className={`${labelWidth} shrink-0 truncate text-slate-600`}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-pink-50">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / max) * 100}%`, background: "linear-gradient(90deg,#F472B6,#E0127A)" }}
        />
      </div>
      <span className="w-11 shrink-0 text-right font-semibold text-slate-700">{right}</span>
    </div>
  );
}

function RankRow({ index, name, value }) {
  return (
    <div className="flex items-center gap-2 py-[3px] text-[11.5px]">
      <span className="w-4 shrink-0 text-slate-400">{index}</span>
      <span title={name} className="flex-1 truncate text-slate-600">{name}</span>
      <span className="shrink-0 font-semibold text-slate-700">{value}</span>
    </div>
  );
}

// ============================================================
// Fila de KPIs + barra de alertas
// ============================================================

function KpiRow({ kpis, onNav }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {kpis.map((k) => {
        const Icon = KPI_ICONS[k.icono] || Package;
        const clic = onNav && k.nav ? () => onNav(k.nav) : undefined;
        return (
          <div
            key={k.label}
            onClick={clic}
            title={clic ? `Abrir ${k.navTitulo}` : undefined}
            className={`rounded-2xl border border-pink-100 bg-white p-3 shadow-sm ${clic ? "cursor-pointer transition hover:border-pink-300 hover:shadow-md" : ""}`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${k.color}1a`, color: k.color }}>
                <Icon size={16} />
              </span>
              <span className="text-[9.5px] font-bold uppercase leading-tight tracking-wide text-slate-500">{k.label}</span>
            </div>
            <div className="text-xl font-extrabold text-slate-800">{k.valor}</div>
            <div className="mt-0.5 flex items-center gap-1">
              {k.delta ? (
                <>
                  <Delta arrow={k.arrow} tone={k.tone}>{k.delta}</Delta>
                  <span className="text-[10px] text-slate-400">{k.sub}</span>
                </>
              ) : (
                <span className="text-[10px] text-slate-400">{k.sub}</span>
              )}
            </div>
            {k.meta && (
              <div className="mt-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-pink-100">
                  <div className="h-full rounded-full bg-[#E0127A]" style={{ width: `${k.meta.pct}%` }} />
                </div>
                <p className="mt-0.5 text-[9px] text-slate-400">{k.meta.pct}% de la meta diaria ({k.meta.valor})</p>
              </div>
            )}
            {Array.isArray(k.spark) && k.spark.length ? (
              <Sparkline data={k.spark} color={k.color} />
            ) : (
              <div className="h-9" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AlertasBar({ alertas, onNav }) {
  return (
    <div className="flex flex-wrap items-stretch rounded-2xl border border-pink-100 bg-white px-2 py-3 shadow-sm">
      <div className="flex items-center gap-2 px-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle size={16} />
        </span>
        <span className="text-[11px] font-extrabold uppercase leading-tight text-red-500">Alertas<br />críticas</span>
      </div>
      {alertas.map((a) => {
        const Icon = ALERT_ICONS[a.icono] || AlertTriangle;
        const clic = onNav && a.nav ? () => onNav(a.nav) : undefined;
        return (
          <div
            key={a.texto}
            onClick={clic}
            title={clic ? `Abrir ${a.navTitulo}` : undefined}
            className={`flex flex-1 items-center gap-2 border-l border-pink-100 px-3 min-w-[150px] ${clic ? "cursor-pointer rounded-lg transition hover:bg-pink-50/60" : ""}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pink-50 text-[#E0127A]">
              <Icon size={14} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-800">{a.valor}</div>
              <div className="text-[10px] text-slate-500">{a.texto}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Ventas
// ============================================================

function VentasCard({ ventas, onNav, className }) {
  return (
    <Card title="Ventas" action={<CardAction periodo="Este mes" onVer={onNav && (() => onNav("ventas"))} verTitulo="Ventas · Negocio" />} className={className}>
      <p className="text-[11px] text-slate-500">Ventas totales</p>
      <div className="text-2xl font-extrabold text-slate-800">{ventas.total}</div>
      <DeltaLine delta={ventas.delta} sub={ventas.deltaSub} className="mb-1" />

      <div className="h-44">
        {ventas.serie.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ventas.serie} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#F6E4EE" />
              <XAxis dataKey="dia" ticks={ventas.ticks} tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, "auto"]} tickFormatter={ejeMonto}
                tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={40}
              />
              <Tooltip
                formatter={(v) => [fmtCLP(v), "Ventas"]}
                contentStyle={{ fontSize: 11, borderRadius: 10, borderColor: "#F9D0E5" }}
              />
              <Line type="monotone" dataKey="monto" stroke={BRAND.primary} strokeWidth={2} dot={{ r: 2, fill: BRAND.primary, strokeWidth: 0 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center"><SinDatos /></div>
        )}
      </div>

      <p className="mt-2 text-[11px] font-bold text-slate-600">Top productos más vendidos</p>
      <div className="mt-1">
        {ventas.topProductos.length
          ? ventas.topProductos.map((p, i) => <RankRow key={p.nombre} index={i + 1} name={p.nombre} value={p.monto} />)
          : <SinDatos />}
      </div>
    </Card>
  );
}

// ============================================================
// Inventario
// ============================================================

function TileStat({ label, valor, sub, tone, nav, navTitulo, onNav }) {
  const color = tone === "violet" ? "#8B5CF6" : "#E0127A";
  const clic = onNav && nav ? () => onNav(nav) : undefined;
  return (
    <div
      onClick={clic}
      title={clic ? `Abrir ${navTitulo}` : undefined}
      className={`rounded-xl border border-pink-100 bg-pink-50/40 p-2 text-center ${clic ? "cursor-pointer transition hover:border-pink-300 hover:bg-pink-50" : ""}`}
    >
      <p className="text-[9.5px] font-semibold leading-tight text-slate-500">{label}</p>
      <p className="text-xl font-extrabold leading-tight" style={{ color }}>{valor}</p>
      {sub && <p className="text-[9.5px] text-slate-400">{sub}</p>}
    </div>
  );
}

function InventarioCard({ inventario, onNav, className }) {
  return (
    <Card title="Inventario" action={<CardAction periodo="Stock valorizado" onVer={onNav && (() => onNav("inventario"))} verTitulo="Inventario" />} className={className}>
      <p className="text-[11px] text-slate-500">Stock total valorizado</p>
      <div className="text-2xl font-extrabold text-slate-800">{inventario.stockTotal}</div>
      <DeltaLine delta={inventario.delta} sub={inventario.deltaSub} />

      {inventario.categorias.length ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="shrink-0"><Donut data={inventario.categorias} /></div>
          <div className="min-w-0 flex-1">
            {inventario.categorias.map((c) => (
              <div key={c.nombre} className="flex items-center gap-2 py-0.5 text-[11px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                <span title={c.nombre} className="flex-1 truncate text-slate-600">{c.nombre}</span>
                <span className="w-8 shrink-0 text-right font-semibold text-slate-700">{c.pct}%</span>
                <span className="hidden w-[86px] shrink-0 text-right text-slate-500 sm:block">{c.monto}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SinDatos className="mt-2" />
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {inventario.tiles.map((t) => <TileStat key={t.label} {...t} onNav={onNav} />)}
      </div>
    </Card>
  );
}

// ============================================================
// Abastecimiento
// ============================================================

function AbastecimientoCard({ abastecimiento, onNav, className }) {
  const segs = abastecimiento.segmentos;
  const maxSeg = Math.max(1e-9, ...segs.map((s) => s.pct || 0));
  return (
    <Card title="Abastecimiento" action={<CardAction periodo="Últimos 30 días" onVer={onNav && (() => onNav("lotes"))} verTitulo="Lotes y costos" />} className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Columna izquierda */}
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">Compras totales</p>
          <div className="text-2xl font-extrabold text-slate-800">{abastecimiento.comprasTotales}</div>
          <DeltaLine delta={abastecimiento.delta} sub={abastecimiento.deltaSub} />

          <p className="mt-4 text-[11px] font-bold text-slate-600">Top proveedores por monto</p>
          <div className="mt-1">
            {abastecimiento.topProveedores.length
              ? abastecimiento.topProveedores.map((p, i) => <RankRow key={p.nombre} index={i + 1} name={p.nombre} value={p.monto} />)
              : <SinDatos />}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-600">Compras por segmento</p>
          <div className="mt-1">
            {segs.length
              ? segs.map((s) => <HBar key={s.nombre} label={s.nombre} value={s.pct} max={maxSeg} right={`${s.pct}%`} />)
              : <SinDatos />}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Logística operativa
// ============================================================

const ARROW_CLIP = "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)";

function LogisticaCard({ logistica, onNav, className }) {
  const pipeline = logistica.pipeline;
  const metricas = logistica.metricas;
  // Columnas del pipeline según cuántas etapas manda el backend.
  const mdCols = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6", 7: "md:grid-cols-7" }[pipeline.length] || "md:grid-cols-6";
  return (
    <Card title="Logística operativa" action={<CardAction periodo="Hoy" onVer={onNav && (() => onNav("pedidos"))} verTitulo="Pedidos" />} className={className}>
      {pipeline.length ? (
        <div className={`grid grid-cols-3 gap-x-1 gap-y-4 ${mdCols}`}>
          {pipeline.map((s) => {
            const Icon = s.Icon || Package;
            const destino = pipeNav(s.etapa);
            const clic = onNav ? () => onNav(destino.nav) : undefined;
            return (
              <div
                key={s.etapa}
                onClick={clic}
                title={clic ? `Abrir ${destino.titulo}` : undefined}
                className={`text-center ${clic ? "cursor-pointer rounded-xl p-1 transition hover:bg-pink-50/60" : ""}`}
              >
                <div
                  className="mx-auto flex h-7 items-center justify-center px-3 text-[10px] font-bold text-white"
                  style={{ background: s.color, clipPath: ARROW_CLIP }}
                >
                  {s.etapa}
                </div>
                <div className="mt-2 text-xl font-extrabold text-slate-800">{s.n}</div>
                <div
                  className="mx-auto mt-2 grid h-10 w-10 place-items-center rounded-full border-2"
                  style={{ borderColor: `${s.color}66`, color: s.color, background: `${s.color}0d` }}
                >
                  <Icon size={16} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <SinDatos />
      )}

      <p className="mt-3 text-[9.5px] leading-snug text-slate-400">{logistica.leyenda}</p>

      <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 ${metricas.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {metricas.map((m) => (
          <div key={m.label} className="rounded-xl border border-pink-100 bg-pink-50/40 p-2 text-center">
            <div className={`text-base font-extrabold ${m.tone === "bad" ? "text-red-500" : "text-slate-800"}`}>{m.valor}</div>
            <div className="text-[9.5px] leading-tight text-slate-500">{m.label}</div>
            {m.delta ? <Delta arrow={m.arrow} tone={m.tone} className="mt-0.5">{m.delta}</Delta> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Productividad del equipo (tabs y columnas según los datos)
// ============================================================

function ProductividadCard({ tabs, onNav, className }) {
  const keys = Object.keys(tabs);
  const [tab, setTab] = useState(keys[0]);
  const cur = tabs[tab] || tabs[keys[0]];
  const filas = cur?.filas || [];
  const columns = cur?.columns || [];
  const barCol = columns.find((c) => c.bar);
  const maxProd = barCol ? Math.max(1e-9, ...filas.map((f) => Number(barCol.value(f)) || 0)) : 1;

  return (
    <Card
      title={<>Productividad del equipo <span className="font-normal normal-case text-slate-400">(hoy)</span></>}
      action={<CardAction onVer={onNav && (() => onNav("desempeno"))} verTitulo="Desempeño por áreas" />}
      className={className}
    >
      <div className="mb-3 flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "cursor-pointer rounded-lg border-0 px-3 py-1 text-[11px] font-semibold transition",
              tab === key ? "bg-[#E0127A] text-white shadow" : "bg-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tabs[key].label}
          </button>
        ))}
      </div>

      {filas.length ? (
        <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-pink-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1.5 font-semibold">Usuario</th>
              {columns.map((c) => (
                <th key={c.header} className="py-1.5 text-right font-semibold">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.nombre || i} className="border-b border-pink-50 last:border-0">
                <td className="py-2">
                  <span className="mr-1.5 text-slate-400">{i + 1}</span>
                  <span className="font-semibold text-slate-700">{f.nombre}</span>
                </td>
                {columns.map((c) =>
                  c.bar ? (
                    <td key={c.header} className="py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-pink-100">
                          <div className="h-full rounded-full bg-[#E0127A]" style={{ width: `${((Number(c.value(f)) || 0) / maxProd) * 100}%` }} />
                        </div>
                        <span className="whitespace-nowrap font-semibold text-slate-700">{c.cell(f)}</span>
                      </div>
                    </td>
                  ) : (
                    <td key={c.header} className="py-2 text-right text-slate-600">{c.cell(f)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : (
        <SinDatos />
      )}
    </Card>
  );
}

// ============================================================
// Rentabilidad
// ============================================================

function RentabilidadCard({ rentabilidad, onNav, className }) {
  const segs = rentabilidad.margenSegmento;
  const prods = rentabilidad.margenProducto;
  const maxSeg = Math.max(1e-9, ...segs.map((s) => s.pct || 0));
  const subColor = { good: "text-emerald-600", bad: "text-red-500", muted: "text-slate-400" };

  return (
    <Card title="Rentabilidad" action={<CardAction periodo="Este mes" onVer={onNav && (() => onNav("precios"))} verTitulo="Precios y márgenes" />} className={className}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 xl:grid-cols-4">
        {rentabilidad.stats.map((s) => (
          <div key={s.label}>
            <p className={`text-[10px] font-semibold ${s.labelTone === "bad" ? "text-red-400" : "text-slate-500"}`}>{s.label}</p>
            {/* sin truncate: una cifra de dinero cortada engaña — mejor que envuelva */}
            <p className="break-words text-sm font-extrabold text-slate-800">{s.valor}</p>
            <p className={`text-[10px] font-semibold ${subColor[s.subTone]}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold text-slate-600">Margen por segmento</p>
          <div className="mt-1">
            {segs.length
              ? segs.map((s) => <HBar key={s.nombre} label={s.nombre} value={s.pct} max={maxSeg} right={`${fmtDec(s.pct)}%`} labelWidth="w-32" />)
              : <SinDatos />}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-600">Margen por producto (Top 5)</p>
          <div className="mt-1">
            {prods.length
              ? prods.map((p, i) => <RankRow key={p.nombre} index={i + 1} name={p.nombre} value={p.pct} />)
              : <SinDatos />}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Estados de carga/error + footer + página
// ============================================================

function LoadingSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-pink-100 bg-white" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-2xl border border-pink-100 bg-white" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-2xl border border-pink-100 bg-white" />
        ))}
      </div>
    </>
  );
}

function Footer({ stamp }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-pink-100 bg-white px-4 py-2 text-[10.5px] text-slate-400 xl:px-6">
      <span>{stamp}</span>
      <span>{HEADER.nota}</span>
      <span>Bodega 12 © 2025 · Plataforma 360° · {HEADER.version}</span>
    </footer>
  );
}

export default function DashboardGerencial360({ onNav }) {
  // Carga al montar. En modo demo (usingMock) NO hay fetch: useLoad corta y
  // la vista se arma desde el mock. Ante error transitorio useLoad conserva
  // los últimos datos, así que la tarjeta roja solo aparece sin datos previos.
  const { data, loading, error } = useLoad(() => api.dashboard360(), null, []);
  const vm = useMemo(() => (usingMock ? buildMockVM() : data ? buildVM(data) : null), [data]);

  const [loadedAt, setLoadedAt] = useState(null);
  useEffect(() => { if (vm) setLoadedAt(new Date()); }, [vm]);

  const ahora = new Date();
  const fechaChip = `Hoy, ${ahora.getDate()} de ${ahora.toLocaleDateString("es-CL", { month: "long" })} ${ahora.getFullYear()}`;
  const stamp = loadedAt
    ? `Última actualización: ${pad2(loadedAt.getDate())}/${pad2(loadedAt.getMonth() + 1)}/${loadedAt.getFullYear()} ${pad2(loadedAt.getHours())}:${pad2(loadedAt.getMinutes())}`
    : "Última actualización: —";

  return (
    <div className="min-w-0 rounded-2xl bg-[#FBF5F9] text-slate-800 antialiased">
      <main className="space-y-4 p-4 xl:p-5">
        {/* Chip de contexto: la fecha real de hoy */}
        <div className="flex items-center justify-end">
          <span className="rounded-xl border border-pink-200 bg-pink-50/60 px-3 py-1.5 text-xs font-semibold text-[#D8127D]">{fechaChip}</span>
        </div>

        {!vm && loading && <LoadingSkeleton />}
        {!vm && !loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
            No se pudo cargar: {error}
          </div>
        )}
        {!vm && !loading && !error && <SinDatos />}

        {vm && (
          <>
            <KpiRow kpis={vm.kpis} onNav={onNav} />
            <AlertasBar alertas={vm.alertas} onNav={onNav} />

            {/* 2 columnas: aire suficiente para que nombres y montos NUNCA se corten */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <VentasCard ventas={vm.ventas} onNav={onNav} />
              <InventarioCard inventario={vm.inventario} onNav={onNav} />
              <AbastecimientoCard abastecimiento={vm.abastecimiento} onNav={onNav} />
              <RentabilidadCard rentabilidad={vm.rentabilidad} onNav={onNav} />
              <LogisticaCard logistica={vm.logistica} onNav={onNav} />
              <ProductividadCard tabs={vm.productividad} onNav={onNav} />
            </div>
          </>
        )}
      </main>
      <Footer stamp={stamp} />
    </div>
  );
}
