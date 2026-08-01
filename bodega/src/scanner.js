import { useEffect, useRef } from "react";

// Detector de PISTOLA / lector USB (tipo "keyboard-wedge"). El lector no necesita
// driver: "teclea" el código muy rápido y lo cierra con Enter. Lo distinguimos del
// tecleo humano por la velocidad entre teclas (un humano tarda >~60ms; el lector,
// milisegundos). Al detectar un disparo completo llama onScan(code).
//
// Por defecto IGNORA los eventos cuando el foco está en un campo de texto
// (input/textarea/select/contenteditable) para NO pisar los campos que ya capturan
// el código a mano (buscador de Venta en sala, boleta de Caja, etc.). Pásale
// captureInInputs:true en pantallas cuyo único propósito es escanear.
export function useBarcodeWedge(onScan, opts = {}) {
  const { enabled = true, minLength = 3, maxGapMs = 60, captureInInputs = false } = opts;
  const buf = useRef("");
  const lastT = useRef(0);
  const cb = useRef(onScan);
  useEffect(() => { cb.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!enabled) return undefined;
    const enCampo = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;           // atajos, no lector
      if (!captureInInputs && enCampo()) return;                // deja escribir a mano
      const now = Date.now();
      if (now - lastT.current > maxGapMs) buf.current = "";     // pausa larga → reinicia (tecleo humano)
      lastT.current = now;
      if (e.key === "Enter") {
        const code = buf.current.trim();
        buf.current = "";
        if (code.length >= minLength) { e.preventDefault(); cb.current(code); }
        return;
      }
      if (e.key.length === 1) buf.current += e.key;             // acumula caracteres imprimibles
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, minLength, maxGapMs, captureInInputs]);
}

// Precio unitario y de caja a partir de los tiers del producto (min_qty 1 = unidad;
// el mayor min_qty = la caja). Devuelve { unidad, caja, cajaQty } en CLP.
export function preciosDe(p) {
  const tiers = (p?.pricing?.tiers || []).slice().sort((a, b) => (a.min_qty || 1) - (b.min_qty || 1));
  const unidad = tiers.find((t) => (t.min_qty || 1) === 1) || tiers[0] || null;
  const caja = tiers.filter((t) => (t.min_qty || 1) > 1).sort((a, b) => (b.min_qty || 0) - (a.min_qty || 0))[0] || null;
  return {
    unidad: unidad ? Number(unidad.price || 0) : 0,
    caja: caja ? Number(caja.price || 0) : 0,
    cajaQty: caja ? (caja.min_qty || 0) : 0,
  };
}
