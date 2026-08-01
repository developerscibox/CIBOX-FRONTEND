// Ícono (Ionicons) por categoría, DATA-DRIVEN. Para cambiar/agregar un ícono
// basta editar este archivo (mapa por slug o palabras del nombre); no hay que
// tocar el JSX de ningún componente.

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Mapa explícito por slug (si la categoría tiene slug propio en la BD).
const BY_SLUG = {
  abarrotes: "basket-outline",
  bebidas: "wine-outline",
  lacteos: "nutrition-outline",
  "galletas-y-confites": "fast-food-outline",
  snacks: "fast-food-outline",
  conservas: "cube-outline",
  "aseo-y-limpieza": "sparkles-outline",
  papeles: "documents-outline",
  cecinas: "restaurant-outline",
  congelados: "snow-outline",
  "desayuno-y-dulces": "cafe-outline",
};

// Fallback por palabras del nombre (cubre categorías sin slug mapeado).
const iconByName = (name = "") => {
  const n = norm(name);
  if (/abarrote|granel|fideo|arroz|legumbre|aceite|harina|salsa/.test(n)) return "basket-outline";
  if (/lacteo|leche|queso|yogur|mantequilla|huevo/.test(n)) return "nutrition-outline";
  if (/bebida|jugo|agua|gaseosa|refresco|licor|vino/.test(n)) return "wine-outline";
  if (/limpieza|aseo|deterg|cloro|lavaloza|hogar/.test(n)) return "sparkles-outline";
  if (/papel|servilleta|confort/.test(n)) return "documents-outline";
  if (/cuidado|personal|higiene|belleza/.test(n)) return "body-outline";
  if (/mascota|perro|gato/.test(n)) return "paw-outline";
  if (/snack|dulce|golosina|galleta|chocolate|confite/.test(n)) return "fast-food-outline";
  if (/congelado|carne|pollo|cecina|mariscos|verdura/.test(n)) return "snow-outline";
  if (/conserva|enlatado/.test(n)) return "cube-outline";
  if (/desayuno|cafe|cereal|te\b/.test(n)) return "cafe-outline";
  return "pricetag-outline";
};

export const iconForCategory = (category) => {
  const slug = category?.slug ? String(category.slug).toLowerCase() : "";
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug];
  return iconByName(category?.name || "");
};
