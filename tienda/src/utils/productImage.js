/**
 * Imagen / ficha visual de producto.
 *
 * Prioridad: si el producto trae thumbnail/images reales (Cloudinary), se usan.
 * Si NO (productos de prueba sin foto), ProductCard muestra una FICHA DE MARCA
 * con un emoji relacionado al producto + tinte por categoría. Decidimos NO usar
 * fotos de stock aleatorias (loremflickr) porque devolvían imágenes que no
 * corresponden (p. ej. una estatua para "Servilletas"); la ficha de marca es
 * fiable, consistente y siempre relacionada con el producto.
 */

const normalize = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Emoji por palabra clave del NOMBRE (específico → general).
const EMOJI_BY_KEYWORD = [
  [["hamburgues"], "🍔"],
  [["vienesa", "salchich", "chori", "hot dog"], "🌭"],
  [["jamon"], "🍖"],
  [["papel higien", "confort"], "🧻"],
  [["servilleta", "toalla de papel", "toalla"], "🧻"],
  [["cloro"], "🧴"],
  [["lavaloza"], "🧽"],
  [["detergente"], "🧺"],
  [["papas frita", "papas prefri", "papas pre"], "🍟"],
  [["ramitas", "snack"], "🍿"],
  [["chocolate", "sahne", "super 8", "sahne-nuss"], "🍫"],
  [["marshmallow"], "🍬"],
  [["galleta", "trencito", "frac", "triton"], "🍪"],
  [["jugo en polvo", "jugo", "nectar", "bilz"], "🧃"],
  [["agua"], "💧"],
  [["pepsi", "coca", "bebida", "gaseosa"], "🥤"],
  [["leche condensada"], "🥫"],
  [["crema de leche", "crema"], "🥛"],
  [["leche"], "🥛"],
  [["yogur"], "🥣"],
  [["queso"], "🧀"],
  [["mantequilla", "margarina"], "🧈"],
  [["cola cao", "cacao"], "🍫"],
  [["cafe"], "☕"],
  [["te ceylan", "bolsitas", " te "], "🍵"],
  [["caldo"], "🍲"],
  [["pure"], "🥔"],
  [["lenteja", "poroto", "garbanzo"], "🫘"],
  [["salsa de tomate", "salsa", "ketchup"], "🍅"],
  [["atun", "jurel", "sardina"], "🐟"],
  [["aceite"], "🫒"],
  [["azucar"], "🧂"],
  [["harina"], "🌾"],
  [["arroz"], "🍚"],
  [["fideo", "tallarin", "spaghetti", "pasta"], "🍝"],
  [["huevo"], "🥚"],
  [["pan", "marraqueta", "hallulla"], "🍞"],
  [["pollo", "ave"], "🍗"],
  [["mascota", "perro", "gato"], "🐾"],
];

// Emoji por categoría (fallback).
const EMOJI_BY_CATEGORY = {
  congelados: "🧊",
  cecinas: "🥩",
  papeles: "🧻",
  "aseo y limpieza": "🧽",
  snacks: "🍿",
  "galletas y confites": "🍪",
  bebidas: "🥤",
  lacteos: "🥛",
  "desayuno y dulces": "☕",
  abarrotes: "🛒",
  conservas: "🥫",
};

// Tinte suave de fondo por categoría (de marca, para variedad visual).
const TINT_BY_CATEGORY = {
  lacteos: "#EAF2FB",
  bebidas: "#FCE7F3",
  "galletas y confites": "#FEF3C7",
  snacks: "#FFEDD5",
  abarrotes: "#F3E8FF",
  conservas: "#E0F2FE",
  papeles: "#F1F5F9",
  "aseo y limpieza": "#E0F7F4",
  cecinas: "#FCE7E7",
  congelados: "#E0F2FE",
  "desayuno y dulces": "#F5EBDD",
};

/** Emoji relacionado al producto (nombre primero, luego categoría). */
export const productEmoji = (product) => {
  const name = normalize(product?.name);
  for (const [keys, emoji] of EMOJI_BY_KEYWORD) {
    if (keys.some((k) => name.includes(normalize(k)))) return emoji;
  }
  return EMOJI_BY_CATEGORY[normalize(product?.category?.name)] || "🛒";
};

/** Color de fondo suave para la ficha de marca, según categoría. */
export const productTint = (product) =>
  TINT_BY_CATEGORY[normalize(product?.category?.name)] || "#FCE7F3";

/** URL de imagen REAL si existe; si no, null (ProductCard muestra la ficha). */
export const getProductImage = (product) => {
  const own = product?.thumbnail || product?.images?.[0];
  return own && String(own).trim() ? own : null;
};

/** true si el producto no tiene foto real (se usa la ficha de marca). */
export const isStockImage = (product) => {
  const own = product?.thumbnail || product?.images?.[0];
  return !(own && String(own).trim());
};
