import { useEffect, useState } from "react";
import { api } from "../api.js";
import { t } from "../theme.js";
import { imprimirTurnoTermico } from "../escpos.js";

// KIOSKO CESFAM — página PÚBLICA /turno pensada para un TÓTEM táctil en la
// entrada (botones grandes, teclado en pantalla, flujo en loop):
//   Paso 1: RUT con teclado numérico (formato en vivo + módulo 11)
//   Paso 2: "Comprar en tienda" o "Pagar/retirar mi pedido de internet"
//   Paso 3: número gigante + estado en vivo → "Terminar" vuelve al paso 1.
const LS_KEY = "b12_turno";
const today = () => new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" local
const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

// Endpoints públicos nuevos del kiosko ({tipo,rut} / pedidos-por-rut). Helpers
// locales para no tocar api.js (archivo compartido con otros agentes en esta ola).
const BASE = import.meta.env.VITE_API_URL || "";
async function pub(path, body) {
  const res = await fetch(BASE + path, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
  return json?.data ?? json; // el backend envuelve todo en { success, data }
}
const crearTurnoApi = (body) => pub("/turnos", body);
const pedidosPorRut = (rut) => pub(`/turnos/pedidos-por-rut/${encodeURIComponent(rut)}`);

// ── RUT: limpieza, formato en vivo (12.345.678-9) y validación módulo 11 ─────
const cleanRut = (s) => String(s || "").replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
function formatRut(raw) {
  const s = cleanRut(raw);
  if (s.length <= 1) return s;
  return s.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + s.slice(-1);
}
function rutValido(raw) {
  const s = cleanRut(raw);
  if (s.length < 7) return false;
  const body = s.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const dv = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return s.slice(-1) === dv;
}

const ESTADOS = {
  waiting: { color: "#1d4ed8", bg: "#eff6ff" },
  calling: { color: "#15803d", bg: "#f0fdf4" },
  attending: { color: "#b45309", bg: "#fffbeb" },
  done: { color: t.muted, bg: "#f3f4f6" },
  cancelled: { color: "#b91c1c", bg: "#fef2f2" },
};
const TERMINALES = new Set(["done", "cancelled"]);

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "K", "0", "⌫"];

export default function Turno() {
  const [turno, setTurno] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      // Descartar un turno guardado de un día anterior (los turnos se reinician a diario).
      if (saved && saved.day && saved.day !== today()) { localStorage.removeItem(LS_KEY); return null; }
      return saved;
    } catch { return null; }
  });
  const [status, setStatus] = useState(null);
  const [paso, setPaso] = useState("rut"); // "rut" | "tipo" | "pedidos" (solo sin turno)
  const [rut, setRut] = useState("");
  const [rutMsg, setRutMsg] = useState("");
  const [pedidos, setPedidos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Seguimiento en vivo del turno propio. El polling se DETIENE al llegar a un
  // estado terminal (done/cancelled) — fix a5-20.
  useEffect(() => {
    if (!turno?.id) return undefined;
    let alive = true;
    let iv = null;
    const load = async () => {
      try {
        const s = await api.turnoStatus(turno.id);
        if (!alive) return;
        setStatus(s);
        if (TERMINALES.has(s?.status) && iv) { clearInterval(iv); iv = null; }
      } catch { /* el turno pudo expirar (día siguiente); se ignora */ }
    };
    load();
    iv = setInterval(load, 6000);
    return () => { alive = false; if (iv) clearInterval(iv); };
  }, [turno?.id]);

  const tecla = (k) => {
    setRutMsg("");
    setRut((r) => (k === "⌫" ? r.slice(0, -1) : cleanRut(r + k)));
  };

  const continuarRut = () => {
    if (!rutValido(rut)) {
      setRutMsg("Ese RUT no parece válido. Revísalo, o continúa sin RUT (solo compra).");
      return;
    }
    setRutMsg(""); setErr(""); setPaso("tipo");
  };

  // Crea el turno (compra o retiro) y pasa al paso 3.
  async function crear(tipo, rutArg, nombre = "Cliente") {
    if (busy) return;
    setBusy(true); setErr(""); setRutMsg("");
    try {
      const body = { name: nombre, tipo };
      if (rutArg) body.rut = formatRut(rutArg);
      const tn = await crearTurnoApi(body);
      const saved = { id: tn.id, code: tn.code, name: nombre, tipo: tn.tipo || tipo, day: today() };
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
      setTurno(saved);
      setStatus({ status: "waiting", ahead: null, code: tn.code });
      // Si este kiosko tiene la impresora térmica (puente corriendo), imprime
      // el número automáticamente. Best-effort: no bloquea ni rompe el flujo.
      imprimirTurnoTermico({ code: tn.code, tipo: saved.tipo, nombre }).catch(() => { /* sin impresora */ });
    } catch (e) {
      setErr(e.message || "No se pudo generar tu número. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function buscarPedidos() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const d = await pedidosPorRut(formatRut(rut));
      setPedidos(d.pedidos || []);
      setPaso("pedidos");
    } catch (e) {
      setErr(e.message || "No pudimos buscar tus pedidos. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  // Kiosko en loop: "Terminar" limpia todo y vuelve al paso 1.
  function terminar() {
    localStorage.removeItem(LS_KEY);
    setTurno(null); setStatus(null); setRut(""); setRutMsg("");
    setPedidos(null); setErr(""); setPaso("rut");
  }

  // TÓTEM: reinicio automático por inactividad. Si alguien deja el flujo a
  // medias (o ya sacó su número), vuelve solo al paso 1 para el siguiente
  // cliente. Cualquier interacción cambia paso/rut/turno y reinicia el timer.
  useEffect(() => {
    const enReposo = paso === "rut" && !turno && !rut;
    if (enReposo) return undefined;
    const ms = turno ? 45_000 : 60_000; // con número a la vista: 45s; a medias: 60s
    const id = setTimeout(terminar, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, turno, rut, pedidos, status]);

  const st = status?.status || "waiting";
  const meta = ESTADOS[st] || ESTADOS.waiting;
  const esRetiro = turno?.tipo === "retiro";

  return (
    <div style={S.wrap}>
      <header style={S.head}>
        <img src="/logo-bodega12.png" alt="Bodega 12" style={S.logo} />
        <div style={S.headTitle}>Toma tu número de atención</div>
        <div style={S.headSub}>Bodega 12 · Supermercado mayorista · Lo Espejo</div>
      </header>

      <main style={S.main}>
        {turno ? (
          // ── Paso 3: número gigante + estado en vivo ────────────────────────
          <div style={{ ...S.card, background: meta.bg }}>
            <div style={S.cardSub}>Tu número de atención</div>
            <div style={{ ...S.bigNum, color: meta.color }}>{turno.code}</div>
            <div style={{
              alignSelf: "center", borderRadius: 999, padding: "7px 16px", fontSize: 16, fontWeight: 800,
              background: esRetiro ? "#dbeafe" : "#f3f4f6", color: esRetiro ? "#1d4ed8" : "#374151",
            }}>
              {esRetiro ? "Retiro de pedido" : "Compra en tienda"}
            </div>

            <div style={{ ...S.estado, color: meta.color }}>
              {st === "waiting" && (
                status?.ahead == null
                  ? "Estás en la fila"
                  : status.ahead === 0
                    ? "Eres el siguiente — atento al mostrador"
                    : `Hay ${status.ahead} ${status.ahead === 1 ? "persona" : "personas"} antes de ti`
              )}
              {st === "calling" && "🔔 ¡Es tu turno! Acércate al mostrador"}
              {st === "attending" && "Te estamos atendiendo"}
              {st === "done" && "Atención finalizada. Si hiciste un pedido, síguelo en la pantalla."}
              {st === "cancelled" && "Tu turno fue anulado. Saca uno nuevo si aún necesitas atención."}
            </div>

            {/* Sin links de salida: el tótem se queda en el kiosko. El avance
                se mira en la PANTALLA de la sala (TV), no aquí. */}
            <div style={{ ...S.linkBtn, cursor: "default" }}>Sigue tu avance en la pantalla de la sala</div>
            <button onClick={terminar} style={S.btnBig}>Terminar</button>
          </div>
        ) : paso === "rut" ? (
          // ── Paso 1: RUT con teclado en pantalla ────────────────────────────
          <div style={S.card}>
            <div style={S.cardTitle}>Ingresa tu RUT</div>
            <div style={S.cardSub}>Con tu RUT podemos buscar tus pedidos de internet.</div>
            <div style={S.rutBox}>
              {rut ? formatRut(rut) : <span style={{ color: "#c9bfce" }}>12.345.678-9</span>}
            </div>
            {rutMsg ? <div style={S.err}>{rutMsg}</div> : null}
            <div style={S.pad}>
              {TECLAS.map((k) => (
                <button key={k} style={S.key} onClick={() => tecla(k)} aria-label={k === "⌫" ? "Borrar" : k}>
                  {k}
                </button>
              ))}
            </div>
            <button
              style={{ ...S.btnBig, opacity: rut.length >= 2 && !busy ? 1 : 0.5 }}
              disabled={rut.length < 2 || busy}
              onClick={continuarRut}
            >
              Continuar ➜
            </button>
            <button style={S.ghostBtn} disabled={busy} onClick={() => crear("compra", "")}>
              Continuar sin RUT (solo compra)
            </button>
            {err ? <div style={S.err}>{err}</div> : null}
          </div>
        ) : paso === "tipo" ? (
          // ── Paso 2: ¿compra o retiro de pedido web? ────────────────────────
          <div style={S.card}>
            <div style={S.cardSub}>RUT {formatRut(rut)}</div>
            <div style={S.cardTitle}>¿Qué necesitas hoy?</div>
            <button style={{ ...S.btnHuge, background: t.grad }} disabled={busy} onClick={() => crear("compra", rut)}>
              Comprar en tienda
            </button>
            <button style={{ ...S.btnHuge, background: "#1d4ed8" }} disabled={busy} onClick={buscarPedidos}>
              {busy ? "Buscando tus pedidos…" : "Pagar o retirar mi pedido de internet"}
            </button>
            {err ? <div style={S.err}>{err}</div> : null}
            <button style={S.ghostBtn} disabled={busy} onClick={() => { setErr(""); setPaso("rut"); }}>‹ Volver</button>
          </div>
        ) : (
          // ── Paso 2b: pedidos web del RUT ───────────────────────────────────
          <div style={S.card}>
            {pedidos && pedidos.length ? (
              <>
                <div style={S.cardTitle}>Tus pedidos de internet</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pedidos.map((p) => (
                    <div key={p.folio} style={S.pedidoRow}>
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={S.folio}>{p.folio}</div>
                        <div style={S.pedidoEstado}>{p.estado_label || p.estado}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={S.pedidoTotal}>{clp(p.total)}</div>
                        <span style={p.pagado ? S.badgeOk : S.badgeWarn}>
                          {p.pagado ? "Pagado" : "Por pagar"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ ...S.cardSub, fontWeight: 700 }}>
                  Toma tu número y espera que te llamen en caja.
                </div>
              </>
            ) : (
              <>
                <div style={S.cardTitle}>No encontramos pedidos con este RUT</div>
                <div style={S.cardSub}>
                  Igual puedes sacar un número de retiro y te ayudamos en caja.
                </div>
              </>
            )}
            <button style={{ ...S.btnHuge, background: "#1d4ed8" }} disabled={busy} onClick={() => crear("retiro", rut)}>
              Sacar número para retiro
            </button>
            {err ? <div style={S.err}>{err}</div> : null}
            <button style={S.ghostBtn} disabled={busy} onClick={() => { setErr(""); setPaso("tipo"); }}>‹ Volver</button>
          </div>
        )}

        <footer style={S.foot}>
          Bodega 12 · Supermercado mayorista · Lo Espejo
        </footer>
      </main>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", color: t.text },
  head: { background: t.grad, color: "#fff", padding: "26px 20px 22px", textAlign: "center" },
  logo: { height: 44, width: "auto", filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))" },
  headTitle: { fontSize: 26, fontWeight: 800, marginTop: 10 },
  headSub: { fontSize: 13, opacity: 0.9, marginTop: 2 },
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "22px 16px", gap: 16 },
  card: {
    width: "100%", maxWidth: 560, background: "#fff", borderRadius: 22,
    border: "1px solid var(--border)", padding: 28, textAlign: "center",
    display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 10px 30px rgba(122,27,74,.10)",
  },
  cardTitle: { fontSize: 26, fontWeight: 800 },
  cardSub: { fontSize: 16, color: t.muted },
  // Paso 1 — RUT + teclado táctil
  rutBox: {
    fontFamily: "ui-monospace, monospace", fontSize: 40, fontWeight: 800, letterSpacing: "1px",
    border: "2px solid var(--border)", borderRadius: 16, padding: "14px 10px", minHeight: 56,
  },
  pad: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  key: {
    border: "1.5px solid var(--border)", borderRadius: 16, background: "#fff",
    padding: "18px 0", fontSize: 28, fontWeight: 800, color: t.text, cursor: "pointer",
  },
  // Botones
  btnBig: {
    border: "none", borderRadius: 16, padding: "18px 16px", fontSize: 20, fontWeight: 800,
    color: "#fff", background: t.grad, cursor: "pointer",
  },
  btnHuge: {
    border: "none", borderRadius: 18, padding: "24px 18px", fontSize: 22, fontWeight: 800,
    color: "#fff", cursor: "pointer", lineHeight: 1.25,
  },
  ghostBtn: { background: "transparent", border: "none", color: t.muted, fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "8px 0" },
  // Paso 2b — pedidos
  pedidoRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", background: "#fff",
  },
  folio: { fontFamily: "ui-monospace, monospace", fontSize: 24, fontWeight: 800 },
  pedidoEstado: { fontSize: 14, color: t.muted, marginTop: 2 },
  pedidoTotal: { fontSize: 18, fontWeight: 800 },
  badgeOk: { display: "inline-block", marginTop: 4, background: "#dcfce7", color: "#15803d", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 800 },
  badgeWarn: { display: "inline-block", marginTop: 4, background: "#fef3c7", color: "#b45309", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 800 },
  // Paso 3
  bigNum: { fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 84, lineHeight: 1, letterSpacing: "1px" },
  estado: { fontSize: 18, fontWeight: 700, marginTop: 6, minHeight: 24 },
  linkBtn: {
    marginTop: 8, display: "block", textDecoration: "none", textAlign: "center",
    border: "1px solid var(--border)", background: "#fff", color: t.magenta,
    borderRadius: 14, padding: "14px 16px", fontSize: 17, fontWeight: 700,
  },
  err: { color: "#b91c1c", fontSize: 15, background: "#fef2f2", borderRadius: 10, padding: "10px 12px" },
  foot: { textAlign: "center", color: t.muted, fontSize: 12.5, marginTop: 6 },
};
