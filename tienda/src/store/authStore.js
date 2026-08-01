import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import useCartStore from "./cartStore";
import { clearGuestId } from "../utils/guestId";

const AUTH_KEY = "auth";

const authStorage = {
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

  removeItem: async (key) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
      return;
    }

    await AsyncStorage.removeItem(key);
  },
};

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,

  setAuth: async ({ user, token, refreshToken }) => {
    // Seguridad (XSS): en WEB de producción el refresh token vive SOLO en la
    // cookie httpOnly (b12_rt) — jamás se persiste en localStorage ni se conserva
    // en memoria (localStorage es robable por cualquier script del origen). En dev
    // web la cookie no viaja cross-origin, así que se mantiene el fallback por body.
    const persistFull = !(Platform.OS === "web" && !__DEV__);
    const payload = persistFull
      ? JSON.stringify({ user, token, refreshToken })
      : JSON.stringify({ user });
    await authStorage.setItem(AUTH_KEY, payload);
    set({ user, token, refreshToken: persistFull ? refreshToken : null });
  },

  logout: async () => {
    await authStorage.removeItem(AUTH_KEY);
    await clearGuestId(); // ← importar y agregar
    useCartStore.getState().clearCartSummary();
    set({ user: null, token: null, refreshToken: null });
  },

  loadAuth: async () => {
    try {
      const data = await authStorage.getItem(AUTH_KEY);

      if (data) {
        const parsed = JSON.parse(data);

        set({
          user: parsed?.user || null,
          token: parsed?.token || null,
          refreshToken: parsed?.refreshToken || null,
        });
      } else {
        set({ user: null, token: null, refreshToken: null });
      }
    } catch (error) {
      if (__DEV__) console.log("LOAD AUTH ERROR:", error);
      set({ user: null, token: null, refreshToken: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
