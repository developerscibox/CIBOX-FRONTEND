import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Escáner de código de barras por cámara, reutilizable (Recepción y Productos).
// Motor primario: BarcodeDetector NATIVO (Chrome/Edge/Android, también notebooks)
// — rápido y fiable. Si el navegador no lo soporta (ej. iOS Safari), cae a
// html5-qrcode. Cámara con facingMode FLEXIBLE ({ideal:"environment"}) para que
// los notebooks (sin cámara trasera) también funcionen. Tecleo manual siempre.
const REGION_ID = "cibox-barcode-reader";
const PROD_URL = "bodega-nine.vercel.app";

const H5_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
];
// Formatos para el BarcodeDetector (nombres del estándar Shape Detection API).
const BD_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

function detectInApp() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|Snapchat|TikTok|Twitter|; wv\)/i.test(ua);
}

function classify(e) {
  const name = (e && e.name) || (typeof e === "string" ? e : "") || "Error";
  const msg = String((e && e.message) || e || "");
  const s = name + " " + msg;
  if (/NotAllowed|Permission/i.test(s)) return { kind: "denied" };
  if (/NotFound|DevicesNotFound|no camera|Requested device/i.test(s)) return { kind: "nocam" };
  if (/NotReadable|TrackStart|Could not start video|in use/i.test(s)) return { kind: "busy" };
  if (/Overconstrained|Constraint/i.test(s)) return { kind: "constraint" };
  if (/secure|https/i.test(s)) return { kind: "insecure" };
  return { kind: "other" };
}

export default function BarcodeScanner({ onDetected, onClose, title = "Escanear código" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const loopRef = useRef(null);
  const h5Ref = useRef(null);
  const usingH5Ref = useRef(false);
  const runningRef = useRef(false);
  const lastRef = useRef({ code: null, t: 0 });
  const inAppRef = useRef(detectInApp());
  const [phase, setPhase] = useState("starting"); // starting | scanning | error
  const [mode, setMode] = useState(null); // bd | h5
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState("");

  const emit = useCallback((decodedText) => {
    const code = String(decodedText || "").trim();
    if (!code) return;
    const now = Date.now();
    const last = lastRef.current;
    if (last.code === code && now - last.t < 1500) return; // anti-rebote
    lastRef.current = { code, t: now };
    try { navigator.vibrate?.(120); } catch { /* sin vibración */ }
    onDetected(code);
  }, [onDetected]);

  const stopAll = useCallback(() => {
    runningRef.current = false;
    if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* ya detenido */ }
      streamRef.current = null;
    }
    if (videoRef.current) { try { videoRef.current.srcObject = null; } catch { /* noop */ } }
    if (h5Ref.current && usingH5Ref.current) {
      h5Ref.current.stop().then(() => h5Ref.current.clear()).catch(() => {});
    }
    usingH5Ref.current = false;
  }, []);

  // Fallback: html5-qrcode (cuando no hay BarcodeDetector, ej. iOS Safari / Chrome
  // Windows). OJO: html5-qrcode NO acepta facingMode {ideal:…} (lanza "facingMode
  // should be string or object with exact as key"). Se usa el STRING "environment",
  // que getUserMedia trata como preferencia BLANDA: en notebooks sin cámara trasera
  // cae a la frontal. Si hay error de cámara, se reintenta eligiendo una cámara real.
  const startH5 = useCallback(async () => {
    if (!h5Ref.current) {
      h5Ref.current = new Html5Qrcode(REGION_ID, { formatsToSupport: H5_FORMATS, verbose: false });
    }
    usingH5Ref.current = true;
    const cfg = { fps: 10, qrbox: (vw, vh) => ({ width: Math.min(300, vw - 32), height: Math.min(180, Math.floor(vh / 2)) }) };
    const onFrame = () => { /* fallo de decodificación por frame: ignorar */ };
    try {
      await h5Ref.current.start({ facingMode: "environment" }, cfg, emit, onFrame);
    } catch (e1) {
      // Reintento: elegir una cámara concreta (la trasera si existe, si no cualquiera).
      const cams = await Html5Qrcode.getCameras().catch(() => []);
      if (cams && cams.length) {
        const back = cams.find((c) => /back|rear|environment|trasera/i.test(c.label || ""));
        const pick = back || cams[cams.length - 1];
        await h5Ref.current.start(pick.id, cfg, emit, onFrame);
      } else {
        throw e1;
      }
    }
    runningRef.current = true;
    setPhase("scanning");
  }, [emit]);

  const start = useCallback(async () => {
    setErr(null);
    setPhase("starting");
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setErr({ kind: "insecure", detail: "isSecureContext=false" });
      setPhase("error");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr({ kind: inAppRef.current ? "inapp" : "unsupported", detail: "sin mediaDevices.getUserMedia" });
      setPhase("error");
      return;
    }

    const hasBD = typeof window !== "undefined" && "BarcodeDetector" in window;
    const chosen = hasBD ? "bd" : "h5";
    setMode(chosen);
    // Espera el re-render para que el <video>/región esté visible antes de arrancar.
    await new Promise((r) => setTimeout(r, 0));

    try {
      if (chosen === "bd") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        const v = videoRef.current;
        v.setAttribute("playsinline", "true");
        v.muted = true;
        v.srcObject = stream;
        await v.play();

        let formats = BD_FORMATS;
        try {
          const sup = await window.BarcodeDetector.getSupportedFormats();
          const inter = BD_FORMATS.filter((f) => sup.includes(f));
          formats = inter.length ? inter : sup;
        } catch { /* usa BD_FORMATS */ }
        detectorRef.current = new window.BarcodeDetector(formats.length ? { formats } : undefined);

        runningRef.current = true;
        setPhase("scanning");
        const loop = async () => {
          if (!runningRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes && codes.length && codes[0].rawValue) emit(codes[0].rawValue);
          } catch { /* frame sin código */ }
          if (runningRef.current) loopRef.current = setTimeout(loop, 130);
        };
        loop();
      } else {
        await startH5();
      }
    } catch (e) {
      const c = classify(e);
      const kind = c.kind === "denied" && inAppRef.current ? "inapp" : c.kind;
      // Si falló el detector nativo por algo que no sea permiso, intenta html5-qrcode.
      if (chosen === "bd" && kind !== "denied" && kind !== "inapp" && !usingH5Ref.current) {
        try {
          stopAll();
          setMode("h5");
          await new Promise((r) => setTimeout(r, 0));
          await startH5();
          return;
        } catch { /* cae al error abajo */ }
      }
      setErr({ kind, detail: (e && e.name) || String(e) });
      setPhase("error");
    }
  }, [emit, startH5, stopAll]);

  useEffect(() => {
    start();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual(e) {
    e?.preventDefault?.();
    const code = manual.trim();
    setManual("");
    if (code) emit(code);
  }

  const guide = errGuide(err, inAppRef.current);
  const showVideo = mode === "bd" && phase !== "error";
  const showRegion = mode === "h5" && phase !== "error";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 460, padding: 16, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>Cerrar</button>
        </div>

        {inAppRef.current ? (
          <div className="ok-msg" style={{ marginBottom: 10, background: "#fef9c3", borderColor: "#fde047", color: "#854d0e" }}>
            Estás dentro del navegador de otra app. Para usar la cámara, abre <b>{PROD_URL}</b> en <b>Chrome</b> o <b>Safari</b>.
          </div>
        ) : null}

        {/* Vídeo del detector nativo (BarcodeDetector). */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", maxHeight: 320, borderRadius: 10, background: "#000", objectFit: "cover", display: showVideo ? "block" : "none" }}
        />
        {/* Región para html5-qrcode (fallback). */}
        <div id={REGION_ID} style={{ width: "100%", minHeight: showRegion ? 240 : 0, background: "#000", borderRadius: 10, overflow: "hidden", display: showRegion ? "block" : "none" }} />

        {phase === "starting" ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>Iniciando cámara…</div>
        ) : null}

        {phase === "scanning" ? (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>Apunta al código de barras. Se agrega solo al detectarlo.</div>
        ) : null}

        {phase === "error" ? (
          <div className="ok-msg" style={{ marginTop: 4, marginBottom: 10, background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{guide.title}</div>
            <div style={{ fontWeight: 400, fontSize: 13 }}>{guide.body}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn btn-primary" style={{ padding: "7px 14px", fontSize: 13 }} onClick={start}>Reintentar</button>
              {err?.detail ? <span style={{ fontSize: 11, color: "#9ca3af" }}>detalle: {err.detail}</span> : null}
            </div>
          </div>
        ) : null}

        {/* Respaldo SIEMPRE disponible: teclear / pegar el código a mano. */}
        <form onSubmit={submitManual} style={{ marginTop: 4, display: "flex", gap: 8 }}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="…o escribe el código a mano"
            inputMode="numeric"
            style={{ flex: 1, border: "1.5px solid var(--border)", borderRadius: 9, padding: "9px 10px", fontSize: 14 }}
          />
          <button type="submit" className="btn btn-ghost" style={{ whiteSpace: "nowrap" }}>Usar código</button>
        </form>
      </div>
    </div>
  );
}

function errGuide(err, inApp) {
  const kind = err?.kind;
  if (kind === "inapp" || (kind === "unsupported" && inApp)) {
    return { title: "Ábrelo en Chrome o Safari", body: `El navegador de la app que estás usando bloquea la cámara. Copia ${PROD_URL} y ábrelo en Chrome o Safari, o usa “⋯ → Abrir en el navegador”.` };
  }
  if (kind === "denied") {
    return { title: "Permiso de cámara denegado", body: "Toca el candado o la “Aa” junto a la dirección → Cámara → Permitir, y recarga la página. En iPhone: Ajustes → Safari → Cámara → Permitir." };
  }
  if (kind === "busy") {
    return { title: "La cámara está ocupada", body: "Otra app está usando la cámara. Ciérrala (o la app de cámara) y toca Reintentar." };
  }
  if (kind === "nocam") {
    return { title: "Sin cámara disponible", body: "Este dispositivo no tiene cámara accesible. Usa el celular, o escribe el código a mano aquí abajo." };
  }
  if (kind === "insecure") {
    return { title: "La cámara necesita HTTPS", body: `Entra por https://${PROD_URL} (no por una IP ni http). Ahí la cámara funciona.` };
  }
  if (kind === "constraint") {
    return { title: "No se pudo abrir la cámara", body: "Toca Reintentar. Si sigue, escribe el código a mano aquí abajo." };
  }
  if (kind === "unsupported") {
    return { title: "Navegador sin soporte de cámara", body: "Abre la página en Chrome o Safari actualizados, o escribe el código a mano." };
  }
  return { title: "No se pudo iniciar la cámara", body: "Toca Reintentar. Si persiste, escribe el código a mano aquí abajo." };
}
