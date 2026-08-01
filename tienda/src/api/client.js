import axios from "axios";
import { Platform } from "react-native";
import useAuthStore from "../store/authStore";
import { getGuestId } from "../utils/guestId";

const client = axios.create({
 baseURL: process.env.EXPO_PUBLIC_API_URL,
  //baseURL: "http://localhost:3001/api",
  //baseURL: "https://backend-app-cibox-tmvlv.ondigitalocean.app/api"
  // Envía la cookie httpOnly del refresh token (b12_rt) en producción
  // same-site/HTTPS. En dev cross-origin la cookie no viaja y el refresh cae al
  // body (fallback), sin romper el desarrollo local.
  withCredentials: true,
});

client.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().token;
    const guestId = await getGuestId();
    config.headers = config.headers || {};
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (guestId) config.headers["x-guest-id"] = guestId;
    // Permite al backend saber si el refresh token debe viajar por body (nativo)
    // o solo por cookie httpOnly (web de producción → mitiga robo por XSS).
    config.headers["x-client-platform"] = Platform.OS;
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const url = originalRequest?.url || "";

    // Si el refresh mismo falla, logout y salir
    if (status === 401 && url.includes("/auth/refresh")) {
      await useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    // Si es 401 en cualquier otra ruta, intentar renovar
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { refreshToken, user } = useAuthStore.getState();

        // El backend renueva la sesión con la cookie httpOnly (b12_rt) gracias a
        // withCredentials. El refreshToken del store es solo un fallback (dev
        // cross-origin donde la cookie no viaja); lo enviamos en el body si existe.
        const res = await client.post(
          "/auth/refresh",
          refreshToken ? { refreshToken } : {},
        );
        const newToken = res.data?.data?.accessToken;
        const newRefresh = res.data?.data?.refreshToken;

        await useAuthStore.getState().setAuth({
          user,
          token: newToken,
          refreshToken: newRefresh,
        });

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;