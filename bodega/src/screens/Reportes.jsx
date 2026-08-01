import { useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { Kpi, Tabla, Seg, Skel } from "../components/Ui.jsx";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { brand } from "../brand.js";
// Centro de reportes del gerente: (1) Resumen ejecutivo del periodo — KPIs, gráfico
// y exportación Excel/PDF/CSV — y (2) Biblioteca de informes estilo ERP (Ventas /
// Inventario / Finanzas), cada uno con filtros propios, totales y descarga Excel.
// Datos reales desde el backend (sin mock).

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const mm = (n) => { const v = Math.round(Number(n) || 0); return Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "M" : clp(v); };
const num = (n) => (Number(n) || 0).toLocaleString("es-CL");
const dec = (n) => (Number(n) || 0).toLocaleString("es-CL", { maximumFractionDigits: 1 });
const dAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const hoy = () => new Date().toISOString().slice(0, 10);
const sum = (arr, k) => (arr || []).reduce((a, x) => a + (Number(x[k]) || 0), 0);
// meta del backend ("estimado a costo actual"): string directo u objeto con nota.
const metaTxt = (m) => (!m ? null : typeof m === "string" ? m : m.nota || m.note || m.label || "Estimado a costo actual");
const PERIODOS = { hoy: { label: "Hoy", days: 0 }, semana: { label: "7 días", days: 6 }, mes: { label: "30 días", days: 29 }, trimestre: { label: "Trimestre", days: 89 } };
const MAGENTA = [155, 0, 122]; // = var(--magenta-d) #3B7A1D (PDF: jsPDF no lee CSS vars)

function Bars({ serie }) {
  const arr = serie || [];
  const max = Math.max(1, ...arr.map((s) => s.total));
  const W = 760, H = 150, pad = 24;
  const bw = arr.length ? (W - pad * 2) / arr.length : 0;
  const every = Math.ceil(arr.length / 14);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 160 }} role="img">
      {arr.map((s, i) => {
        const h = (s.total / max) * (H - 40); const x = pad + i * bw, y = H - 24 - h;
        return (<g key={i}><title>{`${s.dia}: ${clp(s.total)} · ${s.pedidos} ped.`}</title>
          <rect x={x} y={0} width={bw} height={H} fill="transparent" />
          <rect x={x + bw * 0.16} y={y} width={Math.max(1, bw * 0.68)} height={Math.max(0, h)} rx="3" fill="var(--magenta-d)" opacity={0.5 + 0.5 * (s.total / max)} />
          {i % every === 0 ? <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{s.dia.slice(5)}</text> : null}</g>);
      })}
    </svg>
  );
}

// Card con título + tabla del kit (thead siempre visible — item 6/8 de la auditoría).
const CardTabla = ({ titulo, children }) => (
  <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 0 }}>
    <div style={{ padding: "11px 14px", fontWeight: 700, fontSize: 13.5, borderBottom: "1px solid var(--border)" }}>{titulo}</div>
    <div style={{ overflowX: "auto" }}>{children}</div>
  </div>
);

// ── Biblioteca de informes ─────────────────────────────────────────────────────

const inputS = { padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, background: "#fff" };
const lblS = { fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 5 };
const btnXls = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" };
const Chip = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${on ? "var(--magenta)" : "var(--border)"}`, background: on ? "var(--magenta)" : "#fff", color: on ? "#fff" : "var(--muted)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{children}</button>
);
const Rango = ({ from, to, setFrom, setTo }) => (
  <>
    <label style={lblS}>Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputS} /></label>
    <label style={lblS}>Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputS} /></label>
  </>
);
const SkelTabla = () => (
  <div style={{ padding: 14, display: "grid", gap: 9 }}>
    <Skel h={12} w="45%" />
    <Skel h={12} />
    <Skel h={12} />
    <Skel h={12} w="80%" />
  </div>
);

// Tabla genérica de informe: filtros arriba, thead, totales al pie, export Excel,
// estados loading/error/vacío. cols: [{ k, label, fmt, right, bold, tint, render }].
function TablaInf({ nombre, cols, items, tot, loading, error, meta, filtros, nota, sinExcel }) {
  const cell = (c, v, it) => {
    if (c.render) return c.render(v, it);
    if (v == null || v === "") return <span style={{ color: "var(--muted)" }}>N/D</span>;
    if (c.fmt === "clp") return clp(v);
    if (c.fmt === "num") return num(v);
    if (c.fmt === "dec") return dec(v);
    if (c.fmt === "pct") return `${dec(v)}%`;
    if (c.fmt === "date") return String(v).slice(0, 10);
    if (c.fmt === "datetime") return String(v).replace("T", " ").slice(0, 16);
    return String(v);
  };
  // Celda para la tabla del kit: aplica negrita/tinte semántico sobre el valor formateado.
  const celda = (c, it) => {
    const v = cell(c, it[c.k], it);
    const color = c.tint ? c.tint(it[c.k], it) : undefined;
    return c.bold || color ? <span style={{ fontWeight: c.bold ? 600 : undefined, color }}>{v}</span> : v;
  };
  const notaFull = [nota, metaTxt(meta)].filter(Boolean).join(" · ");
  const exportar = () => {
    const wb = XLSX.utils.book_new();
    const aoa = [
      [`${brand.name} — ${nombre}`],
      ...(notaFull ? [[notaFull]] : []),
      [],
      cols.map((c) => c.label),
      ...(items || []).map((it) => cols.map((c) => it[c.k] ?? "")),
      ...(tot ? [cols.map((c, i) => (i === 0 ? "TOTALES" : tot[c.k] ?? ""))] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Informe");
    XLSX.writeFile(wb, `${brand.name}-${nombre.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "")}-${hoy()}.xlsx`);
  };
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 700, marginRight: "auto" }}>{nombre}</div>
        {filtros}
        {!sinExcel ? <button onClick={exportar} disabled={!items?.length} style={{ ...btnXls, opacity: items?.length ? 1 : 0.5 }} title="Descargar este informe en Excel (.xlsx)">Excel</button> : null}
      </div>
      {notaFull ? <div style={{ padding: "6px 14px", fontSize: 11.5, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{notaFull}</div> : null}
      {loading ? (
        <SkelTabla />
      ) : error ? (
        <div style={{ padding: 16, color: "var(--danger)" }}>No se pudo cargar: {error}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <Tabla
            head={cols.map((c) => c.label)}
            aligns={cols.map((c) => (c.right ? "r" : "l"))}
            rows={(items || []).map((it) => cols.map((c) => celda(c, it)))}
            empty="Sin datos para los filtros elegidos."
            foot={tot ? cols.map((c, i) => (i === 0 ? "Totales" : tot[c.k] != null ? cell(c, tot[c.k], tot) : "")) : undefined}
          />
        </div>
      )}
    </div>
  );
}

// Columnas dinámicas (para tablas cuyo detalle define el backend, ej. valorización).
const LBL = { categoria: "Categoría", sector: "Sector", skus: "SKUs", unidades: "Unidades", cajas: "Cajas", productos: "Productos", valor_costo: "Valor costo", valor_venta: "Valor venta", sin_costo: "Sin costo", pct: "% del total" };
const dynCols = (arr) => {
  const it = (arr || [])[0];
  if (!it) return [];
  return Object.keys(it).filter((k) => !k.startsWith("_")).map((k) => {
    const esNum = typeof it[k] === "number";
    return {
      k,
      label: LBL[k] || k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      fmt: esNum ? (/pct|porcentaje/.test(k) ? "pct" : /valor|costo|venta|total|monto/.test(k) ? "clp" : "num") : "txt",
      right: esNum,
    };
  });
};
const dynTot = (arr, cols) => (arr?.length ? Object.fromEntries(cols.filter((c) => c.right && c.fmt !== "pct").map((c) => [c.k, sum(arr, c.k)])) : null);

// ── VENTAS ─────────────────────────────────────────────────────────────────────

function InfRanking() {
  const [by, setBy] = useState("producto");
  const [from, setFrom] = useState(dAgo(29));
  const [to, setTo] = useState(hoy());
  const r = useLoad(() => api.rRanking({ by, from, to, limit: 50 }), null, [by, from, to]);
  const items = (r.data?.items || []).map((it, i) => ({ pos: i + 1, ...it }));
  const cols = [
    { k: "pos", label: "#", right: true },
    { k: "nombre", label: { producto: "Producto", cliente: "Cliente" }[by], bold: true },
    { k: "total", label: "Vendido $", fmt: "clp", right: true, bold: true },
    { k: "unidades", label: "Unidades", fmt: "num", right: true },
    { k: "pedidos", label: "Pedidos", fmt: "num", right: true },
    { k: "ticket_prom", label: "Ticket prom.", fmt: "clp", right: true },
  ];
  const tot = items.length ? { total: sum(items, "total"), unidades: sum(items, "unidades"), pedidos: sum(items, "pedidos") } : null;
  return (
    <TablaInf
      nombre={`Ranking por ${by}`} cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} nota="Top 50 del periodo, ordenado por venta"
      filtros={<>
        <Seg options={[{ value: "producto", label: "Producto" }, { value: "cliente", label: "Cliente" }]} value={by} onChange={setBy} />
        <Rango from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </>}
    />
  );
}

function InfLibroVentas() {
  const [month, setMonth] = useState(hoy().slice(0, 7));
  const r = useLoad(() => api.rLibroVentas(month), null, [month]);
  const items = r.data?.items || [];
  const t = r.data?.totales || {};
  const cols = [
    { k: "fecha", label: "Fecha", fmt: "date" },
    { k: "folio", label: "Folio" },
    { k: "cliente", label: "Cliente", bold: true },
    { k: "metodo", label: "Método" },
    { k: "neto", label: "Neto", fmt: "clp", right: true },
    { k: "iva", label: "IVA", fmt: "clp", right: true },
    { k: "total", label: "Total", fmt: "clp", right: true, bold: true },
  ];
  const tot = items.length ? { neto: t.neto ?? sum(items, "neto"), iva: t.iva ?? sum(items, "iva"), total: t.total ?? sum(items, "total") } : null;
  return (
    <TablaInf
      nombre="Libro de ventas" cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} nota="Libro interno (pre-SII) · documentos del mes"
      filtros={<label style={lblS}>Mes <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputS} /></label>}
    />
  );
}

// ── INVENTARIO ─────────────────────────────────────────────────────────────────

function InfValorizacion() {
  const r = useLoad(() => api.rValorizacion(), null, []);
  const d = r.data;
  const t = d?.totales || {};
  const cat = d?.por_categoria || [];
  const sec = d?.por_sector || [];
  const colsCat = dynCols(cat);
  const colsSec = dynCols(sec);
  const exportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`${brand.name} — Valorización de inventario`], ["Estimada a costo actual (precio de costo vigente)"], [],
      ["Valor a costo", t.valor_costo ?? ""], ["Valor a precio venta", t.valor_venta ?? ""],
      ["SKUs con stock", t.skus ?? ""], ["SKUs sin costo", t.sin_costo ?? ""],
    ]), "Totales");
    if (cat.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colsCat.map((c) => c.label), ...cat.map((it) => colsCat.map((c) => it[c.k] ?? ""))]), "Por categoría");
    if (sec.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colsSec.map((c) => c.label), ...sec.map((it) => colsSec.map((c) => it[c.k] ?? ""))]), "Por sector");
    XLSX.writeFile(wb, `${brand.name}-Valorizacion-${hoy()}.xlsx`);
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginRight: "auto" }}>Valorización estimada a costo actual (precio de costo vigente, no histórico por lote).</div>
        <button onClick={exportar} disabled={!d} style={{ ...btnXls, opacity: d ? 1 : 0.5 }} title="Descargar valorización completa en Excel">Excel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <Kpi label="Valor a costo" value={d ? mm(t.valor_costo) : "…"} />
        <Kpi label="Valor a precio venta" value={d ? mm(t.valor_venta) : "…"} />
        <Kpi label="SKUs con stock" value={d ? num(t.skus) : "…"} />
        <Kpi label="SKUs sin costo" value={d ? num(t.sin_costo) : "…"} sub="no entran a la valorización" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        <TablaInf nombre="Por categoría" cols={colsCat} items={cat} tot={dynTot(cat, colsCat)} loading={r.loading} error={r.error} sinExcel />
        <TablaInf nombre="Por sector" cols={colsSec} items={sec} tot={dynTot(sec, colsSec)} loading={r.loading} error={r.error} sinExcel />
      </div>
    </div>
  );
}

function InfRotacion() {
  const [days, setDays] = useState(30);
  const r = useLoad(() => api.rRotacion(days), null, [days]);
  const items = (r.data?.items || []).map((it) => ({
    ...it,
    estado: it.quiebre ? "Quiebre" : it.inmovil ? "Inmóvil" : it.sobre_stock ? "Sobre stock" : "OK",
  }));
  const cols = [
    { k: "producto", label: "Producto", bold: true },
    { k: "vendidas", label: `Vendidas (${days} d)`, fmt: "num", right: true },
    { k: "venta_prom_dia", label: "Venta prom./día", fmt: "dec", right: true },
    { k: "stock", label: "Stock", fmt: "num", right: true },
    { k: "cobertura_dias", label: "Cobertura (días)", fmt: "dec", right: true },
    { k: "estado", label: "Estado", bold: true, tint: (v) => (v === "Quiebre" ? "var(--danger)" : v === "Inmóvil" ? "var(--muted)" : v === "Sobre stock" ? "var(--warn)" : "var(--ok)") },
  ];
  const tot = items.length ? { vendidas: sum(items, "vendidas"), stock: sum(items, "stock") } : null;
  return (
    <TablaInf
      nombre="Rotación, sobre stock y quiebres" cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} nota="Cobertura = stock ÷ venta promedio diaria del periodo"
      filtros={<Seg options={[30, 60, 90].map((n) => ({ value: n, label: `${n} días` }))} value={days} onChange={setDays} />}
    />
  );
}

function InfKardex() {
  const [from, setFrom] = useState(dAgo(29));
  const [to, setTo] = useState(hoy());
  const r = useLoad(() => api.rKardexValorizado({ from, to, limit: 300 }), null, [from, to]);
  const items = r.data?.items || [];
  const t = r.data?.totales || {};
  const cols = [
    { k: "fecha", label: "Fecha", fmt: "datetime" },
    { k: "producto", label: "Producto", bold: true },
    { k: "tipo", label: "Tipo" },
    { k: "cantidad", label: "Cantidad", fmt: "num", right: true, tint: (v) => (Number(v) < 0 ? "var(--danger)" : undefined) },
    { k: "stock_after", label: "Stock final", fmt: "num", right: true },
    { k: "costo_unit", label: "Costo unit.", fmt: "clp", right: true },
    { k: "valor", label: "Valor $", fmt: "clp", right: true, bold: true },
  ];
  const tot = items.length ? { cantidad: t.cantidad ?? sum(items, "cantidad"), valor: t.valor ?? sum(items, "valor") } : null;
  return (
    <TablaInf
      nombre="Kardex valorizado" cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} meta={r.data?.meta} nota="Movimientos de inventario en unidades y $ (máx. 300 filas)"
      filtros={<Rango from={from} to={to} setFrom={setFrom} setTo={setTo} />}
    />
  );
}

// ── FINANZAS ───────────────────────────────────────────────────────────────────

function InfMargen() {
  const [from, setFrom] = useState(dAgo(29));
  const [to, setTo] = useState(hoy());
  const r = useLoad(() => api.rMargen({ from, to }), null, [from, to]);
  const items = r.data?.items || [];
  const t = r.data?.totales || {};
  const cols = [
    { k: "producto", label: "Producto", bold: true },
    { k: "venta", label: "Venta", fmt: "clp", right: true },
    { k: "costo", label: "Costo", fmt: "clp", right: true },
    { k: "margen", label: "Margen $", fmt: "clp", right: true, bold: true, tint: (v) => (Number(v) < 0 ? "var(--danger)" : undefined) },
    { k: "margen_pct", label: "Margen %", fmt: "pct", right: true },
  ];
  const venta = t.venta ?? sum(items, "venta");
  const margen = t.margen ?? sum(items, "margen");
  const tot = items.length ? { venta, costo: t.costo ?? sum(items, "costo"), margen, margen_pct: t.margen_pct ?? (venta ? Math.round((margen / venta) * 1000) / 10 : null) } : null;
  return (
    <TablaInf
      nombre="Márgenes por producto" cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} meta={r.data?.meta}
      filtros={<Rango from={from} to={to} setFrom={setFrom} setTo={setTo} />}
    />
  );
}

function InfConteos() {
  const r = useLoad(() => api.counts({ status: "closed", limit: 50 }), null, []);
  const items = (r.data?.items || []).map((c) => ({
    fecha: c.closed_at || c.updated_at,
    alcance: c.scope?.label || c.scope?.value || c.scope?.type || null,
    cerrado_por: c.closed_by?.label || null,
    lineas: Array.isArray(c.lines) ? c.lines.length : null,
    ajustadas: c.applied?.lines_adjusted ?? 0,
    delta: c.applied?.units_delta ?? 0,
  }));
  const cols = [
    { k: "fecha", label: "Cerrado", fmt: "datetime" },
    { k: "alcance", label: "Alcance", bold: true },
    { k: "cerrado_por", label: "Cerrado por" },
    { k: "lineas", label: "Líneas", fmt: "num", right: true },
    { k: "ajustadas", label: "Con diferencia", fmt: "num", right: true },
    { k: "delta", label: "Δ unidades", fmt: "num", right: true, bold: true, tint: (v) => (Number(v) < 0 ? "var(--danger)" : Number(v) > 0 ? "var(--warn)" : "var(--ok)") },
  ];
  const tot = items.length ? { ajustadas: sum(items, "ajustadas"), delta: sum(items, "delta") } : null;
  return (
    <TablaInf
      nombre="Diferencias de conteo físico" cols={cols} items={items} tot={tot}
      loading={r.loading} error={r.error} nota="Ajustes aplicados al cerrar cada conteo · Δ unidades = contado − teórico"
    />
  );
}

const INFORMES = [
  { id: "ranking", grupo: "Ventas", chip: "Ranking", Comp: InfRanking },
  { id: "libro", grupo: "Ventas", chip: "Libro de ventas", Comp: InfLibroVentas },
  { id: "valorizacion", grupo: "Inventario", chip: "Valorización", Comp: InfValorizacion },
  { id: "rotacion", grupo: "Inventario", chip: "Rotación y quiebres", Comp: InfRotacion },
  { id: "kardex", grupo: "Inventario", chip: "Kardex valorizado", Comp: InfKardex },
  { id: "margen", grupo: "Finanzas", chip: "Márgenes", Comp: InfMargen },
  { id: "conteos", grupo: "Finanzas", chip: "Diferencias de conteo", Comp: InfConteos },
];
const GRUPOS = ["Ventas", "Inventario", "Finanzas"];

// ── Pantalla ───────────────────────────────────────────────────────────────────

export default function Reportes() {
  const [periodo, setPeriodo] = useState("mes");
  const [informe, setInforme] = useState("ranking");
  const [csvBusy, setCsvBusy] = useState(false);
  const cfg = PERIODOS[periodo];
  const from = dAgo(cfg.days), to = hoy();
  const g = useLoad(() => api.gerencia({ from, to }), null, [periodo]);
  const cob = useLoad(() => api.cobranzaResumen(), null, []);
  const d = g.data;

  if (usingMock) return <div className="card" style={{ padding: 18, color: "var(--muted)" }}>Los reportes usan datos reales. Conecta el backend para verlos.</div>;

  const { ventas, productos, equipo, finanzas, cobros, operacion } = d || {};
  const aging = cob.data?.aging;
  const llamarHoy = cob.data?.llamarHoy || [];
  const vencido = aging ? (aging.total || 0) - (aging.buckets?.vigente || 0) : 0;
  const periodoTxt = `${cfg.label} · ${from} a ${to}`;

  // [label, valor, formato] — el formato evita imprimir "Pedidos" como plata en el PDF.
  const resumenRows = () => [
    ["Ventas", finanzas.ingresos.ventas, "clp"], ["Pedidos", ventas.pedidos, "num"], ["Ticket promedio", ventas.ticket, "clp"],
    ["Costo de lo vendido", finanzas.egresos.cogs, "clp"], ["Compras de mercadería", finanzas.egresos.compras, "clp"],
    ["Utilidad bruta", finanzas.utilidadBruta, "clp"], ["Margen bruto %", finanzas.margenBrutoPct, "pct"],
    ["Cobrado", finanzas.ingresos.cobrado, "clp"], ["Por cobrar", aging?.total || 0, "clp"],
  ];

  const descargarExcel = () => {
    if (!d) return;
    const wb = XLSX.utils.book_new();
    const head = [[`${brand.name} — Reporte de gestión`], [periodoTxt], [], ["Indicador", "Valor"]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, ...resumenRows().map((r) => [r[0], r[1]])]), "Resumen");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Día", "Ventas", "Pedidos"], ...ventas.serie.map((s) => [s.dia, s.total, s.pedidos])]), "Ventas por día");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Más vendidos", "Unidades", "Ingresos"], ...productos.top.map((p) => [p.name, p.qty, p.revenue]),
      [], ["Menos vendidos", "Unidades", "Ingresos"], ...productos.bottom.map((p) => [p.name, p.qty, p.revenue]),
      [], ["Rentabilidad", "Margen %", "Utilidad"], ...productos.margen.map((p) => [p.name, p.margenPct, p.utilidad]),
    ]), "Productos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Persona", "Pedidos preparados", "Prep. media (min)"],
      ...(equipo?.preparacion || []).map((b) => [b.label, b.preparados, b.prep_prom_min]),
    ]), "Equipo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Estado de resultados"], [], ["Ventas", finanzas.ingresos.ventas], ["(-) Costo de lo vendido", finanzas.egresos.cogs],
      ["(=) Utilidad bruta", finanzas.utilidadBruta], ["Margen bruto %", finanzas.margenBrutoPct], [], ["Compras de mercadería", finanzas.egresos.compras],
      ["Cobrado", finanzas.ingresos.cobrado], ["Por cobrar", aging?.total || 0],
    ]), "Finanzas");
    XLSX.writeFile(wb, `Reporte-${brand.name}-${to}.xlsx`);
  };

  const descargarPDF = () => {
    if (!d) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(40); doc.text(`${brand.name} — Reporte de gestión`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(120); doc.text(periodoTxt, 14, 25);
    const opt = { theme: "grid", headStyles: { fillColor: MAGENTA }, styles: { fontSize: 9 }, margin: { left: 14, right: 14 } };
    autoTable(doc, { ...opt, startY: 31, head: [["Indicador", "Valor"]], body: resumenRows().map(([l, v, f]) => [l, f === "pct" ? `${v ?? 0}%` : f === "num" ? num(v) : clp(v)]) });
    autoTable(doc, { ...opt, head: [["Más vendidos", "Unid.", "Ingresos"]], body: productos.top.map((p) => [p.name, num(p.qty), clp(p.revenue)]) });
    autoTable(doc, { ...opt, head: [["Rentabilidad por producto", "Margen", "Utilidad"]], body: productos.margen.map((p) => [p.name, `${p.margenPct}%`, clp(p.utilidad)]) });
    autoTable(doc, { ...opt, head: [["Persona", "Preparados", "Prep. media (min)"]], body: (equipo?.preparacion || []).map((b) => [b.label, num(b.preparados), num(b.prep_prom_min)]) });
    doc.save(`Reporte-${brand.name}-${to}.pdf`);
  };

  // Detalle de pedidos del periodo en CSV (endpoint /admin/orders/export).
  const descargarCSV = async () => {
    setCsvBusy(true);
    try {
      const blob = await api.exportOrders({ from, to });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pedidos-${brand.name}-${from}-a-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo exportar el CSV: " + e.message);
    } finally {
      setCsvBusy(false);
    }
  };

  // Botón de export: uno primario (PDF con marca) y el resto neutros.
  const btnGhost = { padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnPrim = { ...btnGhost, border: "1px solid var(--magenta)", background: "var(--magenta)", color: "#fff", fontWeight: 700 };

  let resumen;
  if (g.loading && !d) {
    resumen = (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={84} />)}
        </div>
        <Skel h={190} />
      </>
    );
  } else if (g.error && !d) {
    resumen = <div className="card" style={{ padding: 18, color: "var(--danger)" }}>No se pudo generar: {g.error}</div>;
  } else if (!d) {
    resumen = <div className="card" style={{ padding: 18, color: "var(--muted)" }}>Sin datos.</div>;
  } else {
    resumen = (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
          <Kpi label="Ventas" value={mm(finanzas.ingresos.ventas)}
            delta={ventas.variacionPct != null ? { pct: ventas.variacionPct, good: ventas.variacionPct >= 0 } : undefined}
            sub={ventas.variacionPct == null ? "sin comparación" : undefined} />
          <Kpi label="Pedidos" value={num(ventas.pedidos)} sub={`ticket ${clp(ventas.ticket)}`} />
          <Kpi label="Utilidad bruta" value={mm(finanzas.utilidadBruta)} sub={finanzas.margenBrutoPct != null ? `margen ${finanzas.margenBrutoPct}%` : null} />
          <Kpi label="Costo de lo vendido" value={mm(finanzas.egresos.cogs)} sub="COGS del periodo" />
          <Kpi label="Compras" value={mm(finanzas.egresos.compras)} sub="reposición inventario" />
          <Kpi label="Cobrado" value={mm(finanzas.ingresos.cobrado)} sub={`${num(cobros?.count || 0)} cobros`} />
          <Kpi label="Por cobrar" value={aging ? mm(aging.total) : "…"} sub={aging ? (vencido > 0 ? `vencido ${mm(vencido)}` : null) : "cargando cobranza"} />
          <Kpi label="Entregados" value={num(operacion?.entregados || 0)} sub={operacion?.cuello ? `cuello ${operacion.cuello.etapa}` : null} />
        </div>

        <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Ventas por día <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· pasa el cursor</span></div>
          <Bars serie={ventas.serie} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
          <CardTabla titulo="Más vendidos">
            <Tabla head={["Producto", "Unidades", "Ingresos"]} aligns={["l", "r", "r"]} empty="Sin datos."
              rows={productos.top.slice(0, 8).map((p) => [p.name, <span style={{ color: "var(--muted)" }}>{num(p.qty)} u</span>, <span style={{ fontWeight: 600 }}>{clp(p.revenue)}</span>])} />
          </CardTabla>
          <CardTabla titulo="Menos vendidos (liquidar)">
            <Tabla head={["Producto", "Unidades", "Ingresos"]} aligns={["l", "r", "r"]} empty="Sin datos."
              rows={productos.bottom.slice(0, 8).map((p) => [p.name, <span style={{ color: "var(--muted)" }}>{num(p.qty)} u</span>, <span style={{ fontWeight: 600 }}>{clp(p.revenue)}</span>])} />
          </CardTabla>
          <CardTabla titulo="Rentabilidad por producto">
            <Tabla head={["Producto", "Margen %", "Utilidad"]} aligns={["l", "r", "r"]} empty="Sin datos."
              rows={productos.margen.slice(0, 8).map((p) => [p.name, <span style={{ color: "var(--muted)" }}>{p.margenPct}%</span>, <span style={{ fontWeight: 600 }}>{clp(p.utilidad)}</span>])} />
          </CardTabla>
          <CardTabla titulo="Preparación por persona">
            <Tabla head={["Persona", "Preparados", "Prep. media"]} aligns={["l", "r", "r"]} empty="Sin datos."
              rows={(equipo?.preparacion || []).slice(0, 8).map((b) => [b.label, <span style={{ color: "var(--muted)" }}>{num(b.preparados)} ped.</span>, <span style={{ fontWeight: 600 }}>{num(b.prep_prom_min)} min</span>])} />
          </CardTabla>
          <CardTabla titulo="A quién cobrar hoy">
            <Tabla head={["Cliente", "Atraso", "Monto"]} aligns={["l", "r", "r"]} empty="Sin cobranzas urgentes."
              rows={llamarHoy.slice(0, 8).map((c) => [
                <span>{c.cliente}<span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{c.documento}</span></span>,
                <span style={{ color: c.diasVencida > 90 ? "var(--danger)" : "var(--warn)", fontWeight: 600 }}>{num(c.diasVencida)} d</span>,
                <span style={{ fontWeight: 600 }}>{clp(c.monto)}</span>,
              ])} />
          </CardTabla>
        </div>
      </>
    );
  }

  const sel = INFORMES.find((i) => i.id === informe);
  const SelComp = sel?.Comp;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Seg options={Object.entries(PERIODOS).map(([k, v]) => ({ value: k, label: v.label }))} value={periodo} onChange={setPeriodo} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={descargarExcel} disabled={!d} style={{ ...btnGhost, opacity: d ? 1 : 0.5 }} title="Descargar Excel (.xlsx) con todas las hojas">Excel</button>
          <button onClick={descargarPDF} disabled={!d} style={{ ...btnPrim, opacity: d ? 1 : 0.5 }} title="Descargar PDF con marca">PDF</button>
          <button onClick={descargarCSV} disabled={csvBusy} style={btnGhost} title="Descargar el detalle de pedidos del periodo en CSV">{csvBusy ? "Generando…" : "CSV pedidos"}</button>
          <button onClick={() => window.print()} style={btnGhost}>Imprimir</button>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Resumen ejecutivo · {periodoTxt}</div>
      {resumen}

      <div style={{ marginTop: 22 }}>
        <div className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Biblioteca de informes</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Informes de gestión estilo ERP · filtros propios y descarga Excel en cada uno</div>
          {GRUPOS.map((gname) => (
            <div key={gname} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: "var(--muted)", textTransform: "uppercase", minWidth: 88 }}>{gname}</span>
              {INFORMES.filter((i) => i.grupo === gname).map((i) => (
                <Chip key={i.id} on={informe === i.id} onClick={() => setInforme(i.id)}>{i.chip}</Chip>
              ))}
            </div>
          ))}
        </div>
        {SelComp ? <SelComp /> : null}
      </div>
    </div>
  );
}
