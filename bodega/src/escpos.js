// Impresión TÉRMICA (ESC/POS) de la etiqueta de despacho vía puente local
// (tools/print-bridge.ps1), que la manda a la impresora de 58mm por puerto serie.
// El panel arma "ops" simples y el puente las traduce a bytes ESC/POS.
// Reutilizable desde print.js (con respaldo a impresión por navegador).

const folio = (o) => String(o?._id || "").slice(-6).toUpperCase();

// Sin acentos: los térmicos por defecto no los imprimen bien (el puente además
// tiene su propio respaldo). Se translitera aquí para dejar el texto ASCII limpio.
const noAcc = (s) => String(s ?? "")
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
  .replace(/[ÁÀÄÂ]/g, "A").replace(/[ÉÈËÊ]/g, "E").replace(/[ÍÌÏÎ]/g, "I")
  .replace(/[ÓÒÖÔ]/g, "O").replace(/[ÚÙÜÛ]/g, "U").replace(/Ñ/g, "N");

const bridgeUrl = () => {
  try { return localStorage.getItem("cibox_print_bridge") || "http://127.0.0.1:9110"; }
  catch { return "http://127.0.0.1:9110"; }
};

// ¿Está corriendo el puente? (para no bloquear si no está).
export async function puenteVivo() {
  try {
    const ctl = AbortSignal.timeout ? AbortSignal.timeout(1200) : undefined;
    const r = await fetch(bridgeUrl() + "/ping", { method: "GET", signal: ctl });
    return r.ok;
  } catch { return false; }
}

// Igual que puenteVivo pero con caché de 60s: permite "auto-impresión" barata —
// el dispositivo que tenga el puente corriendo imprime solo, sin configurar nada.
let _bridge = { t: 0, ok: false };
export async function bridgeDisponible() {
  const now = Date.now();
  if (now - _bridge.t < 60000) return _bridge.ok;
  const ok = await puenteVivo();
  _bridge = { t: now, ok };
  return ok;
}

// Envía las ops al puente. Devuelve true si imprimió.
export async function enviarTermica(ops) {
  try {
    const r = await fetch(bridgeUrl() + "/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
    });
    return r.ok;
  } catch { return false; }
}

// Etiqueta de despacho: una POR BULTO con folio gigante (tope 50). Sin número de
// bultos, una sola de resumen. Mismo contenido que la versión de navegador
// (anti-disputa: al entregar se cuentan los bultos etiquetados).
export function opsEtiquetaDespacho(order, { bultos = null, peso = null } = {}) {
  // Tope de seguridad: un dedazo (ej. "300") no debe disparar 300 etiquetas.
  const nb = bultos != null && Number(bultos) >= 1 ? Math.min(50, Math.round(Number(bultos))) : null;
  const fecha = new Date().toLocaleString("es-CL");
  const cliente = noAcc(order.customer?.fullName || "Cliente");
  const ops = [];
  const n = nb || 1;
  for (let i = 0; i < n; i++) {
    ops.push(
      { a: "align", v: "center" },
      { a: "text", v: "CIBOX - DESPACHO" },
      { a: "size", v: "dhw" }, { a: "text", v: `#${folio(order)}` }, { a: "size", v: "normal" },
      { a: "size", v: "dh" }, { a: "text", v: nb ? `BULTO ${i + 1} / ${nb}` : "BULTOS: -" }, { a: "size", v: "normal" },
      { a: "align", v: "left" }, { a: "line" },
      { a: "row", l: "Cliente", r: cliente },
      { a: "row", l: "Fecha", r: fecha },
      ...(peso != null && i === 0 ? [{ a: "row", l: "Peso total", r: `${peso} kg` }] : []),
      { a: "align", v: "center" },
      { a: "text", v: nb ? `Cuenta los ${nb} bultos al entregar` : "Cuenta los bultos al entregar" },
      { a: "feed", v: 1 }, { a: "cut" },
    );
  }
  return ops;
}
export const imprimirEtiquetaDespachoTermica = (order, opts) => enviarTermica(opsEtiquetaDespacho(order, opts));

// Ticket de prueba (para verificar el puente/impresora desde el panel).
export const imprimirPruebaTermica = () => enviarTermica([
  { a: "align", v: "center" }, { a: "size", v: "dhw" }, { a: "text", v: "CIBOX" },
  { a: "size", v: "normal" }, { a: "text", v: "Prueba de impresion termica" },
  { a: "align", v: "left" }, { a: "line" },
  { a: "row", l: "Fecha", r: new Date().toLocaleString("es-CL") },
  { a: "row", l: "Estado", r: "OK" },
  { a: "feed", v: 1 }, { a: "cut" },
]);
