import { imprimirEtiquetaDespachoTermica, bridgeDisponible } from "./escpos.js";

// Impresión por NAVEGADOR de los documentos de bodega: etiqueta de despacho por
// bulto y lista de compra de reposición. Si la estación tiene el puente térmico
// activo (localStorage cibox_print_termica="1") la etiqueta sale por la impresora
// ESC/POS; si el puente no responde, cae sola a la impresión del navegador.
const termicaOn = () => { try { return localStorage.getItem("cibox_print_termica") === "1"; } catch { return false; } };

const folio = (o) => String(o?._id || "").slice(-6).toUpperCase();

// Escape HTML: los nombres (cliente, producto, proveedor…) llegan sin sanitizar y
// se interpolan en HTML que se ejecuta same-origin (iframe).
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const baseCss = `
  * { box-sizing: border-box; } body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; width: 300px; color: #000; }
  h1 { font-size: 16px; margin: 0; text-align: center; } .sub { text-align: center; font-size: 11px; margin: 2px 0 8px; }
  .meta { font-size: 11px; margin: 6px 0; } .meta div { display: flex; justify-content: space-between; }
  .grupo { font-weight: bold; font-size: 12px; margin: 8px 0 2px; border-bottom: 1px dashed #000; text-transform: uppercase; }
  table.items { width: 100%; border-collapse: collapse; font-size: 12px; } table.items td { padding: 3px 0; vertical-align: top; border-bottom: 1px dotted #bbb; }
  td.n { font-weight: bold; }
  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 2px solid #000; margin-top: 8px; padding-top: 6px; }
  .pbb { page-break-before: always; }
  .foot { text-align: center; font-size: 10px; margin-top: 8px; }
  @media print { @page { margin: 4mm; } }
`;

/** Imprime cualquier HTML sin abrir popup (iframe oculto que se auto-limpia). */
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

/** Etiqueta de despacho: una por BULTO (tope 50) con folio y peso. */
export async function imprimirEtiquetaDespacho(order, { bultos = null, peso = null } = {}) {
  try {
    if (termicaOn() || await bridgeDisponible()) {
      if (await imprimirEtiquetaDespachoTermica(order, { bultos, peso })) return;
    }
  } catch { /* puente caído → navegador */ }
  // Tope de seguridad: un dedazo (ej. "300") no debe disparar 300 páginas.
  const nb = bultos != null && Number(bultos) >= 1 ? Math.min(50, Math.round(Number(bultos))) : null;
  const cab = `<h1>CIBOX · DESPACHO</h1>
    <div class="meta">
      <div><span>Folio</span><b>#${esc(folio(order))}</b></div>
      <div><span>Cliente</span><span>${esc(order.customer?.fullName || "Cliente")}</span></div>
      <div><span>Fecha</span><span>${new Date().toLocaleString("es-CL")}</span></div>
    </div>`;
  const pages = nb
    ? Array.from({ length: nb }, (_, i) => `${cab}
        <div class="big">BULTO ${i + 1} / ${nb}</div>
        ${i === 0 && peso != null ? `<div class="meta"><div><span>Peso total</span><b>${esc(peso)} kg</b></div></div>` : ""}
        <div class="foot">Cuenta los ${nb} bultos al entregar.</div>`)
    : [`${cab}
        <div class="sub">Bultos</div>
        <div class="big">—</div>
        ${peso != null ? `<div class="meta"><div><span>Peso</span><b>${esc(peso)} kg</b></div></div>` : ""}
        <div class="foot">Cuenta los bultos al entregar.</div>`];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Despacho ${esc(folio(order))}</title>
    <style>${baseCss} .big{font-size:46px;font-weight:bold;text-align:center;border:2px solid #000;border-radius:8px;padding:6px;margin:8px 0;}</style></head><body>
    ${pages.map((p, i) => (i > 0 ? `<div class="pbb">${p}</div>` : `<div>${p}</div>`)).join("")}
    </body></html>`;
  try { imprimirEnIframe(html); } catch { /* la impresión nunca rompe el flujo */ }
}

/** Lista de compra (Reposición): agrupada por proveedor → producto, cajas. */
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
        </tr>`)
        .join("");
      const subt = g.items.reduce((a, it) => a + (Number(it.cajas) || 0), 0);
      return `<div class="grupo">${esc(g.proveedor)} · ${subt} ${subt === 1 ? "caja" : "cajas"}</div>
        <table class="items">
          <thead><tr><th class="n">Producto</th><th class="c">Cajas</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lista de compra</title>
    <style>${baseCss}
      table.items thead th { text-align: left; font-size: 11px; color: #444; border-bottom: 1px solid #000; padding: 2px 0; }
      table.items th.c, table.items td.c { text-align: center; white-space: nowrap; width: 48px; }
      td.n { font-weight: bold; }
    </style></head><body>
    <h1>CIBOX</h1>
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

export default { imprimirEnIframe, imprimirEtiquetaDespacho, imprimirListaCompra };
