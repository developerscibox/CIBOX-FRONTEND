import { useEffect, useRef, useState } from "react";
import { api, usingMock } from "../api.js";
import { cargarModelos, capturarMuestras, describirRostro, abrirCamara, listarCamaras, guardarCamara, deviceIdDeStream, mensajeErrorCamara } from "../face.js";

// PICKERS Y NIVELES (gerente): define la EXPERIENCIA de cada bodeguero y su PIN del
// tótem. Regla: "nuevo" solo toma pedidos chicos; "experto" toma ambos y el sistema
// le prioriza los grandes. El backend hace cumplir la regla al tomar el pedido.

const MOCK = [
  { _id: "1", name: "Bodeguero Luis", email: "luis@demo.cl", picker_nivel: "experto", picker_pin: "1234" },
  { _id: "2", name: "Bodeguera Caro", email: "caro@demo.cl", picker_nivel: "nuevo", picker_pin: "5678" },
  { _id: "3", name: "Bodeguero Tomás", email: "tomas@demo.cl", picker_nivel: "experto", picker_pin: null },
];

export default function Pickers() {
  const [pickers, setPickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [draft, setDraft] = useState({}); // id → { nivel, pin }
  const [busy, setBusy] = useState(null);
  const [rostroDe, setRostroDe] = useState(null); // picker cuyo rostro se está registrando

  const load = () => {
    if (usingMock) { setPickers(MOCK); setLoading(false); return; }
    api.pickers().then((d) => setPickers(Array.isArray(d) ? d : (d?.data || []))).catch((e) => setMsg({ ok: false, t: e.message })).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const val = (p, field) => (draft[p._id]?.[field] !== undefined ? draft[p._id][field] : (field === "nivel" ? (p.picker_nivel || "experto") : (p.picker_pin || "")));
  const setField = (id, field, v) => setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: v } }));
  const dirty = (p) => draft[p._id] && (draft[p._id].nivel !== undefined || draft[p._id].pin !== undefined);

  async function guardar(p) {
    const nivel = val(p, "nivel");
    const pin = String(val(p, "pin") || "").trim();
    if (pin && !/^\d{4,8}$/.test(pin)) { setMsg({ ok: false, t: "El PIN debe tener 4 a 8 dígitos" }); return; }
    setBusy(p._id); setMsg(null);
    try {
      if (!usingMock) await api.pickerConfig(p._id, { nivel, pin });
      setPickers((list) => list.map((x) => (x._id === p._id ? { ...x, picker_nivel: nivel, picker_pin: pin || null } : x)));
      setDraft((d) => { const n = { ...d }; delete n[p._id]; return n; });
      setMsg({ ok: true, t: `${p.name}: nivel ${nivel}${pin ? " · PIN actualizado" : ""}` });
    } catch (e) { setMsg({ ok: false, t: e.message || "No se pudo guardar" }); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: "4px solid var(--magenta)" }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Cómo funciona el nivel de cada picker</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: "var(--text)" }}>
          <span style={pill("#ecfdf5", "#166534", "#a7f3d0")}><b>Nuevo</b> — solo pedidos <b>chicos</b> (bajo ${UMBRAL})</span>
          <span style={pill("#eff6ff", "#0369a1", "#bae6fd")}><b>Experto</b> — toma <b>chicos y grandes</b>; el tótem le prioriza los grandes</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
          El <b>PIN</b> identifica al picker en el tótem (<code>/totem</code>). La regla se aplica sola al tomar el pedido.
        </div>
      </div>

      {msg ? <div className="card" style={{ padding: "10px 14px", marginBottom: 12, background: msg.ok ? "#ecfdf5" : "#fef2f2", color: msg.ok ? "#166534" : "var(--danger)", fontWeight: 600 }}>{msg.t}</div> : null}

      {loading ? (
        <div className="card" style={{ padding: 24, color: "var(--muted)" }}>Cargando pickers…</div>
      ) : pickers.length === 0 ? (
        <div className="card" style={{ padding: 24, color: "var(--muted)" }}>No hay bodegueros registrados. Créalos en Usuarios (rol operario).</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {pickers.map((p) => {
            const nivel = val(p, "nivel");
            return (
              <div key={p._id} className="card" style={{ padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.email}</div>
                </div>

                {/* Nivel: toggle */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[["nuevo", "Nuevo"], ["experto", "Experto"]].map(([k, lb]) => (
                    <button key={k} onClick={() => setField(p._id, "nivel", k)}
                      style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, border: `1px solid ${nivel === k ? "var(--magenta)" : "var(--border)"}`, background: nivel === k ? "#fdf2f8" : "#fff", color: nivel === k ? "var(--magenta-d)" : "var(--muted)" }}>
                      {lb}
                    </button>
                  ))}
                </div>

                {/* PIN */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>PIN del tótem</div>
                  <input value={val(p, "pin")} onChange={(e) => setField(p._id, "pin", e.target.value.replace(/\D/g, "").slice(0, 8))}
                    inputMode="numeric" placeholder="4-8 dígitos"
                    style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 15, fontFamily: "ui-monospace,monospace", letterSpacing: 2 }} />
                </div>

                {/* Rostro (reconocimiento facial en el tótem) */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Rostro</div>
                  <button onClick={() => setRostroDe(p)}
                    title={p.has_face ? "Actualizar el rostro registrado" : "Registrar el rostro para entrar al tótem sin PIN"}
                    style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12.5, border: `1px solid ${p.has_face ? "#a7f3d0" : "var(--border)"}`, background: p.has_face ? "#ecfdf5" : "#fff", color: p.has_face ? "#166534" : "var(--muted)" }}>
                    {p.has_face ? "Registrado · Actualizar" : "Registrar rostro"}
                  </button>
                </div>

                <button onClick={() => guardar(p)} disabled={!dirty(p) || busy === p._id}
                  style={{ marginLeft: "auto", background: dirty(p) ? "var(--magenta)" : "var(--border)", color: dirty(p) ? "#fff" : "var(--muted)", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: dirty(p) ? "pointer" : "default" }}>
                  {busy === p._id ? "Guardando…" : "Guardar"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {rostroDe ? (
        <RegistroRostro
          picker={rostroDe}
          onClose={() => setRostroDe(null)}
          onSaved={(id, has) => setPickers((list) => list.map((x) => (x._id === id ? { ...x, has_face: has } : x)))}
        />
      ) : null}
    </div>
  );
}

// Modal de REGISTRO DE ROSTRO: registra el rostro del picker por CÁMARA (3 muestras
// en vivo) o SUBIENDO UNA FOTO (respaldo si la webcam está bloqueada/ocupada).
// Solo se guardan los descriptores (128 números), nunca la imagen.
function RegistroRostro({ picker, onClose, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const aliveRef = useRef(true);
  const seqRef = useRef(0); // token por-llamada: gana la última cámara solicitada
  const [camOk, setCamOk] = useState(false);
  const [camaras, setCamaras] = useState([]);   // videoinputs disponibles
  const [camId, setCamId] = useState("");        // cámara elegida (deviceId)
  const [camErr, setCamErr] = useState("");      // error real de la cámara (accionable)
  const [modelosOk, setModelosOk] = useState(false);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | capturando | guardando | ok | error
  const [msg, setMsg] = useState("Cargando reconocimiento…");
  const [prog, setProg] = useState(0);

  // Abre (o cambia a) una cámara. Recuerda la que funciona para que el tótem la reuse.
  const abrir = async (id) => {
    const seq = ++seqRef.current;
    setCamErr("");
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try {
      const s = await abrirCamara(id);
      if (!aliveRef.current || seq !== seqRef.current) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      const real = deviceIdDeStream(s);
      if (id) guardarCamara(real || id); // persistir SOLO la elección explícita del selector
      setCamId(real || id || "");
      setCamOk(true);
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
      setCamaras(await listarCamaras()); // ya hay permiso → ahora sí trae etiquetas
    } catch (e) {
      if (!aliveRef.current || seq !== seqRef.current) return;
      setCamOk(false); setCamErr(mensajeErrorCamara(e));
      try { setCamaras(await listarCamaras()); } catch { /* noop */ }
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    // 1) Modelos: independientes de la cámara. Apenas cargan, el modal pasa a
    //    "listo" → "Subir foto" queda habilitado SIN esperar a la cámara.
    cargarModelos((t) => { if (aliveRef.current) setMsg((m) => (m.startsWith("Cargando") || m.startsWith("Iniciando") ? t : m)); })
      .then(() => { if (aliveRef.current) { setModelosOk(true); setEstado((e) => (e === "cargando" ? "listo" : e)); } })
      .catch(() => { if (aliveRef.current) setMsg("No se pudo cargar el reconocimiento. Recarga la página."); });
    // 2) Cámara: best-effort (no bloquea el modal). Si falla, el error se muestra y
    //    queda la subida de foto como respaldo.
    abrir();
    return () => { aliveRef.current = false; try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mensaje guía según cámara disponible.
  useEffect(() => {
    if (estado !== "listo") return;
    setMsg(camOk ? "Mira la cámara de frente, con buena luz." : "Cámara no disponible. Puedes subir una foto tuya de frente.");
  }, [estado, camOk]);

  const guardarDescriptores = async (muestras, comoFoto) => {
    if (!muestras.length) {
      setEstado("listo");
      setMsg(comoFoto ? "No detecté una cara clara en la foto. Usa una de frente y con buena luz." : "No detecté tu rostro. Acércate, con buena luz, y reintenta.");
      return;
    }
    setEstado("guardando"); setMsg("Guardando…");
    try {
      if (!usingMock) await api.pickerFace(picker._id, muestras);
      onSaved?.(picker._id, true);
      setEstado("ok"); setMsg(`Rostro registrado (${muestras.length} muestra${muestras.length === 1 ? "" : "s"}).`);
      setTimeout(onClose, 1000);
    } catch (e) { setEstado("error"); setMsg("No se pudo guardar: " + (e.message || "")); }
  };

  const capturar = async () => {
    setEstado("capturando"); setMsg("Capturando… mantén la cara centrada."); setProg(0);
    const muestras = await capturarMuestras(videoRef.current, 3, (i) => { setProg(i); setMsg(`Muestra ${i} de 3…`); });
    await guardarDescriptores(muestras, false);
  };

  const subirFoto = async (file) => {
    if (!file) return;
    setEstado("guardando"); setMsg("Analizando la foto…");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const desc = await describirRostro(img);
      await guardarDescriptores(desc ? [desc] : [], true);
    } catch (e) { setEstado("listo"); setMsg("No se pudo leer la foto. Prueba con otra (JPG/PNG)."); }
    finally { URL.revokeObjectURL(url); if (fileRef.current) fileRef.current.value = ""; }
  };

  const quitar = async () => {
    if (!window.confirm(`¿Quitar el rostro registrado de ${picker.name}?`)) return;
    setEstado("guardando"); setMsg("Quitando…");
    try {
      if (!usingMock) await api.pickerFace(picker._id, []);
      onSaved?.(picker._id, false);
      setEstado("ok"); setMsg("Rostro eliminado.");
      setTimeout(onClose, 800);
    } catch (e) { setEstado("error"); setMsg("No se pudo quitar: " + (e.message || "")); }
  };

  const ocupado = estado === "capturando" || estado === "guardando" || estado === "cargando";
  const camsSel = camaras.filter((c) => c.deviceId); // solo cámaras reales (con permiso)
  const btn = (bg, color, bd = "transparent") => ({ border: `1px solid ${bd}`, background: bg, color, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: ocupado ? "default" : "pointer", opacity: ocupado ? 0.6 : 1 });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,14,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 380, padding: 18, textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Registrar rostro</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>{picker.name}</div>

        <div style={{ position: "relative", width: 200, height: 200, margin: "0 auto 12px", borderRadius: "50%", overflow: "hidden", background: "#0b0e14", border: "3px solid var(--border)", display: "grid", placeItems: "center" }}>
          {camOk
            ? <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            : <div style={{ fontSize: 64 }}>👤</div>}
          {estado === "ok" ? <div style={{ position: "absolute", inset: 0, background: "rgba(16,124,51,.35)", display: "grid", placeItems: "center", fontSize: 60, color: "#fff" }}>✓</div> : null}
        </div>

        {/* Selector de cámara + error real (para elegir la USB externa y no la integrada tapada). */}
        {(camsSel.length > 1 || camErr) ? (
          <div style={{ marginBottom: 10 }}>
            {camsSel.length > 1 ? (
              <select value={camId} onChange={(e) => abrir(e.target.value)}
                style={{ maxWidth: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, fontFamily: "inherit" }}>
                {camId ? null : <option value="">Elige una cámara…</option>}
                {camsSel.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
              </select>
            ) : null}
            {camErr ? (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 6, lineHeight: 1.35 }}>
                {camErr}{" "}
                <button onClick={() => abrir(camId)} style={{ textDecoration: "underline", background: "none", border: "none", color: "var(--magenta-d)", cursor: "pointer", fontWeight: 700, padding: 0 }}>Reintentar</button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ fontSize: 13.5, color: estado === "error" ? "var(--danger)" : estado === "ok" ? "#166534" : "var(--text)", fontWeight: 600, minHeight: 40, marginBottom: 10 }}>{msg}</div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => subirFoto(e.target.files?.[0])} />

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onClose} style={btn("#fff", "var(--muted)", "var(--border)")}>Cerrar</button>
          {picker.has_face && !ocupado ? <button onClick={quitar} style={btn("#fff", "var(--danger)", "#fca5a5")}>Quitar</button> : null}
          <button onClick={() => fileRef.current?.click()} disabled={ocupado || !modelosOk} style={btn("#fff", "var(--magenta-d)", "var(--magenta)")}>Subir foto</button>
          {camOk ? (
            <button onClick={capturar} disabled={ocupado || !modelosOk} style={btn(!ocupado && modelosOk ? "var(--magenta-d)" : "var(--border-soft)", !ocupado && modelosOk ? "#fff" : "var(--muted)")}>
              {estado === "capturando" ? `Capturando ${prog}/3…` : "Capturar rostro"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const UMBRAL = (300000).toLocaleString("es-CL");
const pill = (bg, c, bd) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: c, border: `1px solid ${bd}`, borderRadius: 999, padding: "6px 12px" });
