import { useEffect, useRef, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";
import { imprimirTicketPicking, imprimirEtiquetaDespacho } from "../print.js";
import { cargarModelos, describirRostro, abrirCamara, listarCamaras, guardarCamara, deviceIdDeStream, mensajeErrorCamara } from "../face.js";

// TÓTEM DE PICKING (kiosko para bodegueros). El picker se identifica con la cámara +
// PIN (el lector facial/huella real reemplaza el PIN después), ve su cola gateada por
// nivel (nuevo → solo chicos), TOMA un pedido (imprime ticket) y al terminar vuelve a
// FINALIZARLO (imprime etiqueta de despacho). Ruta pública: /totem. Tema oscuro, letra
// grande, pensado para una pantalla táctil en la bodega.

const folioDe = (o) => String(o?._id || "").slice(-6).toUpperCase();
const mmss = (iso, now) => {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};
const itemsResumen = (items = []) =>
  items.slice(0, 3).map((it) => `${Number(it.cajas) > 0 ? it.cajas + "cj" : (it.quantity || 0) + "u"} ${it.name}`).join(" · ")
  + (items.length > 3 ? ` +${items.length - 3}` : "");

export default function Totem() {
  const [stage, setStage] = useState("identify"); // identify | board | tomado
  const [pin, setPin] = useState("");
  const [picker, setPicker] = useState(null);
  const [tablero, setTablero] = useState({ disponibles: [], en_curso: [] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [camOk, setCamOk] = useState(false);
  const [camaras, setCamaras] = useState([]);
  const [camId, setCamId] = useState("");
  const [camErr, setCamErr] = useState("");
  const [facialMsg, setFacialMsg] = useState(""); // estado del reconocimiento facial
  const [aviso, setAviso] = useState("");     // banner si la MISMA persona vuelve a entrar tras tomar
  const [tomado, setTomado] = useState(null); // pedido recién tomado (pantalla de confirmación)
  const [reconocido, setReconocido] = useState(null); // picker detectado por cámara, PENDIENTE de tocar "Entrar"
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const camAliveRef = useRef(true);
  const camReqRef = useRef(0); // token por-llamada: gana la última cámara solicitada
  const idleRef = useRef(Date.now());
  const ultimoTomoRef = useRef(null); // { key, at } del último que tomó (para el aviso)
  const tomadoTimerRef = useRef(null); // auto-salir tras confirmar
  // Espejos de estado para el bucle de reconocimiento (evita closures obsoletos).
  const stageRef = useRef(stage); useEffect(() => { stageRef.current = stage; }, [stage]);
  const camOkRef = useRef(camOk); useEffect(() => { camOkRef.current = camOk; }, [camOk]);
  const busyRef = useRef(busy); useEffect(() => { busyRef.current = busy; }, [busy]);
  const reconocidoRef = useRef(null); useEffect(() => { reconocidoRef.current = reconocido; }, [reconocido]);
  const facialRef = useRef({ procesando: false, ready: false, muerto: false });

  // Identidad estable del picker (para saber si es "la misma persona" que ya tomó).
  const clavePicker = (p, pinVal) => String(p?.id || p?._id || pinVal || "");
  // Aviso si la MISMA persona vuelve a entrar poco después de tomar (ventana 3 min).
  const evaluarAviso = (p, pinVal) => {
    const u = ultimoTomoRef.current;
    const repite = u && u.key === clavePicker(p, pinVal) && Date.now() - u.at < 180000;
    setAviso(repite ? "Ya tomaste un pedido recién. Deja que otros tomen los suyos; toma otro solo si es realmente necesario." : "");
  };

  // Entra directo cuando el rostro es reconocido: el backend devuelve el picker y su
  // PIN, así el tablero/tomar/finalizar siguen funcionando igual que con PIN.
  const entrarFacial = (r) => {
    if (!r) return;
    setPin(r.pin || "");
    setPicker(r.picker);
    evaluarAviso(r.picker, r.pin);
    setReconocido(null);
    setFacialMsg("Rostro reconocido");
    setStage("board");
    idleRef.current = Date.now();
  };

  // Carga los modelos faciales y, en identificación, reconoce el rostro cada ~1.3s. NO
  // entra solo: deja al picker PRE-RECONOCIDO y aparece un botón ENTRAR que él toca.
  // Si aparece una cara desconocida o nadie mira la cámara, limpia el pre-reconocido.
  useEffect(() => {
    if (usingMock) return undefined;
    const st = facialRef.current;
    st.muerto = false;
    cargarModelos((t) => setFacialMsg(t)).then(() => { st.ready = true; setFacialMsg("Mira la cámara para identificarte"); }).catch(() => setFacialMsg(""));
    const id = setInterval(async () => {
      if (st.muerto || st.procesando || !st.ready || busyRef.current) return;
      if (stageRef.current !== "identify" || !camOkRef.current || !videoRef.current) return;
      if (reconocidoRef.current?.via === "pin") return; // hay un PIN confirmándose: no interferir
      st.procesando = true;
      try {
        const desc = await describirRostro(videoRef.current);
        if (desc) {
          try {
            const r = await api.totemIdentificarFacial(desc);
            st.lastMatch = Date.now();
            setReconocido((prev) => (prev && prev.via === "face" && prev.pin === r.pin ? prev : { ...r, via: "face" }));
            setFacialMsg("Rostro reconocido");
          } catch {
            // cara presente pero NO reconocida → limpia el pre-reconocido por cara (¿otra persona?)
            setReconocido((prev) => (prev && prev.via === "face" ? null : prev));
          }
        }
      } catch { /* frame sin cara */ }
      finally {
        // si hace rato que no hay match (la persona se fue), limpia el pendiente
        if (st.lastMatch && Date.now() - st.lastMatch > 4000) {
          st.lastMatch = 0; setReconocido((prev) => (prev && prev.via === "face" ? null : prev)); setFacialMsg("Mira la cámara para identificarte");
        }
        st.procesando = false;
      }
    }, 1300);
    return () => { st.muerto = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reloj + cronómetros.
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // Seguridad: el nombre pre-reconocido por PIN se auto-limpia a los 20s si nadie toca
  // Entrar (evita que el siguiente entre como el anterior). El de cara ya lo limpia el bucle.
  useEffect(() => {
    if (reconocido?.via !== "pin") return undefined;
    const t = setTimeout(() => { setReconocido(null); setPin(""); }, 20000);
    return () => clearTimeout(t);
  }, [reconocido]);

  // Cámara: abre la recordada/predeterminada; si falla, muestra el error real y deja
  // el PIN de respaldo. El selector (abajo) permite elegir la USB externa a mano.
  const abrirCam = async (id) => {
    const req = ++camReqRef.current;
    setCamErr("");
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try {
      const s = await abrirCamara(id);
      if (!camAliveRef.current || req !== camReqRef.current) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      const real = deviceIdDeStream(s);
      if (id) guardarCamara(real || id); // persistir SOLO la elección explícita del selector
      setCamId(real || id || "");
      setCamOk(true);
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      setCamaras(await listarCamaras());
    } catch (e) {
      if (!camAliveRef.current || req !== camReqRef.current) return;
      setCamOk(false); setCamErr(mensajeErrorCamara(e));
      try { setCamaras(await listarCamaras()); } catch { /* noop */ }
    }
  };
  useEffect(() => {
    camAliveRef.current = true;
    abrirCam();
    return () => { camAliveRef.current = false; try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Re-enlaza el stream al <video> cuando volvemos a la pantalla de identificación.
  useEffect(() => {
    if (stage === "identify" && camOk && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, camOk]);

  const touch = () => { idleRef.current = Date.now(); };

  // Kiosko: tras 90s sin interacción en el tablero, vuelve a pedir identificación.
  useEffect(() => {
    if (stage !== "board") return undefined;
    const id = setInterval(() => { if (Date.now() - idleRef.current > 90000) salir(); }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Tablero en vivo (poll + SSE) mientras está identificado.
  useEffect(() => {
    if (stage !== "board" || !picker) return undefined;
    let alive = true;
    const load = async () => {
      try { const d = await api.totemTablero(pin); if (alive) setTablero({ disponibles: d?.disponibles || [], en_curso: d?.en_curso || [] }); }
      catch { /* transitorio */ }
    };
    load();
    const id = setInterval(load, 8000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", load); } } catch { /* poll */ }
    return () => { alive = false; clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, picker]);

  function salir() {
    clearTimeout(tomadoTimerRef.current);
    facialRef.current.lastMatch = 0;
    setStage("identify"); setPicker(null); setPin(""); setErr(""); setTomado(null); setReconocido(null);
    setTablero({ disponibles: [], en_curso: [] });
    // 'aviso' NO se limpia aquí: si la misma persona vuelve a entrar, evaluarAviso lo re-evalúa
    // (y para otra persona lo pone en "").
  }

  const keypad = (d) => { touch(); setErr(""); setPin((p) => (d === "C" ? "" : d === "←" ? p.slice(0, -1) : (p + d).slice(0, 8))); };

  async function identificar() {
    if (pin.length < 4) { setErr("Ingresa tu PIN (4 a 8 dígitos)"); return; }
    setBusy(true); setErr("");
    try {
      // NO entra directo: muestra "Hola, <nombre>" + botón Entrar (igual que por cara).
      if (usingMock) { setReconocido({ picker: { id: "demo", nombre: "Bodeguero Demo", nivel: "experto" }, pin, via: "pin" }); touch(); return; }
      const d = await api.totemIdentificar(pin);
      setReconocido({ picker: d.picker, pin, via: "pin" }); touch();
    } catch (e) { setErr(e.status === 404 ? "PIN no reconocido" : (e.message || "No se pudo identificar")); setPin(""); }
    finally { setBusy(false); }
  }

  async function tomar(o) {
    touch();
    // Aviso ACTIVO = la misma persona ya tomó uno recién → confirma antes de tomar otro.
    if (aviso && !window.confirm("Ya tomaste un pedido hace poco. ¿Seguro que quieres tomar OTRO pedido?")) return;
    setBusy(true); setErr("");
    try {
      if (!usingMock) {
        const d = await api.totemTomar(pin, o._id);
        try { imprimirTicketPicking(d.order, {}, { etiquetas: true }); } catch { /* la impresión no rompe */ }
      }
      // Recuerda quién tomó y SALE: tras aceptar+imprimir se cierra la sesión para que no
      // encadene pedidos. Muestra confirmación unos segundos y vuelve a identificación.
      ultimoTomoRef.current = { key: clavePicker(picker, pin), at: Date.now() };
      setBusy(false);
      setTomado(o); setStage("tomado");
      clearTimeout(tomadoTimerRef.current);
      tomadoTimerRef.current = setTimeout(() => salir(), 5000);
    } catch (e) {
      setErr(e.status === 409 || e.code ? (e.message || "Ese pedido ya lo tomó otro") : (e.message || "No se pudo tomar"));
      setBusy(false);
    }
  }

  async function finalizar(o) {
    touch();
    const bultos = window.prompt("¿Cuántos bultos? (deja vacío si no aplica)", "");
    if (bultos === null) return;
    setBusy(true); setErr("");
    try {
      if (!usingMock) {
        const nb = String(bultos).trim() === "" ? null : Math.round(Number(bultos));
        const d = await api.totemFinalizar(pin, o._id, nb);
        try { imprimirEtiquetaDespacho(d.order, { bultos: nb }); } catch { /* noop */ }
      }
      const d2 = await (usingMock ? Promise.resolve(null) : api.totemTablero(pin));
      if (d2) setTablero({ disponibles: d2.disponibles || [], en_curso: d2.en_curso || [] });
    } catch (e) { setErr(e.message || "No se pudo finalizar"); }
    finally { setBusy(false); }
  }

  // ── Pantalla de IDENTIFICACIÓN ──────────────────────────────────────────────
  const camsSel = camaras.filter((c) => c.deviceId); // solo cámaras reales (con permiso)
  if (stage === "identify") {
    return (
      <div style={D.wrap} onMouseDown={touch}>
        <style>{CSS}</style>
        <div style={{ maxWidth: 460, width: "92vw", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2.5, color: "#7fd6cf", textTransform: "uppercase" }}>Tótem de picking · Bodega 12</div>
          <div style={{ position: "relative", width: 190, height: 190 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: "3px solid #26304a", background: "#0b0e14" }}>
              {camOk
                ? <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>👤</div>}
            </div>
            <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px dashed ${reconocido ? "#22c55e" : "#7fd6cf"}`, animation: "spin 8s linear infinite" }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            {reconocido ? `Hola, ${reconocido.picker?.nombre || reconocido.picker?.name || ""}` : "Acércate para identificarte"}
          </div>
          {reconocido ? (
            <>
              <div style={{ fontSize: 14.5, color: "#7fd6cf", fontWeight: 700, minHeight: 20 }}>Te reconocí. Toca Entrar para continuar.</div>
              <button onClick={() => entrarFacial(reconocido)} className="tk-enter" style={{ background: "linear-gradient(90deg,#15803d,#22c55e)" }}>Entrar ✓</button>
              <button onClick={() => { setReconocido(null); setPin(""); facialRef.current.lastMatch = 0; }} style={{ background: "none", border: "none", color: "#8b96ad", cursor: "pointer", fontSize: 13, textDecoration: "underline", fontFamily: "inherit" }}>No soy yo</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14.5, color: "#8b96ad", minHeight: 20 }}>
                {camOk && facialMsg && facialMsg !== "Rostro reconocido" ? facialMsg : camOk ? "Mira la cámara y toca Entrar, o usa tu PIN." : "Ingresa tu PIN para identificarte."}
              </div>
              <div style={{ fontSize: 12.5, color: "#6b7690" }}>¿La cámara no te reconoce? Ingresa tu PIN</div>
            </>
          )}

          {/* Selector de cámara + error real: elegir la USB externa y no la integrada tapada. */}
          {(camsSel.length > 1 || camErr) ? (
            <div style={{ width: "min(340px,86vw)" }}>
              {camsSel.length > 1 ? (
                <select value={camId} onChange={(e) => abrirCam(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #3a4560", background: "#151a23", color: "#e5e7eb", fontSize: 13, fontFamily: "inherit" }}>
                  {camId ? null : <option value="">Elige la cámara…</option>}
                  {camsSel.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
                </select>
              ) : null}
              {camErr ? (
                <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 6, lineHeight: 1.35 }}>
                  {camErr}{" "}
                  <button onClick={() => abrirCam(camId)} style={{ textDecoration: "underline", background: "none", border: "none", color: "#7fd6cf", cursor: "pointer", fontWeight: 700, padding: 0 }}>Reintentar</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* PIN: se oculta mientras se muestra el nombre pre-reconocido (cara o PIN). */}
          {!reconocido ? (
            <>
              <div style={{ display: "flex", gap: 12, height: 22 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: i < pin.length ? "#7fd6cf" : "transparent", border: `2px solid ${i < pin.length ? "#7fd6cf" : "#3a4560"}` }} />
                ))}
              </div>
              {err ? <div style={{ color: "#fca5a5", fontWeight: 700 }}>{err}</div> : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, width: "min(300px,80vw)" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((d) => (
                  <button key={d} onClick={() => keypad(d)} className="tk-key">{d}</button>
                ))}
              </div>
              <button onClick={identificar} disabled={busy || pin.length < 4} className="tk-enter">{busy ? "Identificando…" : "Entrar ✓"}</button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Pantalla de CONFIRMACIÓN (pedido tomado → vuelve a identificación) ───────
  if (stage === "tomado") {
    return (
      <div style={D.wrap} onMouseDown={salir}>
        <style>{CSS}</style>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 24, maxWidth: 460 }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#0f2417", border: "3px solid #166534", display: "grid", placeItems: "center", fontSize: 60, color: "#4ade80" }}>✓</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#fff" }}>Pedido #{tomado ? folioDe(tomado) : ""} tomado</div>
          <div style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.4 }}>Retira tu ticket impreso y ve a preparar el pedido. Vuelve al tótem al terminar para finalizarlo.</div>
          <div style={{ fontSize: 13, color: "#6b7690", marginTop: 6 }}>Volviendo al inicio… toca para continuar</div>
        </div>
      </div>
    );
  }

  // ── TABLERO del picker ──────────────────────────────────────────────────────
  const nivelExperto = picker?.nivel === "experto";
  // Cola FIFO: del más antiguo al más nuevo (sin mostrar el valor del pedido).
  const disponiblesOrden = [...tablero.disponibles].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return (
    <div style={D.wrap} onMouseDown={touch}>
      <style>{CSS}</style>
      <header style={D.head}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#7fd6cf", textTransform: "uppercase" }}>Tótem · Bodega 12</div>
          <div style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#fff", lineHeight: 1.05 }}>Hola, {picker?.nombre || picker?.name}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, borderRadius: 999, padding: "6px 14px", background: nivelExperto ? "#0e1f38" : "#3b2905", color: nivelExperto ? "#60a5fa" : "#fbbf24", border: `1px solid ${nivelExperto ? "#1d4ed8" : "#b45309"}` }}>
            {nivelExperto ? "Picker experto — toma todos los pedidos" : "Picker nuevo — solo pedidos chicos"}
          </span>
          <button onClick={salir} style={D.linkBtn}>Salir</button>
        </div>
      </header>

      {aviso ? <div style={{ margin: "0 22px 12px", background: "#3b2905", border: "1px solid #b45309", color: "#fbbf24", borderRadius: 12, padding: "12px 16px", fontWeight: 700 }}>⚠ {aviso}</div> : null}
      {err ? <div style={{ margin: "0 22px 12px", background: "#3b0d12", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 12, padding: "12px 16px", fontWeight: 700 }}>{err}</div> : null}

      <main style={{ flex: 1, padding: "0 22px 26px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(420px,100%),1fr))", gap: 18, alignItems: "start" }}>
        {/* Disponibles */}
        <section>
          <h2 style={D.h2}>Para tomar <span style={D.count}>{disponiblesOrden.length}</span></h2>
          {disponiblesOrden.length === 0 ? (
            <div style={D.empty}>Sin pedidos disponibles para ti ahora.</div>
          ) : disponiblesOrden.map((o) => {
            const grande = o.segmento === "grande";
            return (
              <div key={o._id} style={{ ...D.card, borderColor: grande ? "#1d4ed8" : "#26304a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={D.folio}>#{folioDe(o)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: grande ? "#0e1f38" : "#0f2417", color: grande ? "#60a5fa" : "#4ade80", border: `1px solid ${grande ? "#1d4ed8" : "#166534"}` }}>{grande ? "GRANDE" : "CHICO"}</span>
                  <span style={{ marginLeft: "auto", color: "#fbbf24", fontFamily: "ui-monospace,monospace", fontWeight: 800 }}>⏱ {mmss(o.created_at, now)}</span>
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 15, margin: "8px 0 4px" }}>{itemsResumen(o.items)}</div>
                <div style={{ color: "#8b96ad", fontSize: 14, marginTop: 8 }}>{o.customer?.fullName || "Mostrador"}</div>
                <button onClick={() => tomar(o)} disabled={busy} className="tk-take">Tomar este pedido</button>
              </div>
            );
          })}
        </section>

        {/* En curso */}
        <section>
          <h2 style={D.h2}>Tus pedidos en curso <span style={D.count}>{tablero.en_curso.length}</span></h2>
          {tablero.en_curso.length === 0 ? (
            <div style={D.empty}>No tienes pedidos en preparación.</div>
          ) : tablero.en_curso.map((o) => (
            <div key={o._id} style={{ ...D.card, borderColor: "#166534" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={D.folio}>#{folioDe(o)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: "#3b2905", color: "#fbbf24", border: "1px solid #b45309" }}>PREPARANDO</span>
                <span style={{ marginLeft: "auto", color: "#8b96ad", fontFamily: "ui-monospace,monospace" }}>⏱ {mmss(o.created_at, now)}</span>
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 15, margin: "8px 0 4px" }}>{itemsResumen(o.items)}</div>
              <button onClick={() => finalizar(o)} disabled={busy} className="tk-done">Finalizar · listo para retiro</button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

const D = {
  wrap: { minHeight: "100vh", background: "#0b0e14", color: "#e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, system-ui, sans-serif", padding: "18px 0" },
  head: { display: "flex", alignItems: "flex-end", gap: 18, padding: "18px 22px 14px", width: "100%", flexWrap: "wrap" },
  h2: { fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 10 },
  count: { fontSize: 13, fontWeight: 800, background: "#1a2233", color: "#7fd6cf", borderRadius: 999, padding: "2px 10px" },
  card: { background: "#151a23", border: "2px solid #26304a", borderRadius: 16, padding: "14px 16px", marginBottom: 14 },
  folio: { fontFamily: "ui-monospace,monospace", fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: 1 },
  empty: { background: "#151a23", border: "1px dashed #26304a", borderRadius: 14, padding: 24, color: "#8b96ad", textAlign: "center" },
  linkBtn: { background: "none", border: "1px solid #3a4560", color: "#8b96ad", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
};

const CSS = `
@keyframes spin { to { transform: rotate(360deg); } }
.tk-key { background:#151a23; border:2px solid #26304a; border-radius:16px; color:#fff; font-family:inherit; font-size:26px; font-weight:800; padding:16px 0; cursor:pointer; }
.tk-key:active { background:#1f2937; transform:scale(.97); }
.tk-enter { width:min(300px,80vw); border:none; border-radius:16px; background:linear-gradient(90deg,#0e6b66,#12a89f); color:#fff; font-family:inherit; font-size:22px; font-weight:800; padding:16px; cursor:pointer; }
.tk-enter:disabled { opacity:.5; cursor:not-allowed; }
.tk-take { width:100%; margin-top:12px; border:none; border-radius:14px; background:#15803d; color:#fff; font-family:inherit; font-size:19px; font-weight:800; padding:15px; cursor:pointer; }
.tk-done { width:100%; margin-top:12px; border:none; border-radius:14px; background:linear-gradient(90deg,#7c3aed,#9333ea); color:#fff; font-family:inherit; font-size:19px; font-weight:800; padding:15px; cursor:pointer; }
.tk-take:disabled,.tk-done:disabled { opacity:.55; cursor:not-allowed; }
`;
