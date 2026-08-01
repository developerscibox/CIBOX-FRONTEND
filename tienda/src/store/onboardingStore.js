import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Clave de persistencia del tour de bienvenida (versionada por si cambia el flujo)
const TOUR_SEEN_KEY = "b12_tour_seen_v1";

// Storage tolerante a web (localStorage) y nativo (AsyncStorage), igual que authStore.
const tourStorage = {
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

const useOnboardingStore = create((set) => ({
  // seen: el usuario ya completó/saltó el tour alguna vez
  seen: false,
  // open: forzar la apertura del tour (p.ej. desde un botón "Ver tutorial")
  open: false,

  // Carga el flag persistido al iniciar la app
  loadOnboarding: async () => {
    try {
      const value = await tourStorage.getItem(TOUR_SEEN_KEY);
      set({ seen: value === "true" });
    } catch (error) {
      if (__DEV__) console.log("LOAD ONBOARDING ERROR:", error);
      set({ seen: false });
    }
  },

  openTour: () => set({ open: true }),

  closeTour: () => set({ open: false }),

  markSeen: async () => {
    set({ seen: true });
    try {
      await tourStorage.setItem(TOUR_SEEN_KEY, "true");
    } catch (error) {
      if (__DEV__) console.log("MARK SEEN ERROR:", error);
    }
  },
}));

export default useOnboardingStore;
