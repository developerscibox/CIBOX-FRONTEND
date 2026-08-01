/**
 * Tokens visuales de Cibox — el ÚNICO lugar donde vive la paleta de la tienda.
 *
 * Metro hornea estos valores en el bundle, por eso no se leen del backend. Los
 * colores deben coincidir con `brand.colors` de `backend/src/config/brand.js`,
 * que es la fuente de verdad de la identidad. Todo lo demás (nombre, RUT, razón
 * social, giro, contacto, dirección) está en `constants/brand.js` y se hidrata
 * desde el backend.
 *
 * Identidad: verde Cibox con lima para fondos destacados y amarillo para los
 * badges de descuento.
 */
export const colors = {
  background: "#f7f8f5",
  surface: "#ffffff",
  text: "#111811",
  muted: "#5f6b5f",
  border: "#e3e8e0",
  primary: "#4E9B27",      // verde Cibox — botones y CTA
  primaryLight: "#C3E062", // lima — fondos destacados
  accent: "#3B7A1D",       // verde profundo — precios, énfasis
  primaryText: "#ffffff",
  danger: "#b00020",
  success: "#16794a",
  discount: "#F7B81C",     // amarillo — badges de oferta/descuento
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
    shadowColor: "#1d2a17",
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
