/**
 * IDENTIDAD DE CIBOX EN LA TIENDA — único archivo de marca de esta app.
 *
 * La fuente de verdad vive en el backend (`backend/src/config/brand.js`) y se
 * sirve por `GET /api/config/brand`. Aquí solo hay:
 *
 *  1. Los datos mínimos para el primer render (nombre, logo, prefijo de
 *     almacenamiento). Los colores viven en `theme.js`, el otro archivo de
 *     marca de esta app, porque Metro los necesita en tiempo de build.
 *  2. `hydrateBrand()`: al abrir la app trae del backend los datos legales, el
 *     contacto y la dirección, para que el RUT, la razón social, el giro y el
 *     teléfono no estén escritos dos veces.
 *
 * Ninguna otra pantalla debe declarar constantes de marca: importa `brand`.
 */
import api from "../api/client";

export const brand = {
  name: "Cibox",
  tagline: "Tu supermercado online",
  description: "Supermercado 100% online: compra desde la web y te lo preparamos y despachamos.",
  logo: require("../../assets/logo-cibox.png"),
  legal: {
    razon_social: "CIBOX COMERCIALIZADORA SPA",
    rut: "78.245.061-1",
    giro_codigo: "471990",
    giro_glosa: "",
    iva_pct: 19,
    precios_con_iva: true,
  },
  contact: {
    email: "contacto@cibox.cl",
    email_soporte: "soporte@cibox.cl",
    phone: "+56 9 3244 5772",
    whatsapp: "56932445772",
    instagram: "cibox.cl",
    tiktok: "cibox.cl",
  },
  // Sin definir hasta que Cibox tenga bodega. Ver `hasAddress()`.
  address: {
    one_line: "",
    line1: "",
    line2: "",
    comuna: "",
    ciudad: "",
    region: "",
    pais: "Chile",
    hint: "",
    hours: "",
  },
  web: { site_url: "https://cibox.cl", app_scheme: "cibox", storage_prefix: "cibox" },
  loaded: false,
};

/** Prefijo único de las claves de almacenamiento local de la tienda. */
export const storageKey = (name) => `${brand.web.storage_prefix}_${name}`;

/**
 * ¿Hay una dirección real que mostrar?
 *
 * La ubicación de Cibox todavía no está definida, así que el backend la sirve
 * vacía. Las pantallas que hablan de retiro (mapa, checkout, detalle del
 * pedido, contacto) preguntan por esto antes de dibujar la dirección: es
 * preferible no decir nada a mostrar una dirección equivocada.
 */
export const hasAddress = () => Boolean(brand.address?.one_line?.trim());

/** Dirección para mostrar, o un texto neutro mientras no esté definida. */
export const addressText = (placeholder = "Dirección por confirmar") =>
  hasAddress() ? brand.address.one_line : placeholder;

/** Horario de atención, o cadena vacía si todavía no se define. */
export const openingHours = () => brand.address?.hours?.trim() || "";

/** Enlaces derivados del contacto — para no repetir el armado en cada pantalla. */
export const links = {
  whatsapp: () => `https://wa.me/${brand.contact.whatsapp}`,
  instagram: () => `https://instagram.com/${brand.contact.instagram}`,
  tiktok: () => `https://www.tiktok.com/@${brand.contact.tiktok}`,
  mailto: (subject = "", body = "") =>
    `mailto:${brand.contact.email_soporte}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  tel: () => `tel:${brand.contact.phone.replace(/\s/g, "")}`,
};

/**
 * Trae la identidad real del backend. Best-effort: si falla, la tienda sigue
 * con los valores de arriba (que son los mismos, solo que sin poder cambiarlos
 * por variable de entorno sin redeploy).
 */
export async function hydrateBrand() {
  try {
    const { data } = await api.get("/config/brand");
    const d = data?.data ?? data;
    if (d?.name) {
      Object.assign(brand, { ...d, logo: brand.logo, loaded: true });
    }
  } catch {
    /* sin backend → se queda con los valores locales */
  }
  return brand;
}

export default brand;
