import { useEffect, useRef, useState } from "react";
import { api, streamUrl } from "../api.js";
import { t } from "../theme.js";

// Tablero PÚBLICO (sin login) para los clientes en la bodega. Una sola vista con:
//   • aviso "pide tu número en el tótem" (los números se sacan por RUT en /turno)
//   • el recorrido completo en 4 columnas:
//     En espera (turno) → En atención (módulo) → En preparación (pedido) → Listo
// Avisos: tono + voz al pasar a "Listo" o al llamar un turno. Modo TV + responsive.
const normNum = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const spell = (s) => String(s).replace(/#/g, "").replace(/-/g, " ").trim().split("").join(" ");

// Tono breve de dos notas con WebAudio (sin archivos).
function chime(ctx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    g.connect(ctx.destination);
    const start = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    o.start(start);
    o.stop(start + 0.24);
  });
}

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CL";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  } catch { /* TTS no disponible */ }
}

export default function Pantalla() {
  const [orders, setOrders] = useState({ paid: [], preparing: [], ready: [] });
  const [turnos, setTurnos] = useState({ attending: [], waiting: [], multi_module: false });
  const [updated, setUpdated] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [tv, setTv] = useState(() => typeof window !== "undefined" && /[?&]tv\b/.test(window.location.search));
  const [fresh, setFresh] = useState(new Set());
  const [calledAlert, setCalledAlert] = useState(null); // turnos recién llamados (alerta visible ~8s)

  const ctxRef = useRef(null);
  const soundOnRef = useRef(false);
  const prevReadyRef = useRef(new Set());
  const prevCallingRef = useRef(new Set());
  const seededReadyRef = useRef(false);
  const seededCallingRef = useRef(false);
  const freshTimerRef = useRef(null);
  const nextAnnounceAtRef = useRef(0);
  const announceTimersRef = useRef([]);
  const alertTimerRef = useRef(null);

  function announce(text) {
    chime(ctxRef.current);
    setTimeout(() => speak(text), 350);
  }

  function enableSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !ctxRef.current) ctxRef.current = new Ctx();
      ctxRef.current?.resume?.();
    } catch { /* sin audio */ }
    soundOnRef.current = true;
    setSoundOn(true);
    chime(ctxRef.current);
    setTimeout(() => speak("Avisos activados"), 350);
  }

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [b, tn] = await Promise.allSettled([api.board(), api.turnoBoard()]);
      if (!alive) return;

      const board = b.status === "fulfilled" && b.value ? b.value : null;
      const tboard = tn.status === "fulfilled" && tn.value ? tn.value : { attending: [], waiting: [], multi_module: false };

      if (board) setOrders(board);
      setTurnos(tboard);

      if (b.status === "rejected" && tn.status === "rejected") {
        setErr("Sin conexión — reintentando…");
      } else {
        setErr("");
        setUpdated(new Date());
      }

      // ── Avisos: comparar por-fuente, sembrando cada una de forma independiente.
      // Si una fuente falla en la 1ª carga, NO se anuncia su backlog al recuperarse
      // (su prev-ref solo se actualiza cuando ESA fuente respondió ok).
      let freshReady = [];
      let freshCalling = [];

      if (b.status === "fulfilled") {
        const readyNums = new Set((board?.ready || []).map((o) => o.number));
        if (seededReadyRef.current) {
          freshReady = [...readyNums].filter((n) => !prevReadyRef.current.has(n));
        } else {
          seededReadyRef.current = true; // siembra sin anunciar el backlog
        }
        prevReadyRef.current = readyNums;
      }

      if (tn.status === "fulfilled") {
        const callingItems = (tboard.attending || []).filter((x) => x.status === "calling");
        const callingCodes = new Set(callingItems.map((x) => x.code));
        if (seededCallingRef.current) {
          freshCalling = [...callingCodes].filter((c) => !prevCallingRef.current.has(c));
          // Alerta visual destacada para los recién llamados (~8s, sin depender del sonido).
          const freshItems = callingItems.filter((x) => freshCalling.includes(x.code));
          if (freshItems.length) {
            setCalledAlert(freshItems);
            clearTimeout(alertTimerRef.current);
            alertTimerRef.current = setTimeout(() => setCalledAlert(null), 8000);
          }
        } else {
          seededCallingRef.current = true;
        }
        prevCallingRef.current = callingCodes;
      }

      if (soundOnRef.current && (freshReady.length || freshCalling.length)) {
        const msgs = [
          ...freshReady.slice(0, 3).map((n) => `Pedido ${spell(n)}, listo para retiro`),
          ...freshCalling.slice(0, 3).map((c) => `Turno ${spell(c)}, pasa al mostrador`),
        ];
        const now = Date.now();
        if (nextAnnounceAtRef.current < now) nextAnnounceAtRef.current = now;
        msgs.forEach((msg) => {
          const delay = nextAnnounceAtRef.current - now;
          const h = setTimeout(() => announce(msg), delay);
          announceTimersRef.current.push(h);
          nextAnnounceAtRef.current += 1900;
        });
      }

      if (freshReady.length) {
        setFresh(new Set(freshReady));
        clearTimeout(freshTimerRef.current);
        freshTimerRef.current = setTimeout(() => setFresh(new Set()), 7000);
      }
    };

    load();
    const id = setInterval(load, 8000);
    // Tiempo real: SSE empuja un refresco al instante ante cualquier cambio del
    // relay; el polling de 8s queda como respaldo si el stream no está disponible.
    let es = null;
    try {
      const u = streamUrl();
      if (u) { es = new EventSource(u); es.addEventListener("change", load); }
    } catch { /* sin SSE → sigue el polling */ }
    return () => {
      alive = false;
      clearInterval(id);
      try { es && es.close(); } catch { /* noop */ }
      clearTimeout(freshTimerRef.current);
      clearTimeout(alertTimerRef.current);
      announceTimersRef.current.forEach(clearTimeout);
      announceTimersRef.current = [];
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* sin TTS */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = normNum(q);
  const isHit = (s) => query.length >= 2 && normNum(s).includes(query);

  // 4 columnas del recorrido: turno → atención → preparación → listo.
  const cols = [
    {
      key: "espera", title: "En espera", sub: "esperando ser atendido", color: "#6d28d9", bg: "#f5f3ff",
      kind: "turno", items: turnos.waiting || [],
    },
    {
      key: "atencion", title: "En atención", sub: "pasa al mostrador", color: "#b45309", bg: "#fffbeb",
      kind: "turno", module: turnos.multi_module, items: turnos.attending || [],
    },
    {
      // Pedidos pagados que AÚN no toma nadie: en cola, esperando preparación.
      // Antes salían como "En preparación" y generaban falsa expectativa.
      key: "cola", title: "En cola", sub: "esperando que preparen tu pedido", color: "#0891b2", bg: "#ecfeff",
      kind: "pedido", items: orders.paid || [],
    },
    {
      // Solo los que un colega de bodega YA tomó y está armando.
      key: "prep", title: "En preparación", sub: "estamos armando tu pedido", color: "#1d4ed8", bg: "#eff6ff",
      kind: "pedido", items: orders.preparing || [],
    },
    {
      key: "listo", title: "Listo para retiro", sub: "acércate a retirar", color: "#15803d", bg: "#f0fdf4",
      kind: "pedido", items: orders.ready || [],
    },
  ];

  // Clientes pendientes = todos los que están en el recorrido sin retirar aún
  // (en espera + en atención + en preparación + listos por retirar).
  const pendingCount = cols.reduce((a, c) => a + c.items.length, 0);

  return (
    <div className={"ptl" + (tv ? " tv" : "")} style={S.wrap}>
      <style>{CSS}</style>

      {/* Alerta destacada al llamar a alguien (visible ~8s, encima de todo) */}
      {calledAlert && calledAlert.length ? (
        <div className="ptl-alert" style={S.alert} role="status" aria-live="assertive">
          <div style={S.alertHead}>Te estamos llamando</div>
          {calledAlert.map((it) => (
            <div key={it.id} style={S.alertRow}>
              <span className="ptl-acode" style={S.alertCode}>{it.code}</span>
              <span className="ptl-atxt" style={S.alertTxt}>
                {it.name} — pasa {it.module ? `a ${it.module}` : "al mostrador"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <header style={S.head} className="ptl-head">
        {/* Marca: logo grande + título */}
        <div style={S.brand}>
          <img src="/logo-bodega12.png" alt="Bodega 12" className="ptl-logo" style={S.logo} />
          <div>
            <div className="ptl-htitle" style={S.headTitle}>Estado de tu pedido</div>
            <div style={S.headSub}>Atención y retiro · Bodega 12 · Lo Espejo</div>
            <div className="ptl-pend" style={S.pendStat}>{pendingCount} cliente{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        {/* Controles (discretos) */}
        <div style={S.headCtrls}>
          <button onClick={() => setTv((v) => !v)} style={S.tvBtn} title="Modo pantalla grande (TV)">
            {tv ? "Salir de modo TV" : "Modo TV"}
          </button>
          <div style={S.upd}>
            {updated ? `Actualizado ${updated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Cargando…"}
            {err ? <div style={{ color: "#fecaca", fontSize: 12 }}>{err}</div> : null}
          </div>
        </div>
      </header>

      {/* Sin banner de "pide tu número": el tótem se explica solo (menos ruido).
          Esta pantalla es 100% seguimiento. */}

      {!tv ? (
        <div style={S.searchWrap}>
          <input
            style={S.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe tu número de pedido o turno para resaltarlo"
          />
        </div>
      ) : null}

      <div className="ptl-cols" style={S.cols}>
        {cols.map((c) => (
          <section key={c.key} style={{ ...S.col, background: c.bg }}>
            <div style={S.colHead}>
              <div>
                <div className="ptl-col-title" style={{ color: c.color }}>{c.title}</div>
                <div style={S.colSub}>{c.sub}</div>
              </div>
              <span style={{ ...S.count, background: c.color }}>{c.items.length}</span>
            </div>
            <div style={S.list}>
              {c.items.length === 0 ? (
                <div style={S.empty}>Sin {c.kind === "turno" ? "turnos" : "pedidos"} en esta etapa</div>
              ) : (
                c.items.map((o) => {
                  const label = c.kind === "turno" ? o.code : o.number;
                  const hit = isHit(label);
                  const isFresh = c.key === "listo" && fresh.has(o.number);
                  const calling = c.kind === "turno" && o.status === "calling";
                  return (
                    <div
                      key={c.kind === "turno" ? o.id : o.number}
                      className={isFresh ? "ptl-fresh" : calling ? "ptl-calling" : ""}
                      style={{
                        ...S.card,
                        border: hit ? `2px solid ${t.magenta}` : "2px solid transparent",
                        boxShadow: hit ? `0 0 0 4px ${t.magenta}33` : "0 1px 3px rgba(0,0,0,.06)",
                        transform: hit ? "scale(1.02)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span className="ptl-num" style={{ color: c.color }}>{label}</span>
                        <span className="ptl-name">{o.name}</span>
                      </div>
                      {c.kind === "turno" && o.tipo ? (
                        <span
                          className="ptl-tag"
                          style={o.tipo === "retiro"
                            ? { color: "#1d4ed8", borderColor: "#1d4ed8" }
                            : { color: "#6b7280", borderColor: "#d1d5db" }}
                        >
                          {o.tipo === "retiro" ? "Retiro" : "Compra"}
                        </span>
                      ) : null}
                      {c.module && o.module ? (
                        <span className="ptl-mod" style={{ background: c.color }}>{o.module}</span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      {!soundOn ? (
        <button onClick={enableSound} style={S.soundBanner}>
          Activar avisos de voz y sonido
        </button>
      ) : null}

      <footer style={S.foot}>
        Bodega 12 · Supermercado mayorista · Lo Espejo — la pantalla se actualiza automáticamente.
      </footer>
    </div>
  );
}

const CSS = `
.ptl-cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(186px, 1fr)); gap:14px; }
@media (max-width:680px){ .ptl-head{ flex-wrap:wrap; } }
.ptl-col-title{ font-size:19px; font-weight:800; }
.ptl-num{ font-family:ui-monospace,monospace; font-weight:800; font-size:21px; letter-spacing:.5px; }
.ptl-name{ font-size:14px; font-weight:600; opacity:.8; }
.ptl-mod{ color:#fff; font-weight:800; font-size:13px; border-radius:8px; padding:4px 9px; white-space:nowrap; }
.ptl-tag{ font-size:12px; font-weight:800; border:1.5px solid; border-radius:8px; padding:3px 8px; white-space:nowrap; background:#fff; }
.ptl.tv .ptl-tag{ font-size:16px; padding:5px 11px; }
.ptl.tv .ptl-pend{ font-size:20px; }
.ptl-logo{ height:58px; width:auto; }
.ptl-htitle{ font-size:27px; font-weight:800; line-height:1.05; }
.ptl.tv .ptl-col-title{ font-size:28px; }
.ptl.tv .ptl-num{ font-size:32px; }
.ptl.tv .ptl-name{ font-size:20px; }
.ptl.tv .ptl-mod{ font-size:18px; padding:6px 12px; }
.ptl.tv .ptl-logo{ height:88px; }
.ptl.tv .ptl-htitle{ font-size:42px; }
@keyframes ptlpulse { 0%{ box-shadow:0 0 0 0 rgba(21,128,61,.55);} 70%{ box-shadow:0 0 0 16px rgba(21,128,61,0);} 100%{ box-shadow:0 0 0 0 rgba(21,128,61,0);} }
.ptl-fresh{ animation:ptlpulse 1.4s ease-out 3; }
@keyframes ptlcall { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.03);} }
.ptl-calling{ animation:ptlcall 1.1s ease-in-out infinite; }
@keyframes ptlalertin { from{ transform:translate(-50%,-26px); opacity:0;} to{ transform:translate(-50%,0); opacity:1;} }
@keyframes ptlalertglow { 0%,100%{ box-shadow:0 14px 44px rgba(230,0,126,.55);} 50%{ box-shadow:0 18px 72px rgba(230,0,126,.95);} }
.ptl-alert{ animation: ptlalertin .35s ease-out, ptlalertglow 1.1s ease-in-out infinite; }
.ptl-acode{ font-size:40px; }
.ptl.tv .ptl-acode{ font-size:64px; }
.ptl-atxt{ font-size:21px; }
.ptl.tv .ptl-atxt{ font-size:32px; }
`;

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", color: t.text },
  head: { background: t.grad, color: "#fff", padding: "16px 26px", display: "flex", alignItems: "center", gap: 20 },
  brand: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 18 },
  logo: { filter: "drop-shadow(0 4px 14px rgba(0,0,0,.3))" },
  headTitle: { fontWeight: 800, lineHeight: 1.05 },
  headSub: { fontSize: 13.5, opacity: 0.92, marginTop: 3, fontWeight: 500 },
  pendStat: { display: "inline-block", marginTop: 8, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.45)", borderRadius: 999, padding: "5px 13px", fontSize: 14, fontWeight: 800 },
  headCtrls: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  tvBtn: { border: "1px solid rgba(255,255,255,.5)", background: "rgba(255,255,255,.12)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  upd: { fontSize: 13, textAlign: "right", opacity: 0.95 },
  // Alerta destacada al llamar a alguien.
  alert: { position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: t.grad, color: "#fff", borderRadius: 18, padding: "16px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "3px solid #fff", maxWidth: "92vw" },
  alertHead: { fontSize: 14, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.95 },
  alertRow: { display: "flex", alignItems: "center", gap: 18, justifyContent: "center", flexWrap: "wrap" },
  alertCode: { fontFamily: "ui-monospace, monospace", fontWeight: 800, letterSpacing: ".5px" },
  alertTxt: { fontWeight: 700 },

  searchWrap: { padding: "14px 24px 2px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" },
  search: { width: "100%", border: "1.5px solid var(--border)", borderRadius: 14, padding: "13px 16px", fontSize: 16, outline: "none", background: "#fff", boxSizing: "border-box", boxShadow: "0 4px 14px rgba(122,27,74,.08)" },

  cols: { flex: 1, padding: "14px 24px 8px", alignItems: "start" },
  col: { borderRadius: 16, padding: 14, minHeight: 260, border: "1px solid var(--border)" },
  colHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  colSub: { fontSize: 12, color: t.muted, marginTop: 2 },
  count: { color: "#fff", fontWeight: 800, fontSize: 15, borderRadius: 999, minWidth: 32, height: 32, display: "grid", placeItems: "center", padding: "0 9px" },
  list: { display: "flex", flexDirection: "column", gap: 9, marginTop: 12 },
  empty: { color: t.muted, fontSize: 13.5, padding: "16px 6px", textAlign: "center" },
  card: { background: "#fff", borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, transition: "transform .15s, box-shadow .15s" },

  soundBanner: { position: "sticky", bottom: 0, alignSelf: "center", margin: "8px auto 4px", border: "none", borderRadius: 999, padding: "12px 22px", fontSize: 15, fontWeight: 700, color: "#fff", background: t.grad, cursor: "pointer", boxShadow: "0 8px 24px rgba(122,27,74,.25)" },
  foot: { textAlign: "center", color: t.muted, fontSize: 13, padding: "10px 0 18px" },
};
