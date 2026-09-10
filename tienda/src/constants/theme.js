/**
 * Tokens visuales de Cibox — el ÚNICO lugar donde vive la paleta de la tienda.
 *
 * Metro hornea estos valores en el bundle, por eso no se leen del backend. Los
 * colores deben coincidir con `brand.colors` de `backend/src/config/brand.js`,
 * que es la fuente de verdad de la identidad. Todo lo demás (nombre, RUT, razón
 * social, giro, contacto, dirección) está en `constants/brand.js` y se hidrata
 * desde el backend.
 *
 * IDENTIDAD (Manual de Diseño Digital cibox.cl v1.0): azules como base —
 * confianza— y verde lima como acento —energía y frescura—. El lima se usa SOLO
 * en acentos, llamadas a la acción y estados; nunca como fondo extenso.
 */
export const colors = {
  // ── Base ───────────────────────────────────────────────────────────────────
  background: "#F5F6F7",   // gris muy claro — fondo de la tienda
  surface: "#FFFFFF",
  text: "#17202A",         // gris oscuro — texto principal
  muted: "#5A6672",        // gris medio — texto secundario
  border: "#E2E6EA",

  // ── Azules de marca ────────────────────────────────────────────────────────
  primary: "#004568",      // azul Cibox — barra de navegación, titulares
  primaryMid: "#006996",   // azul medio — enlaces y estados sobre azul
  primaryDark: "#003D49",  // azul navy — pies de página y fondos profundos
  primaryText: "#FFFFFF",

  // ── Acento lima ────────────────────────────────────────────────────────────
  // El lima es el color de ACCIÓN: botones, precios y badges. Sobre él el texto
  // va oscuro, nunca blanco: #17202A sobre #B6D900 rinde 9,6:1 y el blanco 1,9:1.
  accent: "#B6D900",       // verde lima Cibox
  accentLight: "#D2E51A",  // verde amarillo — resaltados y hover
  accentText: "#17202A",   // el texto que va ENCIMA del lima

  // Se conserva el nombre `primaryLight` porque lo usan varias pantallas para
  // fondos suaves de icono; ahora apunta al lima rebajado.
  primaryLight: "#E8F29A",

  danger: "#C0322B",
  success: "#1D7A4C",
  discount: "#B6D900",     // los descuentos usan el lima de marca
};

// Escala de espaciado del punto 11 del manual (sistema 8pt): 4, 8, 16, 24, 32,
// 40, 48, 64, 80. `md`, `lg` y `xl` ya caían en la escala; `xs` y `sm` iban en 6
// y 10, que no pertenecen a ningún sistema y se habían elegido a ojo.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
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

// Poppins en toda la tienda, en sus tres pesos. Una sola familia mantiene la
// pantalla tranquila: los saltos de estilo se notan más entre dos tipografías
// que entre dos pesos de la misma.
export const typography = {
  regular: "Poppins_400Regular",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};
