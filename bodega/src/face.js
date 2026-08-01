// Reconocimiento facial EN EL NAVEGADOR (para el tótem de picking y el registro
// de rostro en "Pickers y niveles"). Usa @vladmandic/face-api (TensorFlow.js) con
// los modelos servidos desde /models. Todo local: no sale ninguna imagen del PC,
// solo el "descriptor" (128 números) que representa el rostro.
//
// La librería (~1-2 MB + modelos ~7 MB) se carga PEREZOSAMENTE (import dinámico)
// solo cuando se usa, para no engordar el bundle del panel.

let _lib = null;      // módulo face-api
let _ready = false;   // modelos cargados
let _loading = null;  // promesa de carga en curso (evita cargas dobles)

const MODELS_URL = "/models";

async function lib() {
  if (!_lib) _lib = await import("@vladmandic/face-api");
  return _lib;
}

/** Carga los 3 modelos (detector + landmarks + reconocimiento). Idempotente. */
export async function cargarModelos(onProgreso) {
  if (_ready) return true;
  if (_loading) return _loading;
  _loading = (async () => {
    const f = await lib();
    onProgreso?.("Cargando detector…");
    await f.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
    onProgreso?.("Cargando puntos faciales…");
    await f.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
    onProgreso?.("Cargando reconocimiento…");
    await f.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
    _ready = true;
    return true;
  })();
  try { return await _loading; } finally { _loading = null; }
}

export const modelosListos = () => _ready;

// ── CÁMARA ──────────────────────────────────────────────────────────────────
// Problema real que resolvemos: la webcam INTEGRADA del notebook (tapada) suele ser
// la predeterminada; getUserMedia({video:true}) la ABRE sin error (imagen negra), así
// que nunca se probaba la USB externa. Solución: dejar ELEGIR la cámara, RECORDAR la
// que funcionó (localStorage) y MOSTRAR el error real si algo falla.
// getUserMedia con timeout. Si la cámara resuelve TARDE (tras el timeout), cierra ese
// stream huérfano para no dejar el dispositivo ocupado (evita NotReadableError luego).
function pedirCamara(video, ms = 8000) {
  const p = navigator.mediaDevices.getUserMedia({ video, audio: false });
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => {
      rej(Object.assign(new Error("La cámara no respondió (¿ocupada por otra app?)."), { name: "TimeoutError" }));
      p.then((s) => { try { s.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } }).catch(() => {});
    }, ms)),
  ]);
}
// ¿La etiqueta parece de una webcam EXTERNA/USB? (en este equipo la integrada está tapada)
const pareceExterna = (label = "") => /usb|logitech|c\s?922|brio|external|extern|web ?cam/i.test(label);

const CAM_KEY = "b12_cam_id";
/** deviceId de la última cámara que funcionó (para que el tótem la reuse sola). */
export const camaraGuardada = () => { try { return localStorage.getItem(CAM_KEY) || ""; } catch { return ""; } };
export const guardarCamara = (id) => { try { if (id) localStorage.setItem(CAM_KEY, id); else localStorage.removeItem(CAM_KEY); } catch { /* noop */ } };

/** Cámaras de video disponibles. Las etiquetas (y deviceId) solo aparecen tras
 *  conceder permiso una vez → conviene llamar abrirCamara antes de listar. */
export async function listarCamaras() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === "videoinput");
  } catch { return []; }
}

/** deviceId real de la cámara activa de un stream (para recordarla). */
export function deviceIdDeStream(stream) {
  try { return stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId || ""; } catch { return ""; }
}

/** Traduce el error de getUserMedia a un mensaje accionable en español, con el detalle
 *  técnico (name: message) al final para diagnóstico. También lo loguea en consola. */
export function mensajeErrorCamara(e) {
  const n = e?.name || "";
  let base;
  if (n === "NotAllowedError" || n === "SecurityError") base = "Permiso de cámara bloqueado. Toca el candado de la barra de direcciones ▸ Cámara ▸ Permitir, y reintenta.";
  else if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") base = "La cámara está ocupada por otra app. Cierra Discord/Teams/Zoom/Cámara de Windows y reintenta.";
  else if (n === "NotFoundError" || n === "DevicesNotFoundError") base = "No se detectó ninguna cámara conectada.";
  else if (n === "OverconstrainedError") base = "La cámara elegida no está disponible ahora. Prueba con otra de la lista.";
  else if (n === "TimeoutError") base = e?.message || "La cámara no respondió.";
  else base = e?.message || "No se pudo abrir la cámara.";
  try { console.warn("[cámara] getUserMedia falló →", n, "|", e?.message, e); } catch { /* noop */ }
  const tec = [n, e?.message].filter(Boolean).join(": ");
  return tec && tec !== base ? `${base}  ·  (${tec})` : base;
}

/** Abre la cámara y devuelve el MediaStream.
 *  - deviceId EXPLÍCITO (elegido en el selector): abre SOLO esa; si falla, RELANZA el
 *    error real (no cae a otra cámara ni memoriza una equivocada).
 *  - AUTOMÁTICO (sin deviceId): 1) la recordada, 2) pide permiso con la predeterminada
 *    y, ya con etiquetas, PREFIERE una webcam externa/USB (la integrada suele estar
 *    tapada), 3) la predeterminada, 4) recorre el resto. Solo lanza si ninguna abre. */
export async function abrirCamara(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("Este navegador no permite la cámara (usa Chrome sobre https)."), { name: "SecurityError" });
  }

  // Elección explícita del usuario: sin fallback silencioso.
  if (deviceId) return await pedirCamara({ deviceId: { exact: deviceId } });

  let ultimoError = null;
  const recordada = camaraGuardada();
  if (recordada) {
    try { return await pedirCamara({ deviceId: { exact: recordada } }); }
    catch (e) { ultimoError = e; } // recordada desconectada → sigue (sin borrarla)
  }

  // Pide permiso con la predeterminada (así enumerateDevices ya trae etiquetas).
  let porDefecto = null;
  try { porDefecto = await pedirCamara(true); }
  catch (e) { ultimoError = e; }

  // Con permiso concedido, prefiere una externa/USB distinta de la abierta.
  try {
    const cams = await listarCamaras();
    const abierta = deviceIdDeStream(porDefecto);
    const externa = cams.find((c) => c.deviceId && c.deviceId !== abierta && pareceExterna(c.label));
    if (externa) {
      try {
        const s = await pedirCamara({ deviceId: { exact: externa.deviceId } });
        if (porDefecto) porDefecto.getTracks().forEach((t) => t.stop());
        return s;
      } catch (e) { ultimoError = e; }
    }
  } catch { /* sin enumeración */ }

  if (porDefecto) return porDefecto;

  // La predeterminada falló: recorre el resto de cámaras.
  try {
    const cams = await listarCamaras();
    for (const c of cams) {
      if (!c.deviceId || c.deviceId === recordada) continue;
      try { return await pedirCamara({ deviceId: { exact: c.deviceId } }); }
      catch (e) { ultimoError = e; }
    }
  } catch { /* sin enumeración */ }

  throw ultimoError || Object.assign(new Error("No se pudo abrir ninguna cámara."), { name: "NotFoundError" });
}

// Opciones del detector: inputSize 320 = buen balance velocidad/precisión en webcam.
async function opts() {
  const f = await lib();
  return new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
}

/** Descriptor (Array de 128 números) del rostro más prominente en un
 *  <video>/<canvas>/<img>. Devuelve null si no detecta una cara nítida. */
export async function describirRostro(el) {
  if (!_ready) await cargarModelos();
  const f = await lib();
  const det = await f.detectSingleFace(el, await opts()).withFaceLandmarks().withFaceDescriptor();
  if (!det || !det.descriptor) return null;
  return Array.from(det.descriptor);
}

/** Distancia euclidiana entre dos descriptores (más chico = más parecido). */
export function distancia(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

// Umbral típico de face-api: <0.5 = misma persona; usado también en el backend.
export const UMBRAL_FACIAL = 0.5;

/** Captura N muestras del rostro desde un <video> (con pausas), para un registro
 *  más robusto. Llama onMuestra(i, total) por cada una lograda. Devuelve el array
 *  de descriptores conseguidos (puede ser menos de n si no siempre detecta). */
export async function capturarMuestras(videoEl, n = 3, onMuestra) {
  const out = [];
  for (let i = 0; i < n * 2 && out.length < n; i++) {
    const d = await describirRostro(videoEl);
    if (d) { out.push(d); onMuestra?.(out.length, n); }
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}
