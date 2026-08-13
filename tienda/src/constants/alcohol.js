/**
 * Detección de productos con alcohol.
 *
 * En Chile la Ley 19.925 prohíbe vender alcohol a menores de 18 y obliga a
 * controlarlo. La tienda tiene 65 productos en Cervezas, Destilados, Licores y
 * Vinos, y hasta ahora se podían ver y comprar sin declarar la edad.
 *
 * La detección va por SUBCATEGORÍA, no por la categoría padre: "Licores,
 * Bebidas y Aguas" también cuelga aguas y bebidas sin alcohol, así que usar el
 * padre bloquearía media tienda sin motivo.
 *
 * El nombre se revisa como red de seguridad, para el producto mal categorizado.
 */

// Subcategorías del árbol de Cibox que son alcohol.
const SUBCATEGORIAS_CON_ALCOHOL = ["cervezas", "destilados", "licores", "vinos"];

// Red de seguridad para productos mal clasificados. Solo palabras que no se
// prestan a confusión: nada de "sidra" (hay sidra sin alcohol) ni "cerveza
// sin alcohol", que se descarta más abajo.
const PALABRAS_ALCOHOL = [
  "cerveza", "vino", "pisco", "whisky", "vodka", "tequila", "ron ",
  "licor", "espumante", "champa", "aperitivo", "destilado", "gin ",
  "mezcal", "cognac", "brandy", "amaretto", "vermouth", "vermut",
];

// Si el envase declara que no lleva alcohol, no se bloquea.
const SIN_ALCOHOL = /sin alcohol|0[.,]0\s*%|cero alcohol|no alcoh/i;

const normalizar = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** ¿Este producto lleva alcohol? */
export const esAlcohol = (producto) => {
  if (!producto) return false;

  const nombre = normalizar(producto.name);
  if (SIN_ALCOHOL.test(nombre)) return false;

  // 1. Por subcategoría (la vía principal y confiable).
  const sub = normalizar(producto.subcategory?.name);
  if (sub && SUBCATEGORIAS_CON_ALCOHOL.includes(sub)) return true;

  // Algunos productos traen todas sus categorías en `categories`.
  const todas = Array.isArray(producto.categories) ? producto.categories : [];
  if (todas.some((c) => SUBCATEGORIAS_CON_ALCOHOL.includes(normalizar(c?.name)))) return true;

  // 2. Red de seguridad por nombre.
  return PALABRAS_ALCOHOL.some((p) => nombre.includes(p));
};

/** ¿Esta categoría o subcategoría es de alcohol? (para bloquear el listado) */
export const categoriaEsAlcohol = (nombre) =>
  SUBCATEGORIAS_CON_ALCOHOL.includes(normalizar(nombre));

/** ¿Hay algún producto con alcohol en el carrito? */
export const carritoTieneAlcohol = (items = []) =>
  items.some((i) => esAlcohol(i?.product || i));

export default esAlcohol;
