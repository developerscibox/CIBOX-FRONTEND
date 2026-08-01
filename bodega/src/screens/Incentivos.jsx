import { useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { Kpi, Tabla, Seg, Skel } from "../components/Ui.jsx";

// DETALLE DE INCENTIVOS de vendedores (plan piloto por puntos). Misma familia
// visual que Gerencia: selector de periodo, KPIs, ranking completo clicable y
// panel de detalle por vendedor con el desglose del cálculo y sus pedidos.

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
// Fecha dd/mm/aaaa desde un timestamp completo (created_at del pedido).
const fmtDia = (x) => { const d = new Date(x); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };

const PERIODOS = {
  hoy: { label: "Hoy", days: 0 },
  semana: { label: "7 días", days: 6 },
  mes: { label: "30 días", days: 29 },
  trimestre: { label: "Trimestre", days: 89 },
};
const ETAPA_LABEL = { pending: "Tomado (por pagar)", paid: "Cobrado", preparing: "En preparación", ready: "Listo para retiro", shipped: "Despachado", delivered: "Entregado", cancelled: "Anulado", refunded: "Reembolsado" };

const Card = ({ children, p = 16, style, className = "" }) => (
  <div className={`card${className ? " " + className : ""}`} style={{ padding: p, ...style }}>{children}</div>
);

// Card con barra de título + contenido (mismo patrón TCard de Gerencia).
function TCard({ titulo, extra, children, style }) {
  return (
    <Card p={0} style={{ overflow: "hidden", ...style }}>
      <div style={{ padding: "11px 14px", fontWeight: 700, fontSize: 13.5, borderBottom: "1px solid var(--border-soft)" }}>
        {titulo}{extra ? <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}> {extra}</span> : null}
      </div>
      {children}
    </Card>
  );
}

// Línea del desglose de puntos: etiqueta a la izquierda, cálculo a la derecha.
const Linea = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, fontSize: 13, padding: "5px 0", borderTop: "1px solid var(--border-soft)" }}>
    <span style={{ color: "var(--muted)" }}>{k}</span>
    <b style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</b>
  </div>
);

export default function Incentivos() {
  const [periodo, setPeriodo] = useState("mes");
  const [sel, setSel] = useState(null); // vendedor seleccionado del ranking
  const cfg = PERIODOS[periodo];
  const from = dAgo(cfg.days);
  const to = hoy();

  const g = useLoad(() => api.gerencia({ from, to }), null, [periodo]);
  // Muestra reciente de pedidos para el detalle por vendedor (filtro client-side).
  const ord = useLoad(() => api.orders({ limit: 100 }), null, []);
  const d = g.data;

  if (usingMock) return <Card style={{ color: "var(--muted)" }}>El detalle de incentivos usa datos reales del negocio. Conéctalo al backend (VITE_API_URL) para verlo.</Card>;
  if (g.loading && !d) return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Skel h={34} w={320} /><Skel h={14} w={170} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
        {[0, 1, 2, 3].map((i) => <Skel key={i} h={88} />)}
      </div>
      <Skel h={260} />
    </div>
  );
  if (g.error && !d) return <Card style={{ color: "var(--danger)" }}>No se pudo cargar: {g.error}</Card>;
  if (!d || !d.incentivos) return <Card style={{ color: "var(--muted)" }}>Sin datos de incentivos.</Card>;

  const { config, ranking } = d.incentivos;
  const totPuntos = ranking.reduce((a, v) => a + (v.puntos?.total || 0), 0);
  const totUnidades = ranking.reduce((a, v) => a + (v.unidades || 0), 0);
  const totMonto = ranking.reduce((a, v) => a + (v.monto || 0), 0);

  // Pedidos del vendedor seleccionado: el ranking no trae id, así que se cruza
  // por nombre (Order.seller.nombre ≡ label del ranking) + rango del periodo.
  const pedidosSel = sel
    ? (ord.data?.orders || []).filter((o) => {
        const dia = String(o.created_at).slice(0, 10);
        return o.seller?.nombre === sel.label && dia >= from && dia <= to;
      })
    : [];

  return (
    <div>
      {/* Encabezado: selector de periodo + rango de fechas */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>Periodo</span>
          <Seg options={Object.entries(PERIODOS).map(([k, v]) => ({ value: k, label: v.label }))} value={periodo} onChange={(v) => { setPeriodo(v); setSel(null); }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtCL(from)} → {fmtCL(to)}</div>
      </div>

      {/* Plan piloto: la regla del cálculo, visible siempre */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Plan piloto de incentivos <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· referencia, modificable</span></div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
          Cada vendedor gana <b>{config.puntosPorUnidad} punto por unidad vendida</b> y <b>{config.puntosPorMilCLP} punto por cada $1.000 vendidos</b>.<br />
          <b>Puntos = unidades + (venta ÷ 1.000)</b>. Trazable: cada punto sale de pedidos reales del vendedor.
        </div>
      </Card>

      {/* KPIs del periodo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Vendedores en ranking" value={num(ranking.length)} />
        <Kpi label="Puntos totales del periodo" value={num(totPuntos)} />
        <Kpi label="Unidades vendidas" value={num(totUnidades)} />
        <Kpi label="$ vendido" value={mm(totMonto)} />
      </div>

      {/* Ranking + detalle del vendedor (mismo layout que la Trazabilidad) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <TCard titulo={`Ranking de puntos del periodo · ${ranking.length}`} extra="· clic para ver detalle">
          <Tabla head={["#", "Vendedor", "Pedidos", "Unidades", "$ vendido", "Puntos"]}
            aligns={["l", "l", "r", "r", "r", "r"]}
            empty="Sin ventas atribuidas a vendedores en el periodo."
            onRowClick={(i) => setSel(ranking[i])}
            rows={ranking.map((v) => [
              <span style={{ color: "var(--muted)" }}>{v.ranking}</span>,
              <span style={{ fontWeight: sel?.label === v.label ? 700 : 600, color: sel?.label === v.label ? "var(--magenta-d)" : "inherit" }}>{v.label}</span>,
              num(v.pedidos),
              num(v.unidades),
              clp(v.monto),
              <>
                <b style={{ color: "var(--magenta-d)" }}>{num(v.puntos.total)}</b>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{num(v.puntos.ptsUnidad)} u · {num(v.puntos.ptsMonto)} $</div>
              </>,
            ])} />
        </TCard>

        <Card>
          {!sel ? (
            <div style={{ color: "var(--muted)" }}>Elige un vendedor del ranking para ver su detalle.</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{sel.label}</div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 12 }}>#{sel.ranking} del ranking · {num(sel.pedidos)} {sel.pedidos === 1 ? "pedido" : "pedidos"} en el periodo</div>

              {/* Desglose: de dónde sale cada punto */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Cómo se calculan sus puntos</div>
              <Linea k={`${num(sel.unidades)} unidades × ${config.puntosPorUnidad} pt`} v={`${num(sel.puntos.ptsUnidad)} pts`} />
              <Linea k={`${clp(sel.monto)} ÷ 1.000 × ${config.puntosPorMilCLP} pt`} v={`${num(sel.puntos.ptsMonto)} pts`} />
              {sel.puntos.ptsBono > 0 ? <Linea k="Bono por meta del periodo" v={`${num(sel.puntos.ptsBono)} pts`} /> : null}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, fontSize: 14, padding: "7px 0", borderTop: "2px solid var(--border-soft)" }}>
                <b>Total</b>
                <b style={{ color: "var(--magenta-d)", fontVariantNumeric: "tabular-nums" }}>{num(sel.puntos.total)} pts</b>
              </div>

              {/* Sus pedidos del periodo (sobre la muestra reciente de 100) */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 4px" }}>Pedidos del periodo</div>
              {ord.loading ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Cargando pedidos…</div>
              ) : pedidosSel.length ? (
                pedidosSel.map((o) => (
                  <div key={o._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0", borderTop: "1px solid var(--border-soft)", fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13 }}>#{String(o._id).slice(-6).toUpperCase()}</b>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}> · {fmtDia(o.created_at)} · {ETAPA_LABEL[o.status] || o.status}</span>
                    </div>
                    <b style={{ whiteSpace: "nowrap" }}>{clp(o.total)}</b>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin pedidos del periodo en la muestra reciente.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
