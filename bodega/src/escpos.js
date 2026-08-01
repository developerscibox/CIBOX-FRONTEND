// Impresión TÉRMICA (ESC/POS) de la boleta vía puente local (tools/print-bridge.ps1),
// que la manda a la RPP02N (58mm) por COM4. El panel arma "ops" simples y el puente
// las traduce a bytes ESC/POS. Reutilizable desde print.js (con respaldo a navegador).

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const folio = (o) => String(o?._id || o?.codigo_escaneo || "").slice(-6).toUpperCase();

// Sin acentos: los térmicos por defecto no los imprimen bien (el puente además
// tiene su propio respaldo). Se translitera aquí para dejar el texto ASCII limpio.
const noAcc = (s) => String(s ?? "")
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
  .replace(/[ÁÀÄÂ]/g, "A").replace(/[ÉÈËÊ]/g, "E").replace(/[ÍÌÏÎ]/g, "I")
  .replace(/[ÓÒÖÔ]/g, "O").replace(/[ÚÙÜÛ]/g, "U").replace(/Ñ/g, "N");

const bridgeUrl = () => {
  try { return localStorage.getItem("b12_print_bridge") || "http://127.0.0.1:9110"; }
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

const cantTxt = (it) => (it.cajas != null ? `${it.cajas}cj (${it.quantity}u)` : `${it.quantity}u`);
const subTot = (it) => (it.subtotal != null ? it.subtotal : (it.price || 0) * (it.quantity || 0));

const cabecera = () => [
  { a: "align", v: "center" }, { a: "size", v: "dhw" }, { a: "text", v: "BODEGA 12" },
  { a: "size", v: "normal" },
];
const itemsOps = (order) => {
  const ops = [];
  for (const it of (order.items || [])) {
    ops.push({ a: "text", v: noAcc(it.name) });
    ops.push({ a: "row", l: "  " + cantTxt(it), r: clp(subTot(it)) });
  }
  return ops;
};
const pieQr = (order, nota) => {
  const codigo = order.codigo_escaneo || String(order._id || "");
  return [
    { a: "align", v: "center" }, { a: "feed", v: 1 },
    { a: "qr", v: codigo, size: 6 }, { a: "text", v: codigo },
    { a: "text", v: nota }, { a: "feed", v: 1 }, { a: "cut" },
  ];
};

// Boleta POR PAGAR (la que arma el vendedor / se presenta en caja).
export function opsBoleta(order) {
  const c = order.customer || {};
  return [
    ...cabecera(),
    { a: "text", v: "Boleta de venta - POR PAGAR" },
    { a: "align", v: "left" }, { a: "line" },
    { a: "row", l: "Folio", r: "#" + folio(order) },
    { a: "row", l: "Fecha", r: new Date(order.created_at || Date.now()).toLocaleString("es-CL") },
    ...(order.seller?.nombre ? [{ a: "row", l: "Vendedor", r: noAcc(order.seller.nombre) }] : []),
    { a: "row", l: "Cliente", r: noAcc(c.fullName || "Mostrador") },
    ...(c.rut ? [{ a: "row", l: "RUT", r: String(c.rut) }] : []),
    { a: "line" },
    ...itemsOps(order),
    { a: "line" },
    { a: "size", v: "dh" }, { a: "row", l: "TOTAL", r: clp(order.total) }, { a: "size", v: "normal" },
    ...pieQr(order, "Presenta esta boleta en caja"),
  ];
}

// Comprobante PAGADO (la cajera "timbra" al cobrar).
export function opsComprobante(order, { metodo = "", recibido = 0, vuelto = 0, cajera = "" } = {}) {
  const metodoTxt = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", cash_on_pickup: "Efectivo", card: "Tarjeta", transfer: "Transferencia" }[metodo] || metodo;
  const esEfectivo = metodo === "efectivo" || metodo === "cash_on_pickup";
  return [
    ...cabecera(),
    { a: "text", v: "Comprobante de pago" },
    { a: "size", v: "dh" }, { a: "text", v: "* PAGADO *" }, { a: "size", v: "normal" },
    { a: "align", v: "left" }, { a: "line" },
    { a: "row", l: "Folio", r: "#" + folio(order) },
    { a: "row", l: "Fecha", r: new Date().toLocaleString("es-CL") },
    ...(cajera ? [{ a: "row", l: "Cajera", r: noAcc(cajera) }] : []),
    { a: "row", l: "Cliente", r: noAcc(order.customer?.fullName || "Mostrador") },
    { a: "line" },
    ...itemsOps(order),
    { a: "line" },
    { a: "size", v: "dh" }, { a: "row", l: "TOTAL", r: clp(order.total) }, { a: "size", v: "normal" },
    { a: "row", l: "Metodo", r: noAcc(metodoTxt) },
    ...(esEfectivo ? [{ a: "row", l: "Recibido", r: clp(recibido) }, { a: "row", l: "Vuelto", r: clp(vuelto) }] : []),
    ...pieQr(order, "Gracias por tu compra"),
  ];
}

export const imprimirBoletaTermica = (order) => enviarTermica(opsBoleta(order));
export const imprimirComprobanteTermico = (order, pago) => enviarTermica(opsComprobante(order, pago));

// ── NÚMERO DE ATENCIÓN (kiosko /turno) ─────────────────────────────────────
// Ticket chico con el número grande. Imprime SOLO si el dispositivo del kiosko
// tiene el puente corriendo (auto-detección); si no, no hace nada.
const TIPO_TURNO = { compra: "Compra en tienda", retiro: "Retiro de pedido" };
export function opsTurno({ code, tipo, nombre } = {}) {
  const f = new Date();
  const fecha = `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()} ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
  return [
    { a: "align", v: "center" },
    { a: "size", v: "dhw" }, { a: "text", v: "BODEGA 12" }, { a: "size", v: "normal" },
    { a: "text", v: "Numero de atencion" },
    { a: "line" },
    { a: "feed", v: 1 },
    { a: "size", v: "dhw" }, { a: "text", v: String(code || "") }, { a: "size", v: "normal" },
    { a: "feed", v: 1 },
    { a: "text", v: noAcc(TIPO_TURNO[tipo] || tipo || "") },
    ...(nombre && nombre !== "Cliente" ? [{ a: "text", v: noAcc(nombre) }] : []),
    { a: "text", v: fecha },
    { a: "line" },
    { a: "text", v: "Espere su llamado en la pantalla" },
    { a: "feed", v: 1 }, { a: "cut" },
  ];
}
export async function imprimirTurnoTermico(turno) {
  if (!(await bridgeDisponible())) return false;
  return enviarTermica(opsTurno(turno));
}

// ── TICKET DE PICKING (al tomar un pedido) ──────────────────────────────────
// Ítems agrupados por SECTOR en orden de recorrido (qué buscar y dónde) +
// opcionalmente una etiqueta por zona (folio gigante) para pegar en cada bulto.
export function opsTicketPicking(order, grupos = [], { etiquetas = false, zonasListas = [] } = {}) {
  const ops = [
    { a: "align", v: "center" },
    { a: "size", v: "dh" }, { a: "text", v: `PICKING #${folio(order)}` }, { a: "size", v: "normal" },
    { a: "text", v: "Prepara en este orden de recorrido" },
    { a: "align", v: "left" }, { a: "line" },
    { a: "row", l: "Cliente", r: noAcc(order.customer?.fullName || "Mostrador") },
    { a: "row", l: "Hora", r: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) },
  ];
  for (const g of grupos) {
    ops.push({ a: "line" });
    ops.push({ a: "bold", v: 1 }, { a: "text", v: `>> ${noAcc(g.sector).toUpperCase()}` }, { a: "bold", v: 0 });
    if ((zonasListas || []).includes(g.sector)) ops.push({ a: "text", v: "(zona con monitor: retira en mesa)" });
    for (const it of (g.items || [])) {
      ops.push({ a: "text", v: noAcc(it.name) });
      ops.push({ a: "row", l: "", r: it.cajas != null ? `${it.cajas} cj (${it.quantity} u)` : `${it.quantity} u` });
    }
  }
  ops.push({ a: "line" }, { a: "align", v: "center" }, { a: "text", v: "Marca LISTO al terminar" }, { a: "feed", v: 1 }, { a: "cut" });
  if (etiquetas) {
    grupos.forEach((g, i) => {
      const cajas = (g.items || []).reduce((a, it) => a + (Number(it.cajas) || 0), 0);
      ops.push(
        { a: "align", v: "center" },
        { a: "text", v: "BODEGA 12 - ZONA" },
        { a: "size", v: "dh" }, { a: "text", v: noAcc(g.sector).toUpperCase() }, { a: "size", v: "normal" },
        { a: "size", v: "dhw" }, { a: "text", v: `#${folio(order)}` }, { a: "size", v: "normal" },
        { a: "text", v: `Zona ${i + 1} de ${grupos.length}${cajas ? ` · ${cajas} cajas` : ""}` },
        { a: "align", v: "left" }, { a: "line" },
      );
      for (const it of (g.items || [])) {
        ops.push({ a: "row", l: `[ ] ${noAcc(it.name).slice(0, 22)}`, r: it.cajas != null ? `${it.cajas}cj` : `${it.quantity}u` });
      }
      ops.push({ a: "feed", v: 1 }, { a: "cut" });
    });
  }
  return ops;
}
export async function imprimirTicketPickingTermico(order, grupos, opts) {
  return enviarTermica(opsTicketPicking(order, grupos, opts));
}

// ── ETIQUETA DE DESPACHO (al FINALIZAR el picking, con nº de bultos) ─────────
// Una etiqueta POR BULTO ("BULTO i / N" + folio gigante) para pegar en cada uno;
// sin número, una sola de resumen. Mismo contenido que la versión de navegador
// (anti-disputa: al retiro se cuentan los bultos etiquetados).
export function opsEtiquetaDespacho(order, { bultos = null, peso = null } = {}) {
  // Tope de seguridad: un dedazo (ej. "300") no debe disparar 300 etiquetas.
  const nb = bultos != null && Number(bultos) >= 1 ? Math.min(50, Math.round(Number(bultos))) : null;
  const fecha = new Date().toLocaleString("es-CL");
  const cliente = noAcc(order.customer?.fullName || "Mostrador");
  const ops = [];
  const n = nb || 1;
  for (let i = 0; i < n; i++) {
    ops.push(
      { a: "align", v: "center" },
      { a: "text", v: "BODEGA 12 - DESPACHO" },
      { a: "size", v: "dhw" }, { a: "text", v: `#${folio(order)}` }, { a: "size", v: "normal" },
      { a: "size", v: "dh" }, { a: "text", v: nb ? `BULTO ${i + 1} / ${nb}` : "BULTOS: -" }, { a: "size", v: "normal" },
      { a: "align", v: "left" }, { a: "line" },
      { a: "row", l: "Cliente", r: cliente },
      { a: "row", l: "Fecha", r: fecha },
      ...(peso != null && i === 0 ? [{ a: "row", l: "Peso total", r: `${peso} kg` }] : []),
      { a: "align", v: "center" },
      { a: "text", v: nb ? `Cuenta los ${nb} bultos al retirar` : "Cuenta los bultos al retirar" },
      { a: "feed", v: 1 }, { a: "cut" },
    );
  }
  return ops;
}
export const imprimirEtiquetaDespachoTermica = (order, opts) => enviarTermica(opsEtiquetaDespacho(order, opts));

// Ticket de prueba (para verificar el puente/impresora desde el panel).
export const imprimirPruebaTermica = () => enviarTermica([
  { a: "align", v: "center" }, { a: "size", v: "dhw" }, { a: "text", v: "BODEGA 12" },
  { a: "size", v: "normal" }, { a: "text", v: "Prueba de impresion termica" },
  { a: "align", v: "left" }, { a: "line" },
  { a: "row", l: "Fecha", r: new Date().toLocaleString("es-CL") },
  { a: "row", l: "Estado", r: "OK" },
  { a: "feed", v: 1 }, { a: "cut" },
]);
