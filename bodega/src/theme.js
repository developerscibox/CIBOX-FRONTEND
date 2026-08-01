// Paleta Bodega 12 (compartida con la tienda) — magenta/fucsia + morado.
export const t = {
  magenta: "#E6007E",
  magentaD: "#B5006A",
  morado: "#7A1B73",
  rosa: "#FF3DA6",
  rosaSoft: "#FBCFE8",
  bg: "#f7eef4",
  surface: "#ffffff",
  text: "#2a1022",
  muted: "#8a6e80",
  border: "#ecdbe6",
  ok: "#16a34a",
  warn: "#d97706",
  danger: "#d92d20",
  amarillo: "#FBBF24",
  grad: "linear-gradient(120deg,#7A1B73 0%,#C0067A 45%,#E6007E 75%,#FF3DA6 100%)",
};

// Metadatos de estado de pedido — espejo del backend Bodega 12.
export const ORDER_STATUS = {
  pending:   { label: "Pendiente",        bg: "#fef3c7", text: "#92400e" },
  paid:      { label: "Pagada",           bg: "#dbeafe", text: "#1d4ed8" },
  preparing: { label: "Preparando",       bg: "#fce7f3", text: "#9d174d" },
  ready:     { label: "Lista p/ retiro",  bg: "#e0f2fe", text: "#0369a1" },
  shipped:   { label: "En camino",        bg: "#cffafe", text: "#0e7490" },
  delivered: { label: "Retirada/Entregada", bg: "#dcfce7", text: "#166534" },
  cancelled: { label: "Cancelada",        bg: "#fee2e2", text: "#b91c1c" },
  refunded:  { label: "Reembolsada",      bg: "#f3e8ff", text: "#7e22ce" },
};

// Tipos de movimiento de kardex — espejo de MOVEMENT_TYPES del backend.
export const MOVEMENT = {
  venta:      { label: "Venta",      color: "#b91c1c", sign: "-" },
  anulacion:  { label: "Anulación",  color: "#16a34a", sign: "+" },
  expiracion: { label: "Expiración", color: "#16a34a", sign: "+" },
  reembolso:  { label: "Reembolso",  color: "#16a34a", sign: "+" },
  ajuste:     { label: "Ajuste",     color: "#7A1B73", sign: "±" },
  recepcion:  { label: "Recepción",  color: "#16a34a", sign: "+" },
};

export const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
