import { useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { t, clp } from "../theme.js";

import { brand } from "../brand.js";
// Documentos tributarios (boletas/facturas) con DASHBOARD: KPIs + gráficos +
// exportable a PDF (ventana de impresión con marca) y Excel (CSV). La emisión
// real con el SII sigue en modo stub; esta vista consolida lo emitido.
const MOCK = {
  items: [
    { _id: "d1", type: "boleta", folio: "STUB-000123", total: 23980, neto: 20151, iva: 3829, status: "accepted", stub: true, created_at: "2026-06-17T13:00:00Z" },
    { _id: "d2", type: "boleta", folio: "STUB-000124", total: 8990, neto: 7555, iva: 1435, status: "accepted", stub: true, created_at: "2026-06-18T15:00:00Z" },
    { _id: "d3", type: "factura", folio: "STUB-000125", total: 154900, neto: 130168, iva: 24732, status: "accepted", stub: true, created_at: "2026-06-19T10:00:00Z" },
    { _id: "d4", type: "boleta", folio: "STUB-000126", total: 5490, neto: 4613, iva: 877, status: "pending", stub: true, created_at: "2026-06-19T12:00:00Z" },
  ],
  total: 4,
};

const DOC_STATUS = {
  accepted: { label: "Aceptado", bg: "#dcfce7", text: "#166534", color: "#16a34a" },
  pending: { label: "Pendiente", bg: "#fef3c7", text: "#92400e", color: "#d97706" },
  rejected: { label: "Rechazado", bg: "#fee2e2", text: "#b91c1c", color: "#dc2626" },
  voided: { label: "Anulado", bg: "#f3f4f6", text: "#374151", color: "#6b7280" },
};
const TYPE_COLOR = { boleta: "#4E9B27", factura: "#2E6116", nota_credito: "#C3E062" };
const TYPE_LABEL = { boleta: "Boleta", factura: "Factura", nota_credito: "Nota de crédito" };
const typeLabel = (ty) => TYPE_LABEL[ty] || ty;

const pad = (n) => String(n).padStart(2, "0");
function dkey(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "Sin fecha" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmt(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return isNaN(d) ? "Sin fecha" : d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Donut (SVG) ────────────────────────────────────────────────────────────────
function Donut({ segments, size = 132, stroke = 20, centerTop, centerBottom }) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef4e7" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const v = Number(s.value) || 0;
          const len = (v / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          );
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
          <span style={{ flex: 1, color: t.text, fontWeight: 600 }}>{s.label}</span>
          <span style={{ color: t.muted, fontWeight: 600 }}>{s.display ?? s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Barras horizontales ────────────────────────────────────────────────────────
function HBars({ items }) {
  if (!items.length) return <div style={{ color: t.muted, fontSize: 13, padding: "10px 0" }}>Sin datos en el período.</div>;
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {items.map((it, i) => {
        const v = Number(it.value) || 0;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 10 }}>
              <span style={{ fontWeight: 600, color: t.text }}>{it.label}</span>
              <span style={{ color: t.muted, fontWeight: 600 }}>{it.display ?? v}</span>
            </div>
            <div style={{ height: 10, background: "#eef4e7", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(v / max) * 100}%`, background: it.color || t.magenta, borderRadius: 6, minWidth: v > 0 ? 4 : 0 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ ic, bg, value, label }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: bg, display: "grid", placeItems: "center", fontSize: 20, flex: "0 0 auto" }}>{ic}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: t.text, lineHeight: 1.1, whiteSpace: "nowrap" }}>{value}</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Documentos() {
  const [status, setStatus] = useState("");
  const res = useLoad(() => api.taxDocsAdmin({ status, limit: 200 }), MOCK, [status]);
  const items = res.data?.items || [];

  const agg = useMemo(() => {
    const totals = { count: items.length, total: 0, neto: 0, iva: 0 };
    const byTypeMap = {}, byStatusMap = {}, byDayMap = {};
    for (const d of items) {
      totals.total += Number(d.total) || 0;
      totals.neto += Number(d.neto) || 0;
      totals.iva += Number(d.iva) || 0;
      const ty = d.type || "otro";
      byTypeMap[ty] = byTypeMap[ty] || { label: ty, count: 0, total: 0 };
      byTypeMap[ty].count += 1; byTypeMap[ty].total += Number(d.total) || 0;
      const st = d.status || "otro";
      byStatusMap[st] = (byStatusMap[st] || 0) + 1;
      const k = dkey(d.created_at);
      byDayMap[k] = (byDayMap[k] || 0) + (Number(d.total) || 0);
    }
    const byType = Object.values(byTypeMap).map((x) => ({ ...x, color: TYPE_COLOR[x.label] || t.morado }));
    const byStatus = Object.entries(byStatusMap).map(([k, v]) => ({ label: DOC_STATUS[k]?.label || k, value: v, color: DOC_STATUS[k]?.color || t.muted }));
    const byDay = Object.entries(byDayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
      .map(([k, v]) => ({ label: k.includes("-") ? k.slice(5) : k, value: v, display: clp(v), color: t.magenta }));
    return { totals, byType, byStatus, byDay };
  }, [items]);

  function exportCSV() {
    const head = ["Tipo", "Folio", "Neto", "IVA", "Total", "Fecha", "Estado"];
    const rows = items.map((d) => [typeLabel(d.type), d.folio || "", d.neto || 0, d.iva || 0, d.total || 0, fmt(d.created_at), DOC_STATUS[d.status]?.label || d.status]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `documentos-sii-${dkey(new Date().toISOString())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const w = window.open("", "_blank");
    if (!w) { alert("Permite las ventanas emergentes para exportar el PDF."); return; }
    const esc = (s) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
    const rowsHtml = items.map((d) => `<tr>
      <td>${esc(typeLabel(d.type))}</td>
      <td>${esc(d.folio || "Sin folio")}</td>
      <td class="r">${clp(d.neto || 0)}</td>
      <td class="r">${clp(d.iva || 0)}</td>
      <td class="r b">${clp(d.total || 0)}</td>
      <td>${esc(fmt(d.created_at))}</td>
      <td>${esc(DOC_STATUS[d.status]?.label || d.status)}</td></tr>`).join("");
    const origin = window.location.origin;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Documentos SII · ${brand.name}</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2a1022;margin:0;padding:28px}
      .hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #4E9B27;padding-bottom:14px;margin-bottom:18px}
      .hd img{height:42px} .hd h1{font-size:20px;margin:0} .hd .sub{color:#8a6e80;font-size:12px;margin-top:2px}
      .kpis{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}
      .kpi{border:1px solid #ecdbe6;border-radius:12px;padding:12px 16px;flex:1;min-width:140px}
      .kpi .v{font-size:20px;font-weight:800} .kpi .l{font-size:11px;color:#8a6e80;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12.5px} th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #ecdbe6}
      th{background:#f2f7ec;color:#2E6116;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
      td.r,th.r{text-align:right} td.b{font-weight:700}
      .ft{margin-top:20px;color:#8a6e80;font-size:11px;text-align:center}
      @media print{body{padding:0}}
    </style></head><body>
      <div class="hd"><img src="${origin}${brand.logo}" alt="${brand.name}" onerror="this.style.display='none'"/>
        <div><h1>Documentos tributarios (SII)</h1><div class="sub">${brand.legal.razon_social || brand.name} — emitido el ${fmt(new Date().toISOString())}${status ? " · filtro: " + (DOC_STATUS[status]?.label || status) : ""}</div></div></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${agg.totals.count}</div><div class="l">Documentos emitidos</div></div>
        <div class="kpi"><div class="v">${clp(agg.totals.total)}</div><div class="l">Total facturado</div></div>
        <div class="kpi"><div class="v">${clp(agg.totals.neto)}</div><div class="l">Neto</div></div>
        <div class="kpi"><div class="v">${clp(agg.totals.iva)}</div><div class="l">IVA</div></div>
      </div>
      <table><thead><tr><th>Tipo</th><th>Folio</th><th class="r">Neto</th><th class="r">IVA</th><th class="r">Total</th><th>Fecha</th><th>Estado</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="7" style="color:#8a6e80;padding:18px">Sin documentos.</td></tr>'}</tbody></table>
      <div class="ft">Documento generado desde el panel de ${brand.name}. Facturación en modo stub (folios STUB-…).</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},200);}<\/script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div>
      <div className="banner-mock" style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af" }}>
        Facturación en modo <b>stub</b>: las boletas se emiten con folio de prueba (STUB-…). La integración real con el SII está pendiente.
      </div>

      {/* ── Dashboard ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
        <Kpi ic="🧾" bg="#e9f3da" value={res.loading ? "…" : agg.totals.count.toLocaleString("es-CL")} label="Documentos emitidos" />
        <Kpi ic="💰" bg="#fde7f1" value={res.loading ? "…" : clp(agg.totals.total)} label="Total facturado" />
        <Kpi ic="📊" bg="#ede9fe" value={res.loading ? "…" : clp(agg.totals.neto)} label="Neto" />
        <Kpi ic="🏛️" bg="#dbeafe" value={res.loading ? "…" : clp(agg.totals.iva)} label="IVA" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0, padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Por tipo de documento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Donut segments={agg.byType.map((x) => ({ value: x.count, color: x.color }))} centerTop={agg.totals.count} centerBottom="docs" />
            <div style={{ flex: 1, minWidth: 140 }}>
              <Legend items={agg.byType.map((x) => ({ label: typeLabel(x.label), color: x.color, display: `${x.count} · ${clp(x.total)}` }))} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Por estado</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Donut segments={agg.byStatus} centerTop={agg.totals.count} centerBottom="docs" />
            <div style={{ flex: 1, minWidth: 140 }}>
              <Legend items={agg.byStatus} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Facturado por día</div>
          <HBars items={agg.byDay} />
        </div>
      </div>

      {/* ── Filtros + export ──────────────────────────────────────────────── */}
      <div className="filters" style={{ alignItems: "flex-end" }}>
        <div className="field">
          <label>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ alignSelf: "flex-end" }} onClick={exportPDF} disabled={!items.length}>Exportar PDF</button>
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={exportCSV} disabled={!items.length}>Exportar Excel</button>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-h">
          <h2>Documentos tributarios</h2>
          <span className="badge" style={{ background: "#e9f3da", color: "#6B8F4E" }}>{res.loading ? "…" : `${items.length}`}</span>
        </div>
        <table>
          <thead>
            <tr><th>Tipo</th><th>Folio</th><th>Neto</th><th>IVA</th><th>Total</th><th>Fecha</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {res.loading ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--muted)" }}>Cargando documentos…</td></tr>
            ) : res.error ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--danger)" }}>Error: {res.error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 22, color: "var(--muted)" }}>Sin documentos emitidos.</td></tr>
            ) : items.map((d) => {
              const m = DOC_STATUS[d.status] || { label: d.status, bg: "#f3f4f6", text: "#374151" };
              return (
                <tr key={d._id}>
                  <td style={{ fontWeight: 600 }}>{typeLabel(d.type)}</td>
                  <td className="mono">
                    {d.folio || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Sin folio</span>}
                    {d.stub ? <span className="badge" style={{ marginLeft: 6, background: "#eff6ff", color: "#1e40af", fontSize: 10.5 }}>STUB</span> : null}
                  </td>
                  <td>{clp(d.neto || 0)}</td>
                  <td>{clp(d.iva || 0)}</td>
                  <td style={{ fontWeight: 700 }}>{clp(d.total || 0)}</td>
                  <td style={{ fontSize: 13 }}>{fmt(d.created_at)}</td>
                  <td><span className="badge" style={{ background: m.bg, color: m.text }}>{m.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usingMock ? <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted)" }}>Modo demostración.</div> : null}
      </div>
    </div>
  );
}
