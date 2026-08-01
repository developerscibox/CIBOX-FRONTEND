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
  primary: "#4E9B27",
  primaryLight: "#C3E062",
  primaryDark: "#3B7A1D",
  accent: "#F7B81C",
  primaryText: "#ffffff",
  background: "#f7f8f5",
  surface: "#ffffff",
  text: "#111811",
  muted: "#5f6b5f",
  border: "#e3e8e0",
  ok: "#16794a",
  warn: "#d97706",
  danger: "#b00020",
  gradient: "linear-gradient(120deg,#3B7A1D 0%,#4E9B27 55%,#C3E062 100%)",
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
    Object.assign(brand, d, { loaded: true });
    return brand;
  } catch {
    return brand;
  }
}

export default brand;
