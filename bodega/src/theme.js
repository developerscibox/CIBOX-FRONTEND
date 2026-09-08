// Tokens de color del panel. La paleta NO se define aquí: viene de brand.js,
// el único archivo de identidad de esta app. Las claves magenta/morado se
// conservan como alias porque las usan muchas pantallas.
import { colors } from "./brand.js";

export const t = {
  magenta: colors.primary,
  magentaD: colors.primaryDark,
  morado: colors.primaryDark,
  rosa: colors.primaryLight,
  rosaSoft: colors.primaryLight,
  bg: colors.background,
  surface: colors.surface,
  text: colors.text,
  muted: colors.muted,
  border: colors.border,
  ok: colors.ok,
  warn: colors.warn,
  danger: colors.danger,
  amarillo: colors.accent,
  grad: colors.gradient,
};

// Metadatos de estado de pedido — espejo del backend.
//
// Son ocho estados y la paleta de marca tiene cuatro colores cromáticos, así que
// el semáforo NO se puede pintar solo con ella sin volver indistinguibles los
// estados entre sí: la trazabilidad del pedido depende de poder separarlos de un
// vistazo. Cada uno lleva además su etiqueta escrita, que es lo que exige el
// punto 13 ("no usar solo color para comunicar información").
//
// Lo que sí se corrigió: "Preparando" iba en el verde de la identidad anterior
// (#006996 sobre #E6F0F5) y encima daba 3,23:1, bajo el mínimo AA. Ahora va en
// el azul de marca —que es el estado que más se mira en bodega— con 10,3:1, y
// coincide con el mismo estado en la tienda.
export const ORDER_STATUS = {
  pending:   { label: "Pendiente",        bg: "#fef3c7", text: "#92400e" },
  paid:      { label: "Pagada",           bg: "#dbeafe", text: "#1d4ed8" },
  preparing: { label: "Preparando",       bg: "#E6F0F5", text: "#003D49" },
  ready:     { label: "Lista",            bg: "#e0f2fe", text: "#0369a1" },
  shipped:   { label: "En camino",        bg: "#cffafe", text: "#0e7490" },
  delivered: { label: "Entregada",        bg: "#dcfce7", text: "#166534" },
  cancelled: { label: "Cancelada",        bg: "#fee2e2", text: "#b91c1c" },
  // Gris, igual que en la tienda: es un estado cerrado y neutro, y el par
  // morado no coincidia con el de la otra app (9,4:1).
  refunded:  { label: "Reembolsada",      bg: "#f3f4f6", text: "#374151" },
};

// Tipos de movimiento de kardex — espejo de MOVEMENT_TYPES del backend.
// El verde de las entradas (#16a34a) daba 3,09:1 sobre el fondo del panel: por
// debajo del mínimo para texto, y estas son cifras de stock. El verde oscuro
// rinde 6,6:1 y mantiene la lectura de "entrada" frente al rojo de las salidas.
const ENTRADA = "#166534";
const SALIDA = "#b91c1c";
export const MOVEMENT = {
  venta:      { label: "Venta",      color: SALIDA,  sign: "-" },
  anulacion:  { label: "Anulación",  color: ENTRADA, sign: "+" },
  expiracion: { label: "Expiración", color: ENTRADA, sign: "+" },
  reembolso:  { label: "Reembolso",  color: ENTRADA, sign: "+" },
  ajuste:     { label: "Ajuste",     color: "#004568", sign: "±" },
  merma:      { label: "Merma",      color: SALIDA,  sign: "-" },
  recepcion:  { label: "Recepción",  color: ENTRADA, sign: "+" },
};

export const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
