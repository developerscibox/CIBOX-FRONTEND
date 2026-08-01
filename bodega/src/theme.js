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
export const ORDER_STATUS = {
  pending:   { label: "Pendiente",        bg: "#fef3c7", text: "#92400e" },
  paid:      { label: "Pagada",           bg: "#dbeafe", text: "#1d4ed8" },
  preparing: { label: "Preparando",       bg: "#e9f3da", text: "#6B8F4E" },
  ready:     { label: "Lista",            bg: "#e0f2fe", text: "#0369a1" },
  shipped:   { label: "En camino",        bg: "#cffafe", text: "#0e7490" },
  delivered: { label: "Entregada",        bg: "#dcfce7", text: "#166534" },
  cancelled: { label: "Cancelada",        bg: "#fee2e2", text: "#b91c1c" },
  refunded:  { label: "Reembolsada",      bg: "#f3e8ff", text: "#7e22ce" },
};

// Tipos de movimiento de kardex — espejo de MOVEMENT_TYPES del backend.
export const MOVEMENT = {
  venta:      { label: "Venta",      color: "#b91c1c", sign: "-" },
  anulacion:  { label: "Anulación",  color: "#16a34a", sign: "+" },
  expiracion: { label: "Expiración", color: "#16a34a", sign: "+" },
  reembolso:  { label: "Reembolso",  color: "#16a34a", sign: "+" },
  ajuste:     { label: "Ajuste",     color: "#3B7A1D", sign: "±" },
  recepcion:  { label: "Recepción",  color: "#16a34a", sign: "+" },
};

export const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
