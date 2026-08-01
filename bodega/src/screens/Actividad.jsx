import { useEffect, useRef, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";

// ACTIVIDAD EN VIVO (gerente): quién está conectado, qué prepara cada uno, quién está
// en TIEMPO MUERTO (conectado sin acción reciente) y cuánto trabajó hoy. Presencia
// vía User.last_seen (throttle en el middleware); actividad vía status_history.

const ROLES = {
  admin: "Administrador", manager: "Gerente", vendedor: "Vendedor",
  cashier: "Cajera", operator: "Bodeguero", pantalla: "Pantalla",
};

const EST = {
  ocupado: { txt: "Preparando pedido", c: "#16a34a", bg: "#ecfdf5", bd: "#a7f3d0", dot: "#16a34a" },
  activo: { txt: "Activo", c: "#0369a1", bg: "#eff6ff", bd: "#bae6fd", dot: "#0ea5e9" },
  tiempo_muerto: { txt: "Tiempo muerto", c: "#b45309", bg: "#fffbeb", bd: "#fde68a", dot: "#f59e0b" },
  ausente: { txt: "Ausente", c: "#6b7280", bg: "#f9fafb", bd: "#e5e7eb", dot: "#9ca3af" },
  offline: { txt: "Desconectado", c: "#9ca3af", bg: "#fafafa", bd: "#eee", dot: "#d1d5db" },
};

const MOCK = {
  resumen: { conectados: 4, ocupados: 2, tiempo_muerto: 1, acciones_hoy: 47 },
  items: [
    { id: "1", nombre: "Bodeguero Uno", role: "operator", estado: "ocupado", hace_min: 0, acciones_hoy: 12, tarea: { folio: "A1B2C3", cliente: "Minimarket La Esquina", total: 84500 }, ultima_accion: { nota: "Picking aceptado", hace_min: 1 } },
    { id: "2", nombre: "Cajera", role: "cashier", estado: "activo", hace_min: 1, acciones_hoy: 18, tarea: null, ultima_accion: { nota: "Cobrado (efectivo)", hace_min: 2 } },
    { id: "3", nombre: "Vendedor de Sala", role: "vendedor", estado: "tiempo_muerto", hace_min: 1, acciones_hoy: 5, tarea: null, ultima_accion: { nota: "Pedido tomado", hace_min: 14 } },
    { id: "4", nombre: "Gerente", role: "manager", estado: "activo", hace_min: 0, acciones_hoy: 3, tarea: null, ultima_accion: null },
    { id: "5", nombre: "Pantalla Kiosko", role: "pantalla", estado: "offline", hace_min: null, acciones_hoy: 0, tarea: null, ultima_accion: null },
  ],
};

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const hace = (m) => (m == null ? "sin registro" : m <= 0 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)}h`);

export default function Actividad() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const aliveRef = useRef(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const load = async () => {
      if (usingMock) { setData(MOCK); return; }
      try {
        const d = await api.actividad();
        if (aliveRef.current) { setData(d?.data || d); setErr(""); }
      } catch (e) { if (aliveRef.current) setErr(e.message || "Sin conexión"); }
    };
    load();
    const id = setInterval(load, 15000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", load); } } catch { /* poll */ }
    return () => { aliveRef.current = false; clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  const items = data?.items || [];
  const r = data?.resumen || { conectados: 0, ocupados: 0, tiempo_muerto: 0, acciones_hoy: 0 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <Tile label="Conectados ahora" val={r.conectados} sub="del equipo" c="#0ea5e9" dot />
        <Tile label="Trabajando" val={r.ocupados} sub="preparando pedidos" c="#16a34a" />
        <Tile label="Tiempo muerto" val={r.tiempo_muerto} sub="conectados sin actividad" c="#f59e0b" alert={r.tiempo_muerto > 0} />
        <Tile label="Acciones hoy" val={r.acciones_hoy} sub="movimientos del equipo" c="#9B007A" />
      </div>

      {err && !usingMock ? (
        <div className="card" style={{ padding: 12, marginBottom: 12, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>{err} — reintentando…</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(340px,100%),1fr))", gap: 12 }}>
        {items.map((u) => {
          const e = EST[u.estado] || EST.offline;
          const pulse = u.estado === "ocupado" || u.estado === "activo";
          return (
            <div key={u.id} className="card" style={{ padding: 16, borderLeft: `5px solid ${e.dot}`, opacity: u.estado === "offline" ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ position: "relative", width: 12, height: 12 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: e.dot }} />
                  {pulse ? <span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `2px solid ${e.dot}`, animation: "actPulse 1.6s ease-out infinite" }} /> : null}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.15 }}>{u.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{ROLES[u.role] || u.role}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: e.c, background: e.bg, border: `1px solid ${e.bd}`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                  {e.txt}
                </span>
              </div>

              {u.tarea ? (
                <div style={{ marginTop: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: "#166534", fontWeight: 700, letterSpacing: ".3px" }}>PREPARANDO AHORA</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
                    <span style={{ fontWeight: 800, fontFamily: "ui-monospace,monospace" }}>#{u.tarea.folio}</span>
                    <span style={{ color: "#166534", fontWeight: 700 }}>{clp(u.tarea.total)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#166534" }}>{u.tarea.cliente}</div>
                </div>
              ) : u.estado === "tiempo_muerto" ? (
                <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                  Conectado pero sin actividad {u.ultima_accion ? `hace ${u.ultima_accion.hace_min} min` : "reciente"}.
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12.5, color: "var(--muted)" }}>
                <span>{u.estado === "offline" || u.estado === "ausente" ? `Visto ${hace(u.hace_min)}` : `Conectado · ${hace(u.hace_min)}`}</span>
                <span><b style={{ color: "var(--text)" }}>{u.acciones_hoy}</b> acciones hoy</span>
              </div>
              {u.ultima_accion && u.estado !== "tiempo_muerto" ? (
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>Última: {u.ultima_accion.nota} · {hace(u.ultima_accion.hace_min)}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {items.length === 0 && !err ? (
        <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--muted)" }}>
          {data ? "Sin usuarios con actividad registrada hoy." : "Cargando actividad del equipo…"}
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)" }}>
        {Object.entries(EST).map(([k, e]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: e.dot }} /> {e.txt}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>Se actualiza en vivo · {new Date(now).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>

      <style>{`@keyframes actPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}`}</style>
    </div>
  );
}

function Tile({ label, val, sub, c, dot, alert }) {
  return (
    <div className="card" style={{ padding: "14px 16px", borderTop: `3px solid ${c}` }}>
      <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
        {dot ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 0 3px ${c}22` }} /> : null}{label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: alert ? c : "var(--text)", lineHeight: 1.1, marginTop: 4 }}>{val}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
