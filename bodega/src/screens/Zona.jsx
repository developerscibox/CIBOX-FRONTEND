import { useEffect, useRef, useState } from "react";
import { api, streamUrl } from "../api.js";
import { t } from "../theme.js";

// MONITOR PÚBLICO por zona (sin login) — pensado para un monitor colgado en el
// área (Lácteos, Galletas, Congelados…). El dueño de área ve SOLO los ítems de
// SU zona por pedido, los prepara y marca "✔ CAJAS LISTAS"; el picker pasa a
// recoger. Letra grande, tema oscuro (visible a distancia). Ruta: /zona?s=Lácteos.

const ZONA_KEY = "b12_zona";

// Cronómetro mm:ss desde created_at (con horas si la espera se alarga).
const mmss = (iso, now) => {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
};

export default function Zona() {
  const sector = (new URLSearchParams(window.location.search).get("s") || "").trim();
  if (!sector) return <ZonaConfig />;
  return <ZonaMonitor sector={sector} />;
}

// ── Pantalla de configuración (falta ?s=) ─────────────────────────────────────
// Fija la zona del monitor: input + "Fijar zona" → localStorage + recarga con ?s=.
// Si el monitor se reinicia sin query pero ya fue configurado, vuelve solo a su zona.
const PILOTO = ["Lácteos", "Galletas", "Congelados"];

function ZonaConfig() {
  const [v, setV] = useState(() => {
    try { return localStorage.getItem(ZONA_KEY) || ""; } catch { return ""; }
  });

  // Monitor ya configurado (reboot, home sin query) → volver solo a su zona.
  useEffect(() => {
    let saved = "";
    try { saved = localStorage.getItem(ZONA_KEY) || ""; } catch { /* sin storage */ }
    if (saved) window.location.replace(`${window.location.pathname}?s=${encodeURIComponent(saved)}`);
  }, []);

  const fijar = (nombre) => {
    const s = String(nombre || "").trim();
    if (!s) return;
    try { localStorage.setItem(ZONA_KEY, s); } catch { /* sin storage */ }
    window.location.href = `${window.location.pathname}?s=${encodeURIComponent(s)}`;
  };

  return (
    <div style={{ ...D.wrap, alignItems: "center", justifyContent: "center" }}>
      <style>{CSS}</style>
      <form
        onSubmit={(e) => { e.preventDefault(); fijar(v); }}
        style={{ background: D.cardBg, border: `1px solid ${D.borderC}`, borderRadius: 22, padding: "36px 34px", width: "min(560px, 92vw)", display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: t.rosa, textTransform: "uppercase" }}>Monitor de zona · Bodega 12</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>¿De qué zona es este monitor?</div>
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Ej: Lácteos"
          maxLength={40}
          style={{ background: "#0b0e14", border: `2px solid ${D.borderC}`, borderRadius: 14, color: "#fff", fontSize: 26, fontWeight: 700, padding: "16px 18px", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PILOTO.map((n) => (
            <button key={n} type="button" onClick={() => setV(n)} className="zn-chipbtn">{n}</button>
          ))}
        </div>
        <button type="submit" disabled={!v.trim()} className="zn-bigbtn" style={{ background: t.grad }}>
          Fijar zona
        </button>
        <div style={{ color: D.mutedC, fontSize: 14 }}>
          Queda guardada en este equipo: al reiniciar, el monitor vuelve solo a su zona.
        </div>
      </form>
    </div>
  );
}

// ── Monitor en vivo de la zona ────────────────────────────────────────────────
function ZonaMonitor({ sector }) {
  const [pedidos, setPedidos] = useState([]);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  // Marcas optimistas: la card pasa a verde al toque; el board confirma después.
  const [doneLocal, setDoneLocal] = useState(() => new Set());
  const busyRef = useRef(new Set());

  // Reloj + cronómetros (1 tick por segundo).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // En vivo: SSE (evento "change", incluye type "zone") + poll 15s de respaldo.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await api.zoneBoard(sector);
        if (!alive) return;
        setPedidos(d?.pedidos || []);
        setErr("");
        setUpdated(new Date());
      } catch {
        if (alive) setErr("Sin conexión — reintentando…");
      }
    };
    load();
    const id = setInterval(load, 15000);
    let es = null;
    try {
      const u = streamUrl();
      if (u) { es = new EventSource(u); es.addEventListener("change", load); }
    } catch { /* sin SSE → sigue el polling */ }
    return () => {
      alive = false;
      clearInterval(id);
      try { es && es.close(); } catch { /* noop */ }
    };
  }, [sector]);

  async function marcarLista(folio) {
    if (busyRef.current.has(folio)) return;
    busyRef.current.add(folio);
    setDoneLocal((s) => new Set(s).add(folio)); // optimista (el POST es idempotente)
    try {
      await api.zonaLista(folio, sector);
    } catch (e) {
      setDoneLocal((s) => { const n = new Set(s); n.delete(folio); return n; });
      setErr(e.message || "No se pudo marcar — reintenta");
    } finally {
      busyRef.current.delete(folio);
    }
  }

  function cambiarZona() {
    try { localStorage.removeItem(ZONA_KEY); } catch { /* sin storage */ }
    window.location.href = window.location.pathname;
  }

  const isLista = (p) => !!p.zona_lista || doneLocal.has(p.folio);
  // FIFO del backend; las zonas ya listas se van al final, atenuadas.
  const orden = [...pedidos.filter((p) => !isLista(p)), ...pedidos.filter((p) => isLista(p))];
  const enCola = pedidos.filter((p) => !isLista(p)).length;

  return (
    <div style={D.wrap}>
      <style>{CSS}</style>

      <header style={D.head}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2.5, color: t.rosa, textTransform: "uppercase" }}>
            Zona · Bodega 12
          </div>
          <div className="zn-title">{sector}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div className="zn-clock">
            {new Date(now).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: enCola ? "#3b2905" : "#0f2417", border: `1px solid ${enCola ? "#b45309" : "#166534"}`, borderRadius: 999, padding: "7px 16px" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: enCola ? "#fbbf24" : "#4ade80" }}>{enCola}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: D.mutedC }}>pedido{enCola === 1 ? "" : "s"} en cola</span>
          </div>
          <div style={{ fontSize: 12.5, color: D.mutedC }}>
            {err
              ? <span style={{ color: "#fca5a5", fontWeight: 700 }}>{err}</span>
              : updated
                ? `Actualizado ${updated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "Cargando…"}
            {" · "}
            <button onClick={cambiarZona} style={D.linkBtn}>cambiar zona</button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "18px 22px 26px" }}>
        {orden.length === 0 ? (
          <div style={D.empty}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#fff" }}>Sin pedidos para {sector}</div>
            <div style={{ fontSize: 17, color: D.mutedC }}>Cuando entre un pedido con productos de tu zona, aparece aquí al instante.</div>
          </div>
        ) : (
          <div className="zn-grid">
            {orden.map((p) => {
              const lista = isLista(p);
              const chip = lista
                ? { txt: "✔ LISTA", bg: "#0f2417", fg: "#4ade80", bd: "#166534" }
                : p.status === "preparing" && p.tomado_por
                  ? { txt: `RECOLECTOR EN CAMINO · ${p.tomado_por}`, bg: "#0e1f38", fg: "#60a5fa", bd: "#1d4ed8" }
                  : { txt: "⏳ EN COLA", bg: "#3b2905", fg: "#fbbf24", bd: "#b45309" };
              return (
                <section key={p.folio} className="zn-card" style={{ ...D.card, opacity: lista ? 0.45 : 1, borderColor: lista ? "#166534" : D.borderC }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span className="zn-folio">#{p.folio}</span>
                    <span className="zn-chip" style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}>{chip.txt}</span>
                    <span className="zn-timer" style={{ marginLeft: "auto", color: lista ? D.mutedC : "#fbbf24" }}>
                      ⏱ {p.created_at ? mmss(p.created_at, now) : "—"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0 16px" }}>
                    {(p.items || []).map((it, i) => (
                      <div key={i} style={D.itemRow}>
                        <span className="zn-itname">{it.name}</span>
                        <span className="zn-itqty">
                          {Number(it.cajas) > 0
                            ? `${it.cajas} caja${Number(it.cajas) === 1 ? "" : "s"}`
                            : `${it.cantidad || 0} un`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {lista ? (
                    <div style={D.doneBar}>✔ Zona lista — esperando al recolector</div>
                  ) : (
                    <button className="zn-bigbtn" style={{ background: "#15803d" }} onClick={() => marcarLista(p.folio)}>
                      ✔ CAJAS LISTAS
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer style={{ textAlign: "center", color: D.mutedC, fontSize: 14, padding: "0 16px 16px" }}>
        Prepara los productos de <b style={{ color: "#fff" }}>{sector}</b> y marca <b style={{ color: "#4ade80" }}>CAJAS LISTAS</b> — el recolector pasa a buscarlas y pega la etiqueta con el <b style={{ color: "#fff" }}>#folio</b> en el bulto.
      </footer>
    </div>
  );
}

// ── Estilos (tema oscuro, letra grande para monitor) ──────────────────────────
const D = {
  cardBg: "#151a23",
  borderC: "#26304a",
  mutedC: "#8b96ad",
  wrap: { minHeight: "100vh", background: "#0b0e14", color: "#e5e7eb", display: "flex", flexDirection: "column", fontFamily: "Poppins, system-ui, sans-serif" },
  head: { display: "flex", alignItems: "center", gap: 18, padding: "18px 22px 10px", flexWrap: "wrap" },
  card: { background: "#151a23", border: "2px solid #26304a", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", transition: "opacity .3s" },
  itemRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, background: "#0b0e14", borderRadius: 12, padding: "10px 14px" },
  doneBar: { textAlign: "center", fontSize: 19, fontWeight: 800, color: "#4ade80", background: "#0f2417", border: "1px solid #166534", borderRadius: 14, padding: "14px 10px" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", padding: "10vh 20px" },
  linkBtn: { background: "none", border: "none", color: "#8b96ad", textDecoration: "underline", cursor: "pointer", fontSize: 12.5, padding: 0 },
};

const CSS = `
.zn-title{ font-size:clamp(38px, 6vw, 64px); font-weight:800; color:#fff; line-height:1.02; overflow-wrap:anywhere; }
.zn-clock{ font-family:ui-monospace,monospace; font-size:clamp(24px, 3vw, 34px); font-weight:800; color:#fff; letter-spacing:1px; }
.zn-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(360px, 100%), 1fr)); gap:16px; align-items:start; }
.zn-folio{ font-family:ui-monospace,monospace; font-size:clamp(26px, 3vw, 34px); font-weight:800; color:#fff; letter-spacing:1.5px; }
.zn-chip{ font-size:14px; font-weight:800; letter-spacing:.6px; border:1.5px solid; border-radius:999px; padding:5px 12px; white-space:nowrap; }
.zn-timer{ font-family:ui-monospace,monospace; font-size:clamp(20px, 2.4vw, 26px); font-weight:800; }
.zn-itname{ font-size:clamp(17px, 2vw, 21px); font-weight:700; color:#e5e7eb; min-width:0; overflow-wrap:anywhere; }
.zn-itqty{ font-family:ui-monospace,monospace; font-size:clamp(18px, 2.2vw, 23px); font-weight:800; color:#fbbf24; white-space:nowrap; }
.zn-bigbtn{ border:none; border-radius:16px; color:#fff; font-family:inherit; font-size:clamp(20px, 2.4vw, 24px); font-weight:800; letter-spacing:.5px; padding:18px 14px; cursor:pointer; width:100%; }
.zn-bigbtn:disabled{ opacity:.4; cursor:not-allowed; }
.zn-bigbtn:active{ transform:scale(.985); }
.zn-chipbtn{ background:#0b0e14; border:1.5px solid #26304a; border-radius:999px; color:#e5e7eb; font-family:inherit; font-size:16px; font-weight:700; padding:8px 16px; cursor:pointer; }
.zn-chipbtn:hover{ border-color:#FF3DA6; color:#FF3DA6; }
`;
