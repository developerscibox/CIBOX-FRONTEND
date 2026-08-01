import { useState } from "react";
import { api, useLoad } from "../api.js";
import {
  SALES_SUMMARY_RES,
  TOP_PRODUCTS_RES,
  ORDERS_ADMIN_RES,
} from "../data.js";
import { t, clp, ORDER_STATUS } from "../theme.js";

// Fallbacks con la forma exacta del backend (adminController) para degradar elegante.
const SUMMARY_FALLBACK = { totals: { sku: 0, units: 0, cajas: 0, low: 0, value: 0 }, by_category: [], top_products: [] };
const SALES_FALLBACK = { totals: { total_orders: 0, total_sales: 0, average_ticket: 0 }, series: [] };

const TOP_COLOR = ["#E6007E", "#C0067A", "#B5006A", "#7A1B73", "#FF3DA6", "#9d174d"];

// Rangos de período (días hacia atrás desde hoy, inclusive).
const RANGES = [
  { key: "7", days: 7, label: "7 días" },
  { key: "30", days: 30, label: "30 días" },
  { key: "90", days: 90, label: "90 días" },
];

const CASH_SUMMARY_FALLBACK = { date: "", total_cobrado: 0, count: 0, by_cashier: [] };

function ymd(d) {
  // Fecha en hora LOCAL (Chile), no UTC: evita saltar de día al cerrar de noche.
  const o = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return o.toISOString().slice(0, 10);
}

// Precio de venta POR UNIDAD al comprar la caja = price del tier de mayor min_qty.
// Si no hay tier caja, cae al precio del tier unidad.
function boxUnitSellPrice(p) {
  const tiers = p?.pricing?.tiers || [];
  const boxes = tiers.filter((x) => (x.min_qty || 1) > 1);
  if (boxes.length) {
    const b = boxes.reduce((a, c) => ((c.min_qty || 0) > (a.min_qty || 0) ? c : a));
    return Number(b.price || 0);
  }
  const u = tiers.find((x) => (x.min_qty || 1) === 1) || tiers[0];
  return u ? Number(u.price || 0) : 0;
}
function rangeDates(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(to) };
}

// ── Barras horizontales (mismo molde que Inventario.jsx) ───────────────────────
function HBars({ items }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Sin datos.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it, i) => {
        const v = Number(it.value) || 0;
        return (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5, gap: 10 }}>
            <span style={{ fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span style={{ color: t.muted, fontWeight: 600, flex: "0 0 auto" }}>{it.display ?? v}</span>
          </div>
          <div style={{ height: 10, background: "#f1e6ef", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(v / max) * 100}%`, background: it.color || t.magenta, borderRadius: 6, minWidth: v > 0 ? 4 : 0 }} />
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ── Donut (SVG) + leyenda ──────────────────────────────────────────────────────
function Donut({ segments, size = 132, stroke = 20, centerTop, centerBottom }) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1e6ef" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = ((Number(s.value) || 0) / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" fontSize="24" fontWeight="800" fill={t.text}>{centerTop}</text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="11" fontWeight="600" fill={t.muted}>{centerBottom}</text>
    </svg>
  );
}
function Legend({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: "0 0 auto" }} />
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", color: t.text, fontWeight: 600 }}>{s.label}</span>
          <span style={{ color: t.muted, fontWeight: 700 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Ventas() {
  const [rangeKey, setRangeKey] = useState("30");
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[1];
  const { from, to } = rangeDates(range.days);

  // KPIs globales y de inventario (no dependen del rango).
  const stock = useLoad(() => api.stockSummary(10), SUMMARY_FALLBACK);
  // Ventas del período + top productos (recargan al cambiar el rango).
  const sales = useLoad(() => api.salesSummary({ from, to, group_by: "day" }), SALES_SUMMARY_RES, [rangeKey]);
  const top = useLoad(() => api.topProducts({ from, to, limit: 8 }), TOP_PRODUCTS_RES, [rangeKey]);
  // Órdenes para el resumen por estado (la lista completa la cubre la sección Pedidos).
  const ord = useLoad(() => api.orders({ limit: 100 }), ORDERS_ADMIN_RES);
  // Cuadre de caja en efectivo del día (no depende del rango).
  const cash = useLoad(() => api.cashSummary(ymd(new Date())), CASH_SUMMARY_FALLBACK);
  const cashD = cash.data || CASH_SUMMARY_FALLBACK;
  // Catálogo con costos para estimar rentabilidad (cost_price solo lo ve admin/gerente).
  const prods = useLoad(() => api.products({ limit: 100, include_inactive: true }), { items: [] });

  // Rentabilidad estimada sobre productos con costo cargado.
  const prodItems = prods.data?.items || [];
  const withCost = prodItems.filter((p) => Number(p.cost_price) > 0);
  let avgMargin = null;
  let potentialProfit = 0;
  if (withCost.length) {
    let marginSum = 0;
    for (const p of withCost) {
      const sell = boxUnitSellPrice(p);
      const cost = Number(p.cost_price || 0);
      if (sell > 0) marginSum += ((sell - cost) / sell) * 100;
      potentialProfit += (sell - cost) * Number(p.stock || 0);
    }
    avgMargin = Math.round(marginSum / withCost.length);
  }

  const stockT = stock.data?.totals || {};
  const salesT = (sales.data || SALES_FALLBACK).totals || {};
  const series = (sales.data || SALES_FALLBACK).series || [];
  const topItems = top.data || [];
  const orders = ord.data?.orders || [];
  // Total real de órdenes según el backend (la lista topa en `limit`, así que
  // orders.length subestima el total cuando hay más). El desglose por estado de
  // abajo se calcula sobre la muestra cargada, no sobre el total.
  const ordersTotal = ord.data?.pagination?.total ?? orders.length;

  // Resumen de órdenes por estado (agrupado en cliente sobre /orders/admin).
  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const statusSegments = Object.entries(ORDER_STATUS)
    .filter(([k]) => byStatus[k] > 0)
    .map(([k, meta]) => ({ label: meta.label, value: byStatus[k], color: meta.text }));

  const kpis = [
    { ic: "💰", bg: "#fde7f1", v: sales.loading ? "…" : clp(salesT.total_sales ?? 0), l: `Ventas · ${range.label}` },
    { ic: "🧾", bg: "#fce7f3", v: sales.loading ? "…" : (salesT.total_orders ?? 0).toLocaleString("es-CL"), l: `Pedidos pagados · ${range.label}` },
    { ic: "📦", bg: "#ede9fe", v: stock.loading ? "…" : (stockT.cajas ?? 0).toLocaleString("es-CL"), l: "Cajas en bodega" },
    { ic: "⚠️", bg: "#fef3c7", v: stock.loading ? "…" : (stockT.low ?? 0).toLocaleString("es-CL"), l: "SKUs en stock crítico" },
  ];

  // Barras de la serie temporal (ventas por día).
  const serieBars = series.map((p) => {
    const v = Number(p.total_sales) || 0;
    return {
      label: p.period,
      value: v,
      display: clp(v),
      color: t.magenta,
    };
  });

  return (
    <div>
      {/* Selector de período */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: t.muted, fontWeight: 600 }}>Período:</span>
        {RANGES.map((r) => {
          const active = r.key === rangeKey;
          return (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              style={{
                border: `1px solid ${active ? t.magenta : t.border}`,
                background: active ? t.magenta : t.surface,
                color: active ? "#fff" : t.text,
                fontWeight: 600, fontSize: 13, padding: "6px 14px",
                borderRadius: 999, cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: t.muted }}>{from} → {to}</span>
      </div>

      {/* KPIs */}
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
        {/* Ventas por día */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2>Ventas por día</h2>
            <div className="spacer" />
            <span style={{ fontSize: 13, color: t.muted }}>
              ticket prom. {clp(salesT.average_ticket ?? 0)}
            </span>
          </div>
          <div style={{ padding: "6px 2px" }}>
            {sales.loading ? (
              <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Cargando ventas…</div>
            ) : sales.error ? (
              <div style={{ color: t.danger, fontSize: 13, padding: "10px 0" }}>Error: {sales.error}</div>
            ) : (
              <HBars items={serieBars} />
            )}
          </div>
        </div>

        {/* Órdenes por estado */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2>Órdenes por estado</h2>
            <div className="spacer" />
            <span style={{ fontSize: 13, color: t.muted }}>{ordersTotal} en total</span>
          </div>
          <div style={{ padding: "6px 2px" }}>
            {ord.loading ? (
              <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Cargando órdenes…</div>
            ) : orders.length === 0 ? (
              <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Sin órdenes recientes.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <Donut segments={statusSegments} centerTop={orders.length} centerBottom="órdenes" />
                <div style={{ flex: 1, minWidth: 130 }}>
                  <Legend items={statusSegments} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cuadre de caja efectivo (hoy) */}
      <div className="card">
        <div className="card-h">
          <h2>Cuadre de caja efectivo (hoy)</h2>
          <div className="spacer" />
          <span style={{ fontSize: 13, color: t.muted }}>{ymd(new Date())}</span>
        </div>
        <div style={{ padding: "6px 2px" }}>
          {cash.loading ? (
            <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Cargando caja…</div>
          ) : cash.error ? (
            <div style={{ color: t.danger, fontSize: 13, padding: "10px 0" }}>Error: {cash.error}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>{clp(cashD.total_cobrado)}</div>
                  <div style={{ fontSize: 12.5, color: t.muted }}>Total cobrado en efectivo</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>{(cashD.count ?? 0).toLocaleString("es-CL")}</div>
                  <div style={{ fontSize: 12.5, color: t.muted }}>Órdenes en efectivo</div>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: t.muted, fontWeight: 600, marginBottom: 8 }}>Desglose por cajero</div>
              {(cashD.by_cashier || []).length === 0 ? (
                <div style={{ color: t.muted, fontSize: 13, padding: "6px 0" }}>Sin cobros en efectivo hoy.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cashD.by_cashier.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                      <span style={{ display: "flex", gap: 12, flex: "0 0 auto" }}>
                        <span style={{ color: t.muted, fontSize: 13 }}>{(c.count ?? 0).toLocaleString("es-CL")} órd.</span>
                        <b style={{ color: t.text }}>{clp(c.total)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rentabilidad estimada (según costo de compra cargado) */}
      <div className="card">
        <div className="card-h">
          <h2>Rentabilidad estimada</h2>
          <div className="spacer" />
          <span style={{ fontSize: 13, color: t.muted }}>
            {prods.loading ? "…" : `${withCost.length} de ${prodItems.length} con costo`}
          </span>
        </div>
        <div style={{ padding: "6px 2px" }}>
          {prods.loading ? (
            <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Cargando productos…</div>
          ) : prods.error ? (
            <div style={{ color: t.danger, fontSize: 13, padding: "10px 0" }}>Error: {prods.error}</div>
          ) : withCost.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>
              Carga el costo de compra de tus productos para ver la rentabilidad.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: avgMargin < 0 ? t.danger : avgMargin < 15 ? t.warn : t.ok }}>
                  {avgMargin}%
                </div>
                <div style={{ fontSize: 12.5, color: t.muted }}>Margen promedio</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>{clp(potentialProfit)}</div>
                <div style={{ fontSize: 12.5, color: t.muted }}>Ganancia potencial en stock</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top productos vendidos */}
      <div className="card">
        <div className="card-h">
          <h2>Productos más vendidos</h2>
          <div className="spacer" />
          <span style={{ fontSize: 13, color: t.muted }}>unidades · ingresos · {range.label}</span>
        </div>
        <div style={{ padding: "6px 2px" }}>
          {top.loading ? (
            <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Cargando productos…</div>
          ) : top.error ? (
            <div style={{ color: t.danger, fontSize: 13, padding: "10px 0" }}>Error: {top.error}</div>
          ) : (
            <HBars items={topItems.map((p, i) => {
              const rev = Number(p.total_revenue) || 0;
              return {
                label: p.name,
                value: rev,
                display: `${(Number(p.total_quantity) || 0).toLocaleString("es-CL")} u · ${clp(rev)}`,
                color: TOP_COLOR[i % TOP_COLOR.length],
              };
            })} />
          )}
        </div>
      </div>
    </div>
  );
}
