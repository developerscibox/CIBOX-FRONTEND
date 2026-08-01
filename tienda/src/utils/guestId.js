import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const GUEST_ID_KEY = "guest_id";

const storage = {
  getItem: async (key) => {
    if (Platform.OS === "web") return window.localStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === "web") return window.localStorage.setItem(key, value);
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === "web") return window.localStorage.removeItem(key);
    return AsyncStorage.removeItem(key);
  },
};

export const getGuestId = async () => {
  try {
    const existing = await storage.getItem(GUEST_ID_KEY);
    if (existing) return existing;

    const res = await axios.get(
      `${process.env.EXPO_PUBLIC_API_URL}/guest/id`
     // "http://localhost:3001/api/guest/id"
      //"https://backend-app-cibox-tmvlv.ondigitalocean.app/api/guest/id"
    );

    const guestId = res.data?.data?.guest_id;
    if (!guestId) return null; // falla silencioso, no crash

    await storage.setItem(GUEST_ID_KEY, guestId);
    return guestId;
  } catch (error) {
    if (__DEV__) console.log("GET GUEST ID ERROR:", error?.message);
    return null; // nunca crashear por esto
  }
};

export const clearGuestId = async () => {
  try {
    await storage.removeItem(GUEST_ID_KEY);
  } catch {
    // ignorar
  }
};