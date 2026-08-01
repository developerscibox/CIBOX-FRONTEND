import { api, useLoad, usingMock } from "../api.js";
import { clp } from "../theme.js";

// PERFIL DEL VENDEDOR DE SALA — sus propias métricas (no ve las de otros).
// Cuánto vendió, cuántos pedidos y personas atendió (hoy/semana/mes) + progreso
// hacia su meta mensual de incentivos. Pensado para el celular (cards grandes).

const num = (n) => (Number(n) || 0).toLocaleString("es-CL");

const MOCK = {
  hoy: { ventas: 184000, pedidos: 6, unidades: 72, clientes: 5 },
  semana: { ventas: 980000, pedidos: 28, unidades: 360, clientes: 22 },
  mes: { ventas: 2150000, pedidos: 73, unidades: 910, clientes: 58 },
  incentivos: { puntos: { ptsUnidad: 910, ptsMonto: 2150, ptsBono: 0, total: 3060 }, meta: 3000000, progresoPct: 72, faltaParaMeta: 850000 },
};

const Kpi = ({ label, value, sub, accent }) => (
  <div className="card" style={{ padding: 16, borderLeft: `4px solid ${accent}` }}>
    <div style={{ fontSize: 12.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
    {sub ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{sub}</div> : null}
  </div>
);

export default function MisMetricas() {
  const { data, loading, error } = useLoad(() => api.misMetricas(), usingMock ? MOCK : null, []);

  if (loading && !data) return <div className="card" style={{ padding: 18 }}>Cargando tus métricas…</div>;
  if (error && !data) return <div className="card" style={{ padding: 18, color: "var(--danger)" }}>No se pudieron cargar las métricas: {error}</div>;
  const d = data || MOCK;
  const inc = d.incentivos || {};
  const pct = Math.max(0, Math.min(100, inc.progresoPct || 0));
  const meta = inc.meta || 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Hoy */}
      <div style={{ fontWeight: 800, fontSize: 15, margin: "2px 2px 8px" }}>Hoy</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <Kpi label="Ventas de hoy" value={clp(d.hoy.ventas)} accent="var(--ok)" />
        <Kpi label="Pedidos" value={num(d.hoy.pedidos)} accent="var(--magenta-d)" />
        <Kpi label="Personas atendidas" value={num(d.hoy.clientes)} accent="var(--magenta)" />
      </div>

      {/* Progreso del mes / incentivos */}
      <div className="card" style={{ padding: 18, marginBottom: 16, background: "linear-gradient(135deg,#fff, #faf3f8)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Mi meta del mes</div>
          <div style={{ fontWeight: 800, color: "var(--magenta-d)" }}>{pct}%</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, marginBottom: 12 }}>
          Llevas <b style={{ color: "var(--ok)" }}>{clp(d.mes.ventas)}</b> de <b>{clp(meta)}</b>
          {inc.faltaParaMeta > 0 ? <> · te faltan <b style={{ color: "var(--warn)" }}>{clp(inc.faltaParaMeta)}</b></> : <> · <b style={{ color: "var(--ok)" }}>Meta cumplida</b></>}
        </div>
        <div style={{ height: 16, background: "#f0e4ee", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--ok)" : "linear-gradient(90deg,var(--magenta-d),var(--magenta))", transition: "width .5s", borderRadius: 999 }} />
        </div>
        {inc.puntos ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <span className="badge" style={{ background: "#f3eef6", color: "var(--magenta-d)", fontWeight: 800, fontSize: 13 }}>{num(inc.puntos.total)} puntos</span>
            <span className="badge" style={{ background: "#ecfdf3", color: "#166534" }}>{num(inc.puntos.ptsUnidad)} por unidades</span>
            <span className="badge" style={{ background: "#eff6ff", color: "#1e40af" }}>{num(inc.puntos.ptsMonto)} por venta</span>
            {inc.puntos.ptsBono > 0 ? <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>+{num(inc.puntos.ptsBono)} bono</span> : null}
          </div>
        ) : null}
      </div>

      {/* Semana y mes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Últimos 7 días</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Vendido</span><b>{clp(d.semana.ventas)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Pedidos</span><b>{num(d.semana.pedidos)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Personas</span><b>{num(d.semana.clientes)}</b></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Este mes</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Vendido</span><b>{clp(d.mes.ventas)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Pedidos</span><b>{num(d.mes.pedidos)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span style={{ color: "var(--muted)" }}>Personas</span><b>{num(d.mes.clientes)}</b></div>
        </div>
      </div>
    </div>
  );
}
