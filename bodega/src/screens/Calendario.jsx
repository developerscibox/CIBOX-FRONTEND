import { useMemo, useState } from "react";
import { api, useLoad } from "../api.js";
import { ORDERS_RES } from "../data.js";
import { ORDER_STATUS, clp } from "../theme.js";
import { StatusBadge } from "../ui.jsx";

// ── Helpers de fecha (el panel corre en Chile; fecha local ≈ Santiago) ────────
const HOY_D = new Date();
const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = toYMD(HOY_D);
const parseYMD = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return toYMD(d); };
const addMonths = (s, n) => { const d = parseYMD(s); d.setMonth(d.getMonth() + n); return toYMD(d); };
const WEEK = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// committed_date (ISO) → YMD / hora en zona Santiago.
// Si viene como fecha pura 'YYYY-MM-DD', se usa tal cual: new Date('YYYY-MM-DD')
// la interpreta como UTC y, al formatear en Santiago, corre el día hacia atrás.
const ymdOf = (iso) => {
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
};
const hmOf = (iso) =>
  new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const fmtLong = (ymd) =>
  parseYMD(ymd).toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" });
const fmtShort = (ymd) =>
  parseYMD(ymd).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
const monthLabel = (ymd) =>
  parseYMD(ymd).toLocaleDateString("es-CL", { month: "long", year: "numeric" });

const PAY_LABEL = { transfer: "Transferencia", cash_on_pickup: "Efectivo al retirar", webpay: "Webpay" };

// Cantidad por ítem en cajas (infiere del tier_label) o unidades.
const itemQty = (it) => Number(it?.quantity ?? it?.qty) || 0;
const qtyLabel = (it) => {
  const m = String(it?.tier_label || "").match(/Caja\s*(\d+)/i);
  const boxSize = m ? Number(m[1]) : Number(it?.box_qty) || 1;
  const qty = itemQty(it);
  if (boxSize > 1) { const c = Math.max(1, Math.round(qty / boxSize)); return `${c} caja${c === 1 ? "" : "s"} · ${qty} un`; }
  return `${qty} un`;
};

function rangeForView(view, anchor) {
  if (view === "mes") {
    const d = parseYMD(anchor);
    return { from: toYMD(new Date(d.getFullYear(), d.getMonth(), 1)), to: toYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  if (view === "semana") {
    const d = parseYMD(anchor);
    const dow = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - dow);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: toYMD(start), to: toYMD(end) };
  }
  if (view === "dia") return { from: anchor, to: anchor };
  return { from: HOY, to: addDays(HOY, 30) }; // lista
}

function monthCells(anchor) {
  const d = parseYMD(anchor);
  const y = d.getFullYear(), m = d.getMonth();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let dd = 1; dd <= days; dd++) cells.push(toYMD(new Date(y, m, dd)));
  return cells;
}
function weekDates(anchor) {
  const { from } = rangeForView("semana", anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

const VIEWS = [
  { key: "mes", label: "Mes" },
  { key: "semana", label: "Semana" },
  { key: "dia", label: "Día" },
  { key: "lista", label: "Lista" },
];

export default function Calendario() {
  const [view, setView] = useState("mes");
  const [anchor, setAnchor] = useState(HOY);

  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);
  const load = useLoad(
    () => api.orders({ delivery_method: "pickup", committed_from: range.from, committed_to: range.to, limit: 200 }),
    ORDERS_RES,
    [range.from, range.to],
  );
  const orders = load.data?.orders || [];
  // Total real del período según el backend (la respuesta topa en `limit`,
  // así que orders.length subestima el conteo cuando hay más retiros).
  const total = load.data?.pagination?.total ?? orders.length;

  const byDay = useMemo(() => {
    const map = {};
    for (const o of orders) {
      if (!o.pickup?.committed_date) continue;
      const k = ymdOf(o.pickup.committed_date);
      (map[k] = map[k] || []).push(o);
    }
    return map;
  }, [orders]);

  const go = (dir) => {
    if (view === "mes") setAnchor((a) => addMonths(a, dir));
    else if (view === "semana") setAnchor((a) => addDays(a, dir * 7));
    else if (view === "dia") setAnchor((a) => addDays(a, dir));
  };

  const periodLabel =
    view === "mes" ? monthLabel(anchor)
    : view === "semana" ? `${fmtShort(range.from)} – ${fmtShort(range.to)}`
    : view === "dia" ? fmtLong(anchor)
    : "Próximos 30 días";

  return (
    <div>
      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="segment">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={view === v.key ? "seg-btn active" : "seg-btn"}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          {view !== "lista" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn-ghost" style={{ padding: "4px 11px" }} onClick={() => go(-1)} title="Anterior">‹</button>
              <span style={{ fontWeight: 700, textTransform: "capitalize", minWidth: 150, textAlign: "center" }}>{periodLabel}</span>
              <button className="btn-ghost" style={{ padding: "4px 11px" }} onClick={() => go(1)} title="Siguiente">›</button>
              <button className="btn-ghost" style={{ padding: "4px 12px", fontWeight: 700 }} onClick={() => setAnchor(HOY)}>Hoy</button>
            </div>
          )}
          {view === "lista" && (
            <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{periodLabel}</span>
          )}
        </div>
        <div style={{ padding: "0 4px 4px", fontSize: 13, color: "var(--muted)" }}>
          {load.loading ? "Cargando agenda…" : load.error ? `Error: ${load.error}` : `${total} retiro${total === 1 ? "" : "s"} en el período`}
        </div>
      </div>

      {view === "mes" && <VistaMes anchor={anchor} byDay={byDay} onDay={(d) => { setAnchor(d); setView("dia"); }} />}
      {view === "semana" && <VistaSemana anchor={anchor} byDay={byDay} onDay={(d) => { setAnchor(d); setView("dia"); }} />}
      {view === "dia" && <VistaDia anchor={anchor} orders={byDay[anchor] || []} loading={load.loading} />}
      {view === "lista" && <VistaLista byDay={byDay} loading={load.loading} />}

      <style>{`
        .segment{display:flex;background:#fbe9f3;border-radius:999px;padding:4px;gap:4px;}
        .seg-btn{background:transparent;border:none;padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;color:var(--muted);cursor:pointer;}
        .seg-btn.active{background:var(--magenta);color:#fff;}
        .cal-cell{aspect-ratio:1/1;border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:6px;display:flex;flex-direction:column;gap:3px;cursor:pointer;text-align:left;font-family:inherit;overflow:hidden;}
        .cal-cell:hover{border-color:var(--magenta);}
        .cal-cell.has{background:#fde7f1;}
        .cal-cell.today{outline:2px solid var(--magenta);outline-offset:-2px;}
        .ord-chip{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:8px;}
      `}</style>
    </div>
  );
}

// ── Vista Mensual ─────────────────────────────────────────────────────────────
function VistaMes({ anchor, byDay, onDay }) {
  const cells = monthCells(anchor);
  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        {WEEK.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", padding: "2px 0" }}>{w}</div>
        ))}
        {cells.map((ymd, i) => {
          if (!ymd) return <div key={`e${i}`} />;
          const list = byDay[ymd] || [];
          const n = list.length;
          const dnum = Number(ymd.slice(-2));
          return (
            <button key={ymd} className={`cal-cell${n ? " has" : ""}${ymd === HOY ? " today" : ""}`} onClick={() => onDay(ymd)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: ymd === HOY ? 800 : 600, color: ymd === HOY ? "var(--magenta)" : "var(--text)" }}>{dnum}</span>
                {n > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "var(--magenta)", borderRadius: 999, minWidth: 18, textAlign: "center", padding: "0 5px" }}>{n}</span>}
              </div>
              {list.slice(0, 3).map((o) => (
                <span key={o._id} style={{ fontSize: 10.5, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  • {o.customer?.fullName || "Cliente sin nombre"}
                </span>
              ))}
              {n > 3 && <span style={{ fontSize: 10, color: "var(--muted)" }}>+{n - 3} más…</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista Semanal ─────────────────────────────────────────────────────────────
function VistaSemana({ anchor, byDay, onDay }) {
  const days = weekDates(anchor);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(150px,1fr))", gap: 10, overflowX: "auto" }}>
      {days.map((ymd) => {
        const list = byDay[ymd] || [];
        return (
          <div key={ymd} className="card" style={{ marginBottom: 0, padding: 10, minHeight: 160 }}>
            <button onClick={() => onDay(ymd)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%", padding: 0, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "capitalize", color: ymd === HOY ? "var(--magenta)" : "var(--text)" }}>{fmtShort(ymd)}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{list.length} retiro{list.length === 1 ? "" : "s"}</div>
            </button>
            {list.map((o) => (
              <div key={o._id} className="ord-chip" style={{ marginBottom: 7, padding: "7px 9px" }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{o.customer?.fullName || "Cliente sin nombre"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                  <StatusBadge status={o.status} />
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{clp(o.total)}</span>
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "6px 0" }}>Sin retiros</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Vista Diaria (detalle de despacho) ────────────────────────────────────────
function VistaDia({ anchor, orders, loading }) {
  if (loading) return <div className="card" style={{ padding: 22, color: "var(--muted)" }}>Cargando…</div>;
  if (!orders.length)
    return <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>No hay retiros agendados para {fmtLong(anchor)}.</div>;
  return (
    <div>
      {orders.map((o) => (
        <div key={o._id} className="card">
          <div className="card-h">
            <h2 style={{ fontSize: 16 }}>{o.customer?.fullName || "Cliente sin nombre"}</h2>
            <StatusBadge status={o.status} />
            <div className="spacer" />
            <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>#{String(o._id).slice(-6)}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 13, color: "var(--muted)", padding: "0 4px 10px" }}>
            <span>Pedido: <b style={{ color: "var(--text)", fontWeight: 600 }}>{hmOf(o.created_at)}</b></span>
            {o.customer?.phone && <span>Tel: <b style={{ color: "var(--text)", fontWeight: 600 }}>{o.customer.phone}</b></span>}
            <span>Pago: <b style={{ color: "var(--text)", fontWeight: 600 }}>{PAY_LABEL[o.payment?.method] || o.payment?.method || "Sin registrar"}</b></span>
            <span style={{ fontWeight: 800, color: "var(--text)" }}>Total: {clp(o.total)}</span>
          </div>
          <table>
            <thead><tr><th>Producto</th><th>A despachar</th></tr></thead>
            <tbody>
              {(o.items || []).map((it, i) => (
                <tr key={it.product_id || i}>
                  <td style={{ fontWeight: 600 }}>{it.name || "Producto"}</td>
                  <td><b>{qtyLabel(it)}</b></td>
                </tr>
              ))}
              {(!o.items || o.items.length === 0) && <tr><td colSpan="2" style={{ color: "var(--muted)", padding: 16 }}>Sin ítems.</td></tr>}
            </tbody>
          </table>
          {o.notes && (
            <div style={{ padding: "10px 4px 0", fontSize: 13, color: "var(--text)" }}>
              <span style={{ fontWeight: 700, color: "var(--muted)" }}>Nota: </span>{o.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Vista Lista (próximos 30 días) ────────────────────────────────────────────
function VistaLista({ byDay, loading }) {
  const rows = useMemo(() => {
    const all = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1));
    return all;
  }, [byDay]);

  if (loading) return <div className="card" style={{ padding: 22, color: "var(--muted)" }}>Cargando…</div>;
  if (!rows.length) return <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>No hay retiros agendados en los próximos 30 días.</div>;

  return (
    <div className="card">
      <table>
        <thead>
          <tr><th>Retiro</th><th>Cliente</th><th>Productos</th><th>Estado</th><th>Total</th></tr>
        </thead>
        <tbody>
          {rows.map(([ymd, list]) => (
            <Fragmentish key={ymd} ymd={ymd} list={list} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fragmentish({ ymd, list }) {
  return (
    <>
      <tr>
        <td colSpan="5" style={{ background: "#faf3f8", fontWeight: 800, textTransform: "capitalize", color: ymd === HOY ? "var(--magenta)" : "var(--text)" }}>
          {fmtLong(ymd)}{ymd === HOY ? " · hoy" : ""} · {list.length} retiro{list.length === 1 ? "" : "s"}
        </td>
      </tr>
      {list.map((o) => (
        <tr key={o._id}>
          <td className="mono" style={{ color: "var(--muted)" }}>#{String(o._id).slice(-6)}</td>
          <td style={{ fontWeight: 600 }}>{o.customer?.fullName || "Cliente sin nombre"}</td>
          <td style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {(o.items || []).slice(0, 2).map((it) => `${qtyLabel(it)} ${it.name}`).join(", ")}
            {(o.items || []).length > 2 ? ` +${o.items.length - 2}` : ""}
          </td>
          <td><StatusBadge status={o.status} /></td>
          <td style={{ fontWeight: 700 }}>{clp(o.total)}</td>
        </tr>
      ))}
    </>
  );
}
