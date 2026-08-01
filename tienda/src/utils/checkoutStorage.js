import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKOUT_ADDRESS_KEY = "cibox_checkout_address";

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

export const saveCheckoutAddress = async (addressData) => {
  try {
    await storage.setItem(CHECKOUT_ADDRESS_KEY, JSON.stringify(addressData));
  } catch (error) {
    console.log("SAVE CHECKOUT ADDRESS ERROR:", error);
  }
};

export const getCheckoutAddress = async () => {
  try {
    const raw = await storage.getItem(CHECKOUT_ADDRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.log("GET CHECKOUT ADDRESS ERROR:", error);
    return null;
  }
};

export const clearCheckoutAddress = async () => {
  try {
    await storage.removeItem(CHECKOUT_ADDRESS_KEY);
  } catch (error) {
    console.log("CLEAR CHECKOUT ADDRESS ERROR:", error);
  }
};