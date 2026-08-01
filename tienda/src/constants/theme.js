/**
 * Paleta Bodega 12 — reemplazo directo de theme.js para re-marcar la app.
 *
 * Uso: renombrar este archivo a theme.js (o cambiar los imports), nada más.
 * Toda la app consume estos tokens, así que el rebrand es un solo archivo.
 *
 * Identidad: magenta/fucsia Bodega 12 ("Supermercado mayorista · Lo Espejo"),
 * con morado para profundidad y amarillo para badges de descuento.
 */
export const colors = {
  background: "#fff5fa",
  surface: "#ffffff",
  text: "#2a1022",
  muted: "#8a6e80",
  border: "#f5dceb",
  primary: "#E6007E",      // magenta Bodega 12 — botones y CTA
  primaryLight: "#FBCFE8", // rosado suave — fondos destacados
  accent: "#B5006A",       // fucsia oscuro — precios, énfasis
  primaryText: "#ffffff",
  danger: "#d92d20",
  success: "#16a34a",
  discount: "#FBBF24",     // amarillo — badges de oferta/descuento
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadows = {
  card: {
    shadowColor: "#7a1b4a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

export const typography = {
  regular: "Poppins_400Regular",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};
