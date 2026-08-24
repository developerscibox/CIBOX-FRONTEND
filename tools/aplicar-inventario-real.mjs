/**
 * Deja el stock del catálogo igual al inventario físico real.
 *
 * POR QUÉ EXISTE
 * El importador masivo (`/products/import-bulk`) crea productos con su
 * `stock_inicial`, pero cuando el producto YA existe no toca su stock: el stock
 * se mueve por kardex, nunca por archivo. Así que las cantidades de los
 * productos que ya estaban en el catálogo —y el "no tengo esto" del resto— hay
 * que aplicarlas por el mecanismo que sí deja rastro: un conteo físico
 * (`/inventory/counts`), que registra la diferencia como ajuste con su motivo.
 *
 * QUÉ HACE
 *  1. Abre un conteo físico de TODO el inventario (una línea por producto, con
 *     su stock actual como cantidad teórica).
 *  2. Declara como contado:
 *       - los productos del inventario real → su cantidad verdadera
 *       - todos los demás                   → 0
 *  3. Cierra el conteo, que aplica los ajustes.
 *
 * Nada se borra: los productos que quedan en 0 siguen en el catálogo con su
 * ficha intacta y vuelven a estar a la venta en cuanto se reponga su stock.
 *
 * USO
 *   # 1. Simular (no escribe nada, es lo que hace por defecto):
 *   CIBOX_TOKEN=... node tools/aplicar-inventario-real.mjs
 *
 *   # 2. Aplicar de verdad:
 *   CIBOX_TOKEN=... node tools/aplicar-inventario-real.mjs --aplicar
 *
 * El token es el de una sesión de administrador del panel de bodega. Se pasa
 * por variable de entorno para que no quede escrito en el historial de la
 * consola ni en ningún archivo del repositorio.
 */

import { readFile } from "node:fs/promises";

const API = process.env.CIBOX_API || "https://api.cibox.cl/api";
const TOKEN = process.env.CIBOX_TOKEN || "";
const APLICAR = process.argv.includes("--aplicar");

if (!TOKEN) {
  console.error(
    "Falta el token de administrador.\n" +
      "  CIBOX_TOKEN=<token> node tools/aplicar-inventario-real.mjs\n\n" +
      "El token está en el panel de bodega: entra como administrador, abre las\n" +
      "herramientas del navegador (F12) → Application → Local Storage y copia el\n" +
      "valor del token de sesión.",
  );
  process.exit(1);
}

// Compara nombres ignorando tildes, mayúsculas y signos: el catálogo viejo está
// escrito en mayúsculas y sin tildes, y el inventario nuevo en texto normal.
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const api = async (ruta, opciones = {}) => {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(opciones.headers || {}),
    },
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`${opciones.method || "GET"} ${ruta} → ${r.status}: ${cuerpo?.message || JSON.stringify(cuerpo).slice(0, 200)}`);
  }
  return cuerpo?.data ?? cuerpo;
};

const real = JSON.parse(await readFile(new URL("./inventario-real.json", import.meta.url), "utf8"));

// Dos llaves: el SKU para los productos que ya estaban en el catálogo y el
// nombre para los recién importados, que nacen con un SKU autogenerado.
const porSku = new Map(real.filter((p) => p.sku).map((p) => [String(p.sku).toUpperCase(), p]));
const porNombre = new Map(real.map((p) => [norm(p.name), p]));

console.log(`Inventario real: ${real.length} productos · ${real.reduce((a, p) => a + p.stock, 0)} unidades`);
console.log(`API: ${API}`);
console.log(APLICAR ? "\nMODO: APLICAR (se van a escribir los ajustes)\n" : "\nMODO: SIMULACIÓN (no se escribe nada)\n");

// ── 1. Abrir el conteo ───────────────────────────────────────────────────────
let conteo;
const abiertos = await api("/inventory/counts?status=open");
const yaAbierto = (abiertos?.items || []).find((c) => c?.scope?.type === "all");
if (yaAbierto) {
  console.log(`Hay un conteo de todo el inventario ya abierto (${yaAbierto._id}); se reutiliza.`);
  conteo = await api(`/inventory/counts/${yaAbierto._id}`);
} else if (APLICAR) {
  conteo = await api("/inventory/counts", {
    method: "POST",
    body: JSON.stringify({ scope: { type: "all" } }),
  });
  console.log(`Conteo abierto: ${conteo._id}`);
} else {
  // En simulación no se abre nada: se calcula sobre el catálogo tal como está.
  const productos = [];
  for (let page = 1; page <= 60; page++) {
    const d = await api(`/products?page=${page}&limit=100`);
    const items = d?.items || [];
    productos.push(...items);
    const paginas = d?.pagination?.pages;
    if (!items.length || (paginas && page >= paginas)) break;
  }
  conteo = {
    _id: "(simulado)",
    lines: productos.map((p) => ({
      product_id: p._id,
      product_name: p.name,
      sku: p.sku || "",
      theoretical_qty: Number(p.stock || 0),
    })),
  };
}

// ── 2. Resolver la cantidad real de cada línea ───────────────────────────────
const counts = [];
let coincidenSku = 0;
let coincidenNombre = 0;
let aCero = 0;
let sinCambio = 0;
const noEncontrados = new Set(real.map((p) => p.name));

for (const l of conteo.lines || []) {
  const porS = l.sku ? porSku.get(String(l.sku).toUpperCase()) : null;
  const porN = porNombre.get(norm(l.product_name));
  const encontrado = porS || porN;
  const cantidad = encontrado ? encontrado.stock : 0;

  if (encontrado) {
    if (porS) coincidenSku++;
    else coincidenNombre++;
    noEncontrados.delete(encontrado.name);
  } else {
    aCero++;
  }
  if (Number(l.theoretical_qty) === cantidad) sinCambio++;
  counts.push({ product_id: l.product_id, counted_qty: cantidad });
}

const delta = counts.reduce((a, c, i) => a + (c.counted_qty - Number(conteo.lines[i].theoretical_qty || 0)), 0);
console.log(`Líneas del conteo:            ${counts.length}`);
console.log(`  con inventario real por SKU:    ${coincidenSku}`);
console.log(`  con inventario real por nombre: ${coincidenNombre}`);
console.log(`  se dejan en 0 (no hay stock):   ${aCero}`);
console.log(`  ya coincidían, sin ajuste:      ${sinCambio}`);
console.log(`Variación total de unidades:  ${delta > 0 ? "+" : ""}${delta}`);

if (noEncontrados.size) {
  console.log(`\nAVISO — ${noEncontrados.size} productos del inventario real no aparecen en el catálogo.`);
  console.log("Importa primero el Excel de productos; si no, su stock no se va a aplicar:");
  for (const n of noEncontrados) console.log(`   · ${n}`);
}

if (!APLICAR) {
  console.log("\nSimulación terminada. Nada fue modificado.");
  console.log("Para aplicarlo de verdad, repite el comando con  --aplicar");
  process.exit(0);
}

// ── 3. Cargar las cantidades y cerrar ────────────────────────────────────────
const LOTE = 100;
for (let i = 0; i < counts.length; i += LOTE) {
  const lote = counts.slice(i, i + LOTE);
  await api(`/inventory/counts/${conteo._id}`, {
    method: "PATCH",
    body: JSON.stringify({ counts: lote }),
  });
  console.log(`  cargadas ${Math.min(i + LOTE, counts.length)}/${counts.length} líneas`);
}

const cerrado = await api(`/inventory/counts/${conteo._id}/close`, { method: "POST" });
console.log(`\nConteo cerrado. Líneas ajustadas: ${cerrado?.applied?.lines_adjusted ?? "?"} · unidades: ${cerrado?.applied?.units_delta ?? "?"}`);
console.log("El stock del catálogo ya refleja el inventario físico.");
