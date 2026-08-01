// Kit de UI compartido del panel (Gerencia, Reportes y futuras pantallas).
// Componentes PUROS de presentación: sin fetch, sin estado de negocio.
// Los estilos base viven en index.css: .tbl (tabla canónica), .seg (segmented
// control), .skel (skeleton) y los tokens --magenta-d/--ok/--warn/--danger/
// --border-soft. Aquí solo se aplica estructura + clases + mínimos inline.

// KPI card estándar (patrón Stripe): label muted uppercase → valor grande
// tabular-nums → delta ▲/▼ coloreada "vs periodo anterior" o sub en muted.
// delta = { pct: number, good: boolean } (good pinta verde, si no rojo).
export function Kpi({ label, value, sub, delta, onClick }) {
  return (
    <div className={onClick ? "card card-link" : "card"} onClick={onClick} style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        {onClick ? <span style={{ color: "var(--muted)", opacity: 0.55, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>›</span> : null}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {delta != null ? (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
          <span style={{ color: delta.good ? "var(--ok)" : "var(--danger)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {delta.pct >= 0 ? "▲" : "▼"} {Math.abs(Number(delta.pct) || 0)}%
          </span>{" "}
          vs periodo anterior
        </div>
      ) : null}
      {sub != null ? <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: delta != null ? 2 : 4 }}>{sub}</div> : null}
    </div>
  );
}

// Tabla canónica: usa la clase .tbl del CSS global (thead sticky, header 11px
// uppercase, filas 36-40px). aligns[i] = "l" | "r" por columna (th y td juntos);
// las celdas "r" llevan .ta-r (text-align right + tabular-nums).
// rows = array de filas; cada fila = array de celdas (texto o JSX).
// foot (opcional) = fila de totales, mismas columnas, en negrita.
export function Tabla({ head = [], aligns = [], rows = [], empty = "Sin datos.", foot, onRowClick }) {
  const cls = (i) => (aligns[i] === "r" ? "ta-r" : undefined);
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} className={cls(i)}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r, ri) => (
            <tr
              key={ri}
              onClick={onRowClick ? (e) => { e.stopPropagation(); onRowClick(ri); } : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
              title={onRowClick ? "Ver detalle" : undefined}
            >
              {r.map((c, ci) => <td key={ci} className={cls(ci)}>{c}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={head.length || 1} style={{ color: "var(--muted)", padding: 14 }}>{empty}</td></tr>
          )}
        </tbody>
        {foot ? (
          <tfoot>
            <tr>{foot.map((c, i) => <td key={i} className={cls(i)} style={{ fontWeight: 700, borderTop: "2px solid var(--border-soft)" }}>{c}</td>)}</tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

// Segmented control: grupo único con borde compartido (clase .seg del CSS
// global); ítem activo con fondo de marca. options = [{ value, label }].
export function Seg({ options = [], value, onChange }) {
  return (
    <div className="seg" role="tablist" style={{ display: "inline-flex", alignItems: "stretch", border: "1px solid var(--border-soft)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            className={on ? "on" : undefined}
            onClick={() => onChange(o.value)}
            style={{
              padding: "7px 14px",
              border: "none",
              borderLeft: i ? "1px solid var(--border-soft)" : "none",
              borderRadius: 0,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: on ? "var(--magenta-d)" : "transparent",
              color: on ? "#fff" : "var(--muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Skeleton de carga (clase .skel del CSS global: shimmer + radius).
export function Skel({ h = 16, w }) {
  return <div className="skel" style={{ height: h, width: w || "100%" }} aria-hidden="true" />;
}
