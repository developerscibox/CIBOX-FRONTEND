/**
 * IDENTIDAD DE CIBOX EN EL PANEL — único archivo de marca de esta app.
 *
 * La fuente de verdad vive en el backend (`backend/src/config/brand.js`) y se
 * sirve por `GET /api/config/brand`. Aquí solo hay:
 *
 *  1. Los TOKENS VISUALES (colores, logo, nombre): el bundler los necesita en
 *     tiempo de build y el primer render no puede esperar una petición. Deben
 *     coincidir con `brand.colors` del backend.
 *  2. `hydrateBrand()`: al arrancar el panel trae los datos legales y de
 *     contacto del backend y los deja en `brand`. Así el RUT, la razón social,
 *     el giro y el teléfono NUNCA están escritos dos veces.
 *
 * Ninguna otra parte del panel debe declarar constantes de marca.
 */

const API = import.meta.env.VITE_API_URL || "";

// Tokens visuales (build-time). Espejo de brand.colors del backend.
export const colors = {
  // Identidad nueva (Manual de Diseño Digital cibox.cl v1.0): azules de base con
  // el verde lima como acento. Espejo de brand.colors del backend.
  primary: "#004568",
  primaryMid: "#006996",
  primaryLight: "#E8F29A",
  primaryDark: "#003D49",
  accent: "#B6D900",
  accentLight: "#D2E51A",
  // Sobre el lima el texto va oscuro: en blanco se queda en 1,9:1.
  accentText: "#17202A",
  primaryText: "#ffffff",
  // Los NEUTROS también son de marca. Los azules y el lima ya se habían
  // cambiado, pero el fondo, el texto, el gris secundario y el borde seguían
  // teniendo tinte verde de la identidad anterior (#f7f8f5, #111811, #5f6b5f,
  // #e3e8e0): sutil de a uno, pero es lo que cubre toda la pantalla. Estos son
  // los del punto 03 del manual, los mismos que usa la tienda.
  background: "#F5F6F7",
  surface: "#FFFFFF",
  text: "#17202A",
  muted: "#5A6672",
  border: "#E2E6EA",
  ok: "#16794a",
  warn: "#d97706",
  danger: "#b00020",
  gradient: "linear-gradient(120deg,#003D49 0%,#004568 50%,#006996 100%)",
};

/**
 * Identidad de la empresa. Arranca con lo mínimo para pintar y se completa con
 * `hydrateBrand()`. Es un objeto mutable a propósito: se lee en tiempo de
 * render, después de la hidratación.
 */
export const brand = {
  name: "Cibox",
  tagline: "Tu supermercado online",
  logo: "/logo-cibox.png",
  colors,
  legal: { razon_social: "", rut: "", giro_codigo: "", giro_glosa: "", iva_pct: 19 },
  contact: { email: "", email_soporte: "", phone: "", whatsapp: "" },
  address: { one_line: "", comuna: "", ciudad: "" },
  web: { site_url: "", storage_prefix: "cibox" },
  loaded: false,
};

/** Prefijo de las claves de localStorage/sessionStorage del panel. */
export const storageKey = (name) => `${brand.web.storage_prefix || "cibox"}_${name}`;

/**
 * Trae la identidad real del backend. Best-effort: si falla (modo demo, backend
 * dormido) el panel sigue con los tokens visuales y los campos legales vacíos.
 */
export async function hydrateBrand() {
  if (!API) return brand;
  try {
    const r = await fetch(`${API}/config/brand`);
    if (!r.ok) return brand;
    const j = await r.json();
    const d = j?.data ?? j;
    if (!d?.name) return brand;
    // `logo` viaja como objeto { panel, tienda }: aquí se necesita la ruta del
    // panel, no el objeto. Sin esto el <img> quedaba con src="[object Object]".
    Object.assign(brand, d, { logo: d.logo?.panel || brand.logo, loaded: true });
    return brand;
  } catch {
    return brand;
  }
}

export default brand;
