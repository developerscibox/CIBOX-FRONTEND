import { useState } from "react";
import { api, useLoad } from "../api.js";
import { LOW_STOCK_RES, ORDERS_RES, PICKUP_SUMMARY_RES } from "../data.js";
import { ORDER_STATUS, clp } from "../theme.js";
import { StatusBadge, NAV_PERMS } from "../ui.jsx";
import { useAuth } from "../auth.jsx";
import { Kpi } from "../components/Ui.jsx";

const THRESHOLD = 10;
// Fecha de HOY en zona horaria de Chile (el backend usa America/Santiago). Con UTC,
// después de las ~20:00 en Chile el panel abría mostrando "mañana".
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());

function fmtDate(ymd) {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function fmtLong(ymd) {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" });
}

export default function Dashboard({ onNav }) {
  const { can } = useAuth();
  const canInv = can("inventory.read");

  const [selDate, setSelDate] = useState(HOY);          // día cuyos retiros se muestran

  // Solo consultar lo que el rol PUEDE (evita 403 innecesarios).
  const low = useLoad(() => (canInv ? api.lowStock(THRESHOLD) : Promise.resolve({ items: [], count: 0 })), LOW_STOCK_RES);
  const exp = useLoad(() => (canInv ? api.expiringSoon(7) : Promise.resolve({ items: [] })), { items: [] });
  const pend = useLoad(() => api.pendingToPrepare(), ORDERS_RES);                 // paid (por tomar) + preparing
  const pick = useLoad(() => api.pickupSummary(selDate), PICKUP_SUMMARY_RES, [selDate]);
  // Pedidos esperando confirmación de pago (transferencia por verificar).
  const porCobrar = useLoad(() => api.orders({ status: "pending", limit: 50 }), { orders: [] });

  const lowItems = low.data?.items || [];
  const expItems = exp.data?.items || [];
  const pendOrders = pend.data?.orders || [];
  const porTomar = pendOrders.filter((o) => o.status === "paid").length;   // nuevos, sin tomar
  const enPrep = pendOrders.filter((o) => o.status === "preparing").length; // en curso
  const cobrarOrders = porCobrar.data?.orders || [];

  // Degrada elegante: si pickup-summary da 404/error, pick.data es null y todo cae a "—".
  const summary = pick.data || null;
  const byStatus = summary?.by_status || {};
  const dayOrders = summary?.orders || [];
  const upcoming = summary?.upcoming || [];

  // KPIs del día. Cada uno navega a su sección (clicable si el rol puede entrar).
  const kpis = [
    { v: pick.loading ? "…" : (summary?.total_committed ?? "—"), l: "Entregas para hoy", nav: "calendario" },
    { v: pend.loading ? "…" : porTomar, l: "Nuevos por preparar", nav: "picking" },
    { v: pend.loading ? "…" : enPrep, l: "En preparación", nav: "picking" },
    { v: porCobrar.loading ? "…" : cobrarOrders.length, l: "Pagos por confirmar", nav: "pedidos" },
    ...(canInv ? [
      { v: low.loading ? "…" : (low.data?.count ?? lowItems.length), l: "Stock crítico", nav: "inventario" },
      { v: exp.loading ? "…" : expItems.length, l: "Por vencer (7 días)", nav: "fefo" },
    ] : []),
  ];

  // Franja de acciones recomendadas (lo urgente de hoy), según el rol.
  // El estado se comunica con un punto de color (mismo patrón que Gerencia).
  const acciones = [
    cobrarOrders.length > 0 && { txt: `${cobrarOrders.length} con pago por confirmar`, color: "var(--warn)", bg: "#fef3c7", nav: "pedidos" },
    porTomar > 0 && { txt: `${porTomar} nuevo${porTomar === 1 ? "" : "s"} por preparar`, color: "var(--ok)", bg: "#dcfce7", nav: "picking" },
    canInv && expItems.length > 0 && { txt: `${expItems.length} por vencer (7 días)`, color: "var(--warn)", bg: "#ffedd5", nav: "fefo" },
    canInv && (low.data?.count ?? lowItems.length) > 0 && { txt: `${low.data?.count ?? lowItems.length} en stock crítico`, color: "var(--danger)", bg: "#fde7ea", nav: "inventario" },
  ].filter(Boolean);

  return (
    <div>
      {acciones.length > 0 && (
        <div className="card" style={{ padding: "10px 12px", marginBottom: 14, borderLeft: "4px solid var(--warn)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Acciones recomendadas hoy</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {acciones.map((a, i) => {
              const clickable = !!onNav && can(NAV_PERMS[a.nav]);
              return (
                <button key={i} disabled={!clickable} onClick={clickable ? () => onNav(a.nav) : undefined}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: a.bg, color: a.color, border: "none", borderRadius: 999, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: clickable ? "pointer" : "default" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: a.color, flexShrink: 0, display: "inline-block" }} />{a.txt}{clickable ? <span style={{ opacity: .55, fontWeight: 800 }}>›</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="kpis">
        {kpis.map((k, i) => {
          const clickable = !!onNav && can(NAV_PERMS[k.nav]);
          return <Kpi key={i} label={k.l} value={k.v} onClick={clickable ? () => onNav(k.nav) : undefined} />;
        })}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Pagos por confirmar</h2>
          <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>{cobrarOrders.length}</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Cliente</th><th>N°</th><th>Total</th></tr></thead>
          <tbody>
            {porCobrar.loading ? (
              <tr><td colSpan="3" style={{ color: "var(--muted)", padding: 18 }}>Cargando…</td></tr>
            ) : cobrarOrders.length === 0 ? (
              <tr><td colSpan="3" style={{ color: "var(--muted)", padding: 18 }}>Ningún pedido esperando confirmación de pago.</td></tr>
            ) : cobrarOrders.slice(0, 8).map((o) => (
              <tr key={o._id}>
                <td style={{ fontWeight: 600 }}>{o.customer?.fullName || "Cliente"}</td>
                <td className="mono" style={{ color: "var(--muted)" }}>#{String(o._id).slice(-6)}</td>
                <td style={{ fontWeight: 700 }}>{clp(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 15 }}>Cómo fluye un pedido</b>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {[
            { t: "Pagado", who: "cliente en la web", c: "#dbeafe", tc: "#1e40af" },
            { t: "Preparando", who: "operaciones · Preparación", c: "#fef3c7", tc: "#92400e" },
            { t: "Listo", who: "operaciones", c: "#dcfce7", tc: "#166534" },
            { t: "Entregado", who: "cliente recibe el pedido", c: "#ede9fe", tc: "#6b21a8" },
          ].map((s, i, arr) => (
            <div key={s.t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: s.c, borderRadius: 10, padding: "6px 11px", minWidth: 96, textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: s.tc, fontSize: 13 }}>{s.t}</div>
                <div style={{ fontSize: 10.5, color: s.tc, opacity: 0.85 }}>{s.who}</div>
              </div>
              {i < arr.length - 1 ? <span style={{ color: "var(--muted)", fontWeight: 800 }}>→</span> : null}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          Inventario: <b>Recepción</b> (entra stock con ubicación) → se vende → el físico baja al <b>confirmar el pick</b>. El menú de la izquierda está ordenado por este flujo.
        </div>
      </div>

      {onNav && (
        <button
          className="card"
          onClick={() => onNav("calendario")}
          style={{ width: "100%", textAlign: "left", cursor: "pointer", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, padding: 16, fontFamily: "inherit" }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "var(--text)" }}>Calendario de retiros</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Agenda completa: vista mensual, semanal, diaria y lista de despachos.</div>
          </div>
          <span style={{ color: "var(--magenta)", fontWeight: 800 }}>Abrir →</span>
        </button>
      )}

      <div className="dash-row">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2 style={{ textTransform: "capitalize" }}>Retiros · {fmtLong(selDate)}</h2>
            <span className="badge" style={{ background: "#fce7f3", color: "#9d174d" }}>
              {pick.loading ? "…" : summary ? `${summary.total_committed ?? dayOrders.length} pedidos` : "—"}
            </span>
          </div>
          {summary ? (
            <>
              <div className="status-chips">
                {Object.entries(ORDER_STATUS).filter(([k]) => byStatus[k] != null && byStatus[k] > 0).map(([k, v]) => (
                  <span className="badge" key={k} style={{ background: v.bg, color: v.text }}>{v.label}: {byStatus[k]}</span>
                ))}
                {Object.values(byStatus).every((n) => !n) ? <span style={{ fontSize: 13, color: "var(--muted)", padding: "4px 0" }}>Sin retiros agendados este día.</span> : null}
              </div>
              <table>
                <thead>
                  <tr><th>Cliente</th><th>N°</th><th>Estado</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {dayOrders.length === 0 ? (
                    <tr><td colSpan="4" style={{ color: "var(--muted)", padding: 20 }}>Ningún pedido con retiro este día.</td></tr>
                  ) : (
                    dayOrders.map((o) => (
                      <tr key={o._id}>
                        <td style={{ fontWeight: 600 }}>{o.customer?.fullName || "—"}</td>
                        <td className="mono" style={{ color: "var(--muted)" }}>#{String(o._id).slice(-6)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td style={{ fontWeight: 700 }}>{clp(o.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ padding: 22, color: "var(--muted)", fontSize: 14 }}>
              {pick.loading ? "Cargando retiros…" : "El resumen de retiros no está disponible en este momento."}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2>Próximos 7 días</h2>
          </div>
          {summary && upcoming.length > 0 ? (
            <div className="upcoming">
              {upcoming.map((u) => (
                <div
                  className={u.date === selDate ? "up-row today" : "up-row"}
                  key={u.date}
                  onClick={() => setSelDate(u.date)}
                  style={{ cursor: "pointer" }}
                  title="Ver retiros de este día"
                >
                  <span className="up-date">{fmtDate(u.date)}{u.date === HOY ? " · hoy" : ""}</span>
                  <span className="up-count">{u.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 22, color: "var(--muted)", fontSize: 14 }}>
              {pick.loading ? "Cargando agenda…" : "Sin retiros agendados para los próximos 7 días."}
            </div>
          )}
        </div>
      </div>

      {canInv && (
      <div className="card">
        <div className="card-h">
          <h2>Stock crítico</h2>
          <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            {low.loading ? "…" : `${lowItems.length} productos`}
          </span>
          <div className="spacer" />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Umbral ≤ {THRESHOLD} · reponer antes de quiebre</span>
        </div>
        <table>
          <thead>
            <tr><th>Producto</th><th>Ubicación</th><th>Código</th><th>Stock</th></tr>
          </thead>
          <tbody>
            {low.loading ? (
              <tr><td colSpan="4" style={{ color: "var(--muted)", padding: 22 }}>Cargando inventario…</td></tr>
            ) : low.error ? (
              <tr><td colSpan="4" style={{ color: "var(--danger)", padding: 22 }}>Error: {low.error}</td></tr>
            ) : lowItems.length === 0 ? (
              <tr><td colSpan="4" style={{ color: "var(--muted)", padding: 22 }}>Sin productos bajo el umbral.</td></tr>
            ) : (
              lowItems.map((p) => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.location?.code ? <span className="loc">{p.location.code}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td className="mono" style={{ color: "var(--muted)" }}>{p.barcode || "—"}</td>
                  <td><b className="qneg">{p.stock}</b></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {canInv && expItems.length > 0 && (
        <div className="card">
          <div className="card-h">
            <h2>Próximos a vencer (FEFO)</h2>
            <span className="badge" style={{ background: "#ffedd5", color: "#9a3412" }}>{expItems.length} productos</span>
            <div className="spacer" />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Despacha primero lo que vence antes</span>
          </div>
          <table>
            <thead>
              <tr><th>Producto</th><th>Vence</th><th>Días</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {[...expItems].sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999)).slice(0, 10).map((p) => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: "var(--muted)" }}>{p.expiry_date || "—"}</td>
                  <td><b style={{ color: (p.days_left ?? 99) <= 3 ? "var(--danger)" : "var(--warn)" }}>{p.days_left ?? "—"} d</b></td>
                  <td>{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

