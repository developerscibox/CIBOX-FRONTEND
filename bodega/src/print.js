import QRCode from "qrcode";
import { imprimirBoletaTermica, imprimirComprobanteTermico, imprimirTicketPickingTermico, imprimirEtiquetaDespachoTermica, bridgeDisponible } from "./escpos.js";

// Impresión por NAVEGADOR (decisión D3): boleta (vendedor) y ticket de picking
// (bodeguero), ambos agrupados por SECTOR físico en orden de recorrido. Abstraído
// aquí para poder enchufar impresión térmica ESC/POS más adelante sin tocar las pantallas.

// Modo TÉRMICO: si la caja lo activó (localStorage b12_print_termica="1"), la boleta
// y el comprobante se mandan a la RPP02N por el puente local (escpos.js). Si el puente
// no responde, se cae solo a la impresión por navegador. Se activa por estación.
const termicaOn = () => { try { return localStorage.getItem("b12_print_termica") === "1"; } catch { return false; } };

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const folio = (o) => String(o?._id || o?.codigo_escaneo || "").slice(-6).toUpperCase();
const SIN = "Sin sector";

// Escape HTML: los nombres (cliente del turno público, producto, vendedor…) llegan
// sin sanitizar y se interpolan en HTML que se ejecuta same-origin (iframe/popup).
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Agrupa ítems por sector y ordena por recorrido (mismo criterio que el backend).
export function agruparItemsPorSector(items = [], sectoresOrden = {}) {
  const map = new Map();
  for (const it of items) {
    const s = (it.sector && String(it.sector).trim()) || SIN;
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(it);
  }
  const ord = (s) => (s === SIN ? Infinity : sectoresOrden[s] ?? Infinity);
  return [...map.entries()]
    .map(([sector, its]) => ({ sector, items: its }))
    .sort((a, b) => ord(a.sector) - ord(b.sector) || a.sector.localeCompare(b.sector, "es"));
}

// Cantidad: la CAJA es la categoría principal; las unidades van entre paréntesis
// como segundo nivel (evita confundir cajas con unidades). Cae a unidades si no hay cajas.
const cantidadTxt = (it) =>
  it.cajas != null
    ? `<b>${it.cajas} ${it.cajas === 1 ? "caja" : "cajas"}</b> <span class="su">(${it.quantity} u)</span>`
    : `<b>${it.quantity} u</b>`;

const filasItems = (items, { precios = true } = {}) =>
  items
    .map(
      (it) => `<tr>
        <td class="n">${esc(it.name)}<div class="u">${cantidadTxt(it)}</div></td>
        ${precios ? `<td class="p">${clp((it.subtotal != null ? it.subtotal : (it.price || 0) * (it.quantity || 0)))}</td>` : ""}
      </tr>`,
    )
    .join("");

// opts.zonasListas (solo ticket de picking): sectores ya preparados por el dueño
// del área con monitor → nota "retira en mesa" bajo el encabezado del sector.
const grupoHtml = (grupos, opts = {}) =>
  grupos
    .map(
      (g) => `<div class="sector">${esc(g.sector)}</div>
      ${(opts.zonasListas || []).includes(g.sector) ? `<div class="zona-nota">(zona con monitor: retira en mesa)</div>` : ""}
      <table class="items">${filasItems(g.items, opts)}</table>`,
    )
    .join("");

const abrirImprimir = (html) => {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    alert("Habilita las ventanas emergentes para imprimir la boleta.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  // Espera a que cargue el QR antes de abrir el diálogo de impresión.
  setTimeout(() => w.print(), 350);
};

const baseCss = `
  * { box-sizing: border-box; } body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; width: 300px; color: #000; }
  h1 { font-size: 16px; margin: 0; text-align: center; } .sub { text-align: center; font-size: 11px; margin: 2px 0 8px; }
  .meta { font-size: 11px; margin: 6px 0; } .meta div { display: flex; justify-content: space-between; }
  .sector { font-weight: bold; font-size: 12px; margin: 8px 0 2px; border-bottom: 1px dashed #000; text-transform: uppercase; }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; } table.items td { padding: 3px 0; vertical-align: top; border-bottom: 1px dotted #bbb; }
  td.n { font-weight: bold; } td.n .u { font-weight: normal; font-size: 12px; margin-top: 1px; } td.n .u .su { color: #444; }
  td.p { text-align: right; white-space: nowrap; padding-left: 6px; font-weight: bold; }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #000; margin-top: 8px; padding-top: 6px; }
  .zona-nota { font-size: 10px; font-style: italic; margin: 1px 0 2px; }
  .pbb { page-break-before: always; }
  .zbig { font-size: 26px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 6px 0 0; }
  .fbig { font-size: 38px; font-weight: bold; text-align: center; border: 3px solid #000; border-radius: 10px; padding: 6px 4px; margin: 6px 0; letter-spacing: 2px; }
  .znum { text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
  .qr { text-align: center; margin-top: 10px; } .qr img { width: 130px; height: 130px; } .qr .code { font-size: 11px; letter-spacing: 1px; }
  .foot { text-align: center; font-size: 10px; margin-top: 8px; }
  @media print { @page { margin: 4mm; } }
`;

/** Construye el HTML de la boleta (sin imprimir). Lleva el QR del codigo_escaneo. */
export async function buildBoletaHtml(order, sectoresOrden = {}) {
  const grupos = agruparItemsPorSector(order.items || [], sectoresOrden);
  const codigo = order.codigo_escaneo || String(order._id || "");
  const c = order.customer || {};
  let qr = "";
  try { qr = await QRCode.toDataURL(codigo, { margin: 1, width: 260 }); } catch { /* sin QR */ }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Boleta ${esc(folio(order))}</title>
    <style>${baseCss}</style></head><body>
    <h1>BODEGA 12</h1>
    <div class="sub">Boleta de venta · POR PAGAR</div>
    <div class="meta">
      <div><span>Folio</span><b>#${esc(folio(order))}</b></div>
      <div><span>Fecha</span><span>${new Date(order.created_at || Date.now()).toLocaleString("es-CL")}</span></div>
      ${order.turno_numero ? `<div><span>Turno</span><b>${esc(order.turno_numero)}</b></div>` : ""}
      ${order.seller?.nombre ? `<div><span>Vendedor</span><span>${esc(order.seller.nombre)}</span></div>` : ""}
      <div><span>Cliente</span><span>${esc(c.fullName || "Mostrador")}</span></div>
      ${c.rut ? `<div><span>RUT</span><span>${esc(c.rut)}</span></div>` : ""}
    </div>
    ${grupoHtml(grupos, { precios: true })}
    <div class="total"><span>TOTAL</span><span>${clp(order.total)}</span></div>
    <div class="qr">
      ${qr ? `<img src="${qr}" alt="código"/>` : ""}
      <div class="code">${esc(codigo)}</div>
    </div>
    <div class="foot">Presenta esta boleta en caja para pagar.</div>
    </body></html>`;
}

/** Imprime un HTML en un iframe oculto (sin popup). Ideal para el computador central. */
export function imprimirEnIframe(html) {
  const ifr = document.createElement("iframe");
  ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(ifr);
  const doc = ifr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch { /* noop */ }
    setTimeout(() => ifr.remove(), 1500);
  }, 400);
}

/** Boleta del vendedor (popup) — uso manual/respaldo. La estación central usa iframe. */
export async function imprimirBoleta(order, sectoresOrden = {}) {
  if (termicaOn() && await imprimirBoletaTermica(order)) return; // térmica RPP02N
  abrirImprimir(await buildBoletaHtml(order, sectoresOrden));
}

/** Ticket de picking del bodeguero (al aceptar). Agrupado por sector, SIN precios.
 *  zonasListas: sectores ya marcados "zona lista" (zone_done) al momento de imprimir.
 *  etiquetas=true: en el MISMO trabajo de impresión saca, tras el ticket, una etiqueta
 *  por zona (folio gigante) para pegar en cada bulto — un solo diálogo, todo en mano
 *  del picker. Cubre pedidos de sala Y web (ambos pasan por aquí al tomarse). */
export async function imprimirTicketPicking(order, sectoresOrden = {}, { zonasListas = [], etiquetas = false } = {}) {
  const grupos = agruparItemsPorSector(order.items || [], sectoresOrden);
  // Térmica primero: si esta estación tiene el puente corriendo (o el modo
  // térmico activado), el ticket + etiquetas salen solos por la RPP02N.
  if (termicaOn() || await bridgeDisponible()) {
    if (await imprimirTicketPickingTermico(order, grupos, { etiquetas, zonasListas })) return;
  }
  const paginasEtq = etiquetas ? paginasEtiquetasZona(order, sectoresOrden) : [];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Picking ${esc(folio(order))}</title>
    <style>${baseCss}</style></head><body>
    <h1>PICKING · #${esc(folio(order))}</h1>
    <div class="sub">Prepara en este orden de recorrido</div>
    <div class="meta">
      <div><span>Cliente</span><span>${esc(order.customer?.fullName || "Mostrador")}</span></div>
      <div><span>Hora</span><span>${new Date().toLocaleString("es-CL")}</span></div>
    </div>
    ${grupoHtml(grupos, { precios: false, zonasListas: (zonasListas || []).map(String) })}
    <div class="foot">Marca LISTO al terminar.</div>
    ${paginasEtq.map((p) => `<div class="pbb">${p}</div>`).join("")}
    </body></html>`;
  imprimirEnIframe(html); // sin popup (las tablets/celulares de bodega los bloquean)
}

/** Páginas de ETIQUETA DE ZONA (una por sector del pedido): folio + sector gigantes
 *  + checklist de ítems. Se pega en el bulto que el dueño de área deja preparado,
 *  para que el recolector identifique cada bulto por folio (match físico bulto↔pedido). */
const paginasEtiquetasZona = (order, sectoresOrden = {}) => {
  const grupos = agruparItemsPorSector(order.items || [], sectoresOrden);
  return grupos.map((g, i) => {
    const cajas = g.items.reduce((a, it) => a + (Number(it.cajas) || 0), 0);
    const filas = g.items
      .map((it) => `<tr><td class="n">☐ ${esc(it.name)}<div class="u">${cantidadTxt(it)}</div></td></tr>`)
      .join("");
    return `<h1>BODEGA 12 · ZONA</h1>
      <div class="zbig">${esc(g.sector)}</div>
      <div class="fbig">#${esc(folio(order))}</div>
      <div class="znum">Zona ${i + 1} de ${grupos.length}${cajas ? ` · ${cajas} ${cajas === 1 ? "caja" : "cajas"}` : ""}</div>
      <div class="meta">
        <div><span>Cliente</span><span>${esc(order.customer?.fullName || "Mostrador")}</span></div>
        <div><span>Impresa</span><span>${new Date().toLocaleString("es-CL")}</span></div>
      </div>
      <table class="items">${filas}</table>
      <div class="foot">Pega esta etiqueta en el bulto de ${esc(g.sector)} · el recolector lo retira por folio.</div>`;
  });
};

/** Imprime SOLO el juego de etiquetas de zona — reimpresión desde Picking cuando se
 *  pierde el juego que salió con el comprobante en la caja. */
export function imprimirEtiquetasZona(order, sectoresOrden = {}) {
  const pages = paginasEtiquetasZona(order, sectoresOrden);
  if (!pages.length) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${esc(folio(order))}</title>
    <style>${baseCss}</style></head><body>
    ${pages.map((p, i) => (i > 0 ? `<div class="pbb">${p}</div>` : `<div>${p}</div>`)).join("")}
    </body></html>`;
  imprimirEnIframe(html);
}

/** Comprobante de pago — la cajera "timbra" la boleta al cobrar: PAGADO + método + vuelto.
 *  (Las etiquetas de zona NO salen aquí: se imprimen cuando el picker toma el pedido,
 *  así quedan en su mano y también cubren los pedidos web que no pasan por caja.) */
export async function imprimirComprobantePago(order, pago = {}, sectoresOrden = {}) {
  const { metodo = "", recibido = 0, vuelto = 0, cajera = "" } = pago;
  if (termicaOn() && await imprimirComprobanteTermico(order, pago)) return; // térmica RPP02N
  const grupos = agruparItemsPorSector(order.items || [], sectoresOrden);
  const metodoTxt = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", cash_on_pickup: "Efectivo", card: "Tarjeta", transfer: "Transferencia" }[metodo] || metodo;
  const esEfectivo = metodo === "efectivo" || metodo === "cash_on_pickup";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pagado ${esc(folio(order))}</title>
    <style>${baseCss} .pagado{text-align:center;font-size:20px;font-weight:bold;border:2px solid #0a7d33;color:#0a7d33;border-radius:8px;padding:5px;margin:6px 0;letter-spacing:2px;}</style></head><body>
    <h1>BODEGA 12</h1>
    <div class="sub">Comprobante de pago</div>
    <div class="pagado">✓ PAGADO</div>
    <div class="meta">
      <div><span>Folio</span><b>#${esc(folio(order))}</b></div>
      <div><span>Fecha</span><span>${new Date().toLocaleString("es-CL")}</span></div>
      ${cajera ? `<div><span>Cajera</span><span>${esc(cajera)}</span></div>` : ""}
      <div><span>Cliente</span><span>${esc(order.customer?.fullName || "Mostrador")}</span></div>
    </div>
    ${grupoHtml(grupos, { precios: true })}
    <div class="total"><span>TOTAL</span><span>${clp(order.total)}</span></div>
    <div class="meta" style="margin-top:6px;">
      <div><span>Método</span><b>${esc(metodoTxt)}</b></div>
      ${esEfectivo ? `<div><span>Recibido</span><span>${clp(recibido)}</span></div><div><span>Vuelto</span><b>${clp(vuelto)}</b></div>` : ""}
    </div>
    <div class="foot">Pasa a preparación · gracias por tu compra.</div>
    </body></html>`;
  imprimirEnIframe(html);
}

/** Etiquetas de despacho (cierre de empaque). Con nº de bultos imprime UNA etiqueta
 *  POR BULTO ("BULTO i / N") para pegar en cada uno; sin número, una sola de resumen.
 *  Anti-disputa en mostrador: al retiro se cuentan bultos etiquetados.
 *  TÉRMICA primero (igual que el ticket de picking): si esta estación tiene el puente
 *  corriendo o el modo térmico activado, las etiquetas salen solas por la RPP02N al
 *  FINALIZAR en el tótem; si no, respaldo por navegador. Nunca lanza (fire-and-forget). */
export async function imprimirEtiquetaDespacho(order, { bultos = null, peso = null } = {}) {
  try {
    if (termicaOn() || await bridgeDisponible()) {
      if (await imprimirEtiquetaDespachoTermica(order, { bultos, peso })) return;
    }
  } catch { /* puente caído → navegador */ }
  // Tope de seguridad: un dedazo (ej. "300") no debe disparar 300 páginas.
  const nb = bultos != null && Number(bultos) >= 1 ? Math.min(50, Math.round(Number(bultos))) : null;
  const cab = `<h1>BODEGA 12 · DESPACHO</h1>
    <div class="meta">
      <div><span>Folio</span><b>#${esc(folio(order))}</b></div>
      <div><span>Cliente</span><span>${esc(order.customer?.fullName || "Mostrador")}</span></div>
      <div><span>Fecha</span><span>${new Date().toLocaleString("es-CL")}</span></div>
    </div>`;
  const pages = nb
    ? Array.from({ length: nb }, (_, i) => `${cab}
        <div class="big">BULTO ${i + 1} / ${nb}</div>
        ${i === 0 && peso != null ? `<div class="meta"><div><span>Peso total</span><b>${esc(peso)} kg</b></div></div>` : ""}
        <div class="foot">Cuenta los ${nb} bultos al retirar.</div>`)
    : [`${cab}
        <div class="sub">Bultos</div>
        <div class="big">—</div>
        ${peso != null ? `<div class="meta"><div><span>Peso</span><b>${esc(peso)} kg</b></div></div>` : ""}
        <div class="foot">Cuenta los bultos al retirar.</div>`];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Despacho ${esc(folio(order))}</title>
    <style>${baseCss} .big{font-size:46px;font-weight:bold;text-align:center;border:2px solid #000;border-radius:8px;padding:6px;margin:8px 0;}</style></head><body>
    ${pages.map((p, i) => (i > 0 ? `<div class="pbb">${p}</div>` : `<div>${p}</div>`)).join("")}
    </body></html>`;
  try { imprimirEnIframe(html); } catch { /* la impresión nunca rompe el flujo */ }
}

/** Lista de compra (Reposición): agrupada por proveedor → producto, cajas, sector. */
export function imprimirListaCompra(items = []) {
  // Agrupar por proveedor (cae a "Sin proveedor" si falta).
  const map = new Map();
  for (const it of items) {
    const prov = (it.vendor?.name && String(it.vendor.name).trim()) || "Sin proveedor";
    if (!map.has(prov)) map.set(prov, []);
    map.get(prov).push(it);
  }
  const grupos = [...map.entries()]
    .map(([proveedor, its]) => ({ proveedor, items: its }))
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor, "es"));

  const totalCajas = items.reduce((a, it) => a + (Number(it.cajas) || 0), 0);

  const cuerpo = grupos
    .map((g) => {
      const filas = g.items
        .map((it) => `<tr>
          <td class="n">${esc(it.name || "—")}</td>
          <td class="c"><b>${Number(it.cajas) || 0}</b></td>
          <td class="s">${esc(it.location?.sector || it.sector || "—")}</td>
        </tr>`)
        .join("");
      const subt = g.items.reduce((a, it) => a + (Number(it.cajas) || 0), 0);
      return `<div class="sector">${esc(g.proveedor)} · ${subt} ${subt === 1 ? "caja" : "cajas"}</div>
        <table class="items">
          <thead><tr><th class="n">Producto</th><th class="c">Cajas</th><th class="s">Sector</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lista de compra</title>
    <style>${baseCss}
      table.items thead th { text-align: left; font-size: 11px; color: #444; border-bottom: 1px solid #000; padding: 2px 0; }
      table.items th.c, table.items td.c { text-align: center; white-space: nowrap; width: 48px; }
      table.items th.s, table.items td.s { text-align: right; white-space: nowrap; }
      td.n { font-weight: bold; }
    </style></head><body>
    <h1>BODEGA 12</h1>
    <div class="sub">Lista de compra · reposición</div>
    <div class="meta">
      <div><span>Fecha</span><span>${new Date().toLocaleString("es-CL")}</span></div>
      <div><span>Productos</span><b>${items.length}</b></div>
    </div>
    ${cuerpo || '<div class="foot">Sin productos seleccionados.</div>'}
    <div class="total"><span>TOTAL CAJAS</span><span>${totalCajas}</span></div>
    <div class="foot">Pedir al proveedor · confirmar al recibir.</div>
    </body></html>`;
  imprimirEnIframe(html);
}

export default { imprimirBoleta, buildBoletaHtml, imprimirEnIframe, imprimirComprobantePago, imprimirTicketPicking, imprimirEtiquetasZona, imprimirEtiquetaDespacho, imprimirListaCompra, agruparItemsPorSector };
