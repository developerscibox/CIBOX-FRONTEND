import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Confirmación de mayoría de edad para la venta de alcohol (Ley 19.925).
 *
 * Funciona como el toast: cualquier pantalla llama a `exigirMayoriaDeEdad()` y
 * recibe una promesa. Si el usuario ya confirmó antes, resuelve al tiro; si no,
 * abre la puerta de edad y resuelve cuando responde. Así el control queda en un
 * solo lugar y no hay que repetirlo en cada pantalla que vende alcohol.
 */

const CLAVE = "cibox_mayor_edad_v1";

const storage = {
  getItem: async (key) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
};

const useEdadStore = create((set, get) => ({
  // Confirmó ser mayor de edad en este dispositivo.
  confirmado: false,
  // Fecha ISO de la confirmación: se adjunta al pedido como declaración.
  confirmadoEn: null,
  // La puerta está abierta esperando respuesta.
  preguntando: false,
  // Se guarda para resolver la promesa cuando responde.
  _resolver: null,

  cargar: async () => {
    try {
      const guardado = await storage.getItem(CLAVE);
      if (guardado) set({ confirmado: true, confirmadoEn: guardado });
    } catch {
      // Si el almacenamiento falla, se vuelve a preguntar. Nunca al revés.
    }
  },

  /** Abre la puerta si hace falta. Devuelve true si puede seguir. */
  exigir: () => {
    if (get().confirmado) return Promise.resolve(true);
    return new Promise((resolve) => {
      set({ preguntando: true, _resolver: resolve });
    });
  },

  confirmarMayor: async () => {
    const ahora = new Date().toISOString();
    set({ confirmado: true, confirmadoEn: ahora, preguntando: false });
    try {
      await storage.setItem(CLAVE, ahora);
    } catch {}
    const r = get()._resolver;
    set({ _resolver: null });
    if (r) r(true);
  },

  rechazar: () => {
    // No se guarda nada: si vuelve a intentar, se le pregunta de nuevo.
    set({ preguntando: false });
    const r = get()._resolver;
    set({ _resolver: null });
    if (r) r(false);
  },
}));

/** Atajo para usar desde servicios y pantallas. */
export const exigirMayoriaDeEdad = () => useEdadStore.getState().exigir();

/** Fecha de la declaración, para adjuntarla al pedido. */
export const fechaDeclaracionEdad = () => useEdadStore.getState().confirmadoEn;

export default useEdadStore;
