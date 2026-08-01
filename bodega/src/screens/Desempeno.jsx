import { useEffect, useRef, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";

// DESEMPEÑO POR ÁREAS (en vivo): cada área (Ventas, Caja, Preparación) con su meta
// del día, el total logrado, el % de cumplimiento y sus miembros con avance individual.
// Pensado para colgar en un monitor de la sala/gerencia — se actualiza solo.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const fmtVal = (v, u) => (u === "$" ? clp(v) : `${Math.round(Number(v) || 0)} ${u}`);

const tono = (pct) => (pct >= 100 ? { c: "var(--ok)", bg: "#ecfdf5", bd: "#a7f3d0", bar: "var(--ok)" }
  : pct >= 70 ? { c: "var(--magenta-d)", bg: "#fdf2f8", bd: "#fbcfe8", bar: "var(--magenta)" }
  : pct >= 40 ? { c: "var(--warn)", bg: "#fffbeb", bd: "#fde68a", bar: "var(--warn)" }
  : { c: "var(--danger)", bg: "#fef2f2", bd: "#fecaca", bar: "var(--danger)" });

const MOCK = {
  resumen: { areas: 3, en_meta: 1, miembros: 9, cumplimiento_promedio: 74 },
  areas: [
    { id: "ventas", nombre: "Ventas en sala", icono: "🛒", unidad: "$", total: 690000, metaTotal: 750000, pct: 92, miembros: [
      { nombre: "Susana Silva", valor: 210000, meta: 150000, pct: 140, extra: "6 ped · 84 u" },
      { nombre: "Matías Soto", valor: 180000, meta: 150000, pct: 120, extra: "5 ped · 60 u" },
      { nombre: "Patricia Díaz", valor: 120000, meta: 150000, pct: 80, extra: "3 ped · 36 u" },
      { nombre: "Jorge Rivas", valor: 110000, meta: 150000, pct: 73, extra: "3 ped · 30 u" },
      { nombre: "Camila Toro", valor: 70000, meta: 150000, pct: 47, extra: "2 ped · 24 u" },
    ] },
    { id: "caja", nombre: "Caja", icono: "💵", unidad: "$", total: 310000, metaTotal: 600000, pct: 52, miembros: [
      { nombre: "Cajera Ana", valor: 180000, meta: 200000, pct: 90, extra: "9 cobros" },
      { nombre: "Cajera Bea", valor: 130000, meta: 200000, pct: 65, extra: "7 cobros" },
    ] },
    { id: "bodega", nombre: "Preparación (bodega)", icono: "🧺", unidad: "ped", total: 21, metaTotal: 36, pct: 58, miembros: [
      { nombre: "Bodeguero Luis", valor: 9, meta: 12, pct: 75, extra: "preparados hoy" },
      { nombre: "Bodeguera Caro", valor: 8, meta: 12, pct: 67, extra: "preparados hoy" },
      { nombre: "Bodeguero Tomás", valor: 4, meta: 12, pct: 33, extra: "preparados hoy" },
    ] },
  ],
};

export default function Desempeno() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    alive.current = true;
    const load = async () => {
      if (usingMock) { setData(MOCK); return; }
      try { const d = await api.desempeno(); if (alive.current) { setData(d?.data || d); setErr(""); } }
      catch (e) { if (alive.current) setErr(e.message || "Sin conexión"); }
    };
    load();
    const id = setInterval(load, 15000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", load); } } catch { /* poll */ }
    return () => { alive.current = false; clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  const areas = data?.areas || [];
  const r = data?.resumen || { areas: 0, en_meta: 0, miembros: 0, cumplimiento_promedio: 0 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <Tile label="Cumplimiento promedio" val={`${r.cumplimiento_promedio}%`} c={tono(r.cumplimiento_promedio).bar} big />
        <Tile label="Áreas en meta" val={`${r.en_meta}/${r.areas}`} sub="alcanzaron su objetivo" c="var(--ok)" />
        <Tile label="Personas activas hoy" val={r.miembros} sub="con actividad registrada" c="var(--magenta-d)" />
        <Tile label="Actualizado" val={new Date(now).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} sub="en vivo" c="var(--magenta)" mono />
      </div>

      {err && !usingMock ? <div className="card" style={{ padding: 12, marginBottom: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "var(--danger)", fontWeight: 600 }}>{err}. Reintentando automáticamente…</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(360px,100%),1fr))", gap: 14, alignItems: "start" }}>
        {areas.map((a) => {
          const t = tono(a.pct);
          return (
            <div key={a.id} className="card" style={{ padding: 0, overflow: "hidden", borderTop: `4px solid ${t.bar}` }}>
              <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border-soft)" }}>
                <span style={{ fontSize: 26 }}>{a.icono}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{a.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{a.miembros.length} {a.miembros.length === 1 ? "persona" : "personas"} · meta {fmtVal(a.metaTotal, a.unidad)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: t.c, lineHeight: 1 }}>{a.pct}%</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmtVal(a.total, a.unidad)}</div>
                </div>
              </div>

              {/* Barra del área */}
              <div style={{ padding: "12px 18px 4px" }}>
                <div style={{ height: 10, background: "var(--border-soft)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, a.pct)}%`, height: "100%", background: t.bar, borderRadius: 6, transition: "width .5s ease" }} />
                </div>
              </div>

              {/* Miembros */}
              <div style={{ padding: "8px 10px 12px" }}>
                {a.miembros.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin actividad registrada hoy en esta área.</div>
                ) : a.miembros.map((m, i) => {
                  const mt = tono(m.pct);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 8px", borderRadius: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: mt.bg, border: `1px solid ${mt.bd}`, color: mt.c, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nombre}</span>
                          <span style={{ fontWeight: 800, fontSize: 13.5, color: mt.c, whiteSpace: "nowrap" }}>{fmtVal(m.valor, a.unidad)}</span>
                        </div>
                        <div style={{ height: 6, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden", margin: "4px 0 3px" }}>
                          <div style={{ width: `${Math.min(100, m.pct)}%`, height: "100%", background: mt.bar, transition: "width .5s ease" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)" }}>
                          <span>{m.extra}</span>
                          <span><b style={{ color: mt.c }}>{m.pct}%</b> de {fmtVal(m.meta, a.unidad)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {areas.length === 0 && !err ? (
        <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--muted)" }}>
          {data ? "Aún no hay actividad registrada hoy. Las áreas aparecerán aquí en cuanto haya movimiento." : "Cargando desempeño del día…"}
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, val, sub, c, big, mono }) {
  return (
    <div className="card" style={{ padding: "14px 16px", borderTop: `3px solid ${c}` }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: big ? 34 : 26, fontWeight: 900, color: c, lineHeight: 1.1, marginTop: 4, fontFamily: mono ? "ui-monospace,monospace" : "inherit" }}>{val}</div>
      {sub ? <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div> : null}
    </div>
  );
}
