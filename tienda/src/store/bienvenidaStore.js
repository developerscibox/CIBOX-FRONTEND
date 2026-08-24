import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Aviso de relanzamiento: la ventana que saluda al cliente al entrar a la tienda.
 *
 * Se muestra UNA vez por navegador/dispositivo. La clave va versionada a
 * propósito: para volver a mostrarlo en la próxima campaña basta subir el número
 * (`_v2`, `_v3`), sin tener que pedirle a nadie que borre sus datos.
 */
const AVISO_KEY = "cibox_aviso_relanzamiento_v1";

// Mismo patrón que onboardingStore: localStorage en web, AsyncStorage en nativo.
const avisoStorage = {
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

const useBienvenidaStore = create((set) => ({
  // visto: ya se cerró el aviso alguna vez en este dispositivo
  visto: false,
  // cargado: ya se leyó el flag persistido. Hasta que sea true no se muestra
  // nada, para que el aviso no parpadee en pantalla y desaparezca.
  cargado: false,

  cargarAviso: async () => {
    try {
      const valor = await avisoStorage.getItem(AVISO_KEY);
      set({ visto: valor === "true", cargado: true });
    } catch (error) {
      if (__DEV__) console.log("CARGAR AVISO ERROR:", error);
      set({ visto: false, cargado: true });
    }
  },

  cerrarAviso: async () => {
    set({ visto: true });
    try {
      await avisoStorage.setItem(AVISO_KEY, "true");
    } catch (error) {
      if (__DEV__) console.log("CERRAR AVISO ERROR:", error);
    }
  },
}));

export default useBienvenidaStore;
