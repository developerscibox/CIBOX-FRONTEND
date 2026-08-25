import { Platform } from "react-native";
import { create } from "zustand";

/**
 * Aviso de relanzamiento: la ventana que saluda al cliente al entrar a la tienda.
 *
 * FRECUENCIA — sale en CADA VISITA, no una sola vez por dispositivo.
 *
 * Antes se guardaba un flag en localStorage y el aviso no volvía a aparecer
 * nunca más. Para una campaña de relanzamiento eso es al revés de lo que se
 * necesita: el cliente que entró una vez la primera semana no se vuelve a
 * enterar. Ahora el "ya lo cerré" vive solo mientras dura la visita:
 *
 *  - Web: `sessionStorage`, o sea la pestaña actual. Cerrarla y volver mañana
 *    muestra el aviso de nuevo; recargar la página mientras se navega, no.
 *  - Nativo: solo memoria, o sea una vez por apertura de la app.
 *
 * Se usa sessionStorage y no "sin memoria" a propósito: sin nada, cerrar el
 * aviso y recargar lo devolvía a la cara en la misma visita, que es la forma
 * más rápida de que alguien aprenda a cerrarlo sin leerlo.
 */

// Hasta cuándo dura la campaña. Pasada esta fecha el aviso no se muestra más y
// no hay que tocar ni desplegar nada. Fin de septiembre de 2026, hora de Chile
// (UTC-3 en horario de verano) → 1 de octubre 03:00 UTC.
const FIN_DE_CAMPANA = new Date("2026-10-01T03:00:00Z");

const AVISO_KEY = "cibox_aviso_relanzamiento_v2";

/** true mientras la campaña siga vigente. */
export const campanaVigente = (ahora = new Date()) => ahora < FIN_DE_CAMPANA;

// Solo web tiene sessionStorage; en nativo basta el estado en memoria, que ya
// se reinicia con cada apertura de la app.
const avisoStorage = {
  getItem: (key) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Modo incógnito con storage bloqueado: se pierde el "ya lo cerré" al
      // recargar, pero el aviso igual funciona.
    }
  },
};

const useBienvenidaStore = create((set) => ({
  // visto: ya se cerró el aviso en ESTA visita.
  visto: false,
  // cargado: ya se resolvió si corresponde mostrarlo. Hasta que sea true no se
  // dibuja nada, para que el aviso no parpadee en pantalla y desaparezca.
  cargado: false,

  cargarAviso: () => {
    // Campaña terminada: se marca como visto y no vuelve a aparecer.
    if (!campanaVigente()) {
      set({ visto: true, cargado: true });
      return;
    }
    set({ visto: avisoStorage.getItem(AVISO_KEY) === "true", cargado: true });
  },

  cerrarAviso: () => {
    set({ visto: true });
    avisoStorage.setItem(AVISO_KEY, "true");
  },
}));

export default useBienvenidaStore;
