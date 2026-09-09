import client from "../api/client";

export const loginRequest = async ({ email, password }) => {
  const response = await client.post("/auth/login", {
    email,
    password,
  });

  return response.data;
};

// Cierra la sesión también en el servidor: revoca el refresh token y borra la
// cookie httpOnly. Antes el logout solo limpiaba el almacenamiento local y el
// refresh de siete días seguía vivo en el servidor (y en la cookie).
export const logoutRequest = async () => {
  // `_retry: true` es la marca que el interceptor de client.js usa para no
  // volver a intentar: sin ella, un logout con el access token vencido recibe
  // 401, entra a la cola de refresh, y si es el propio refresh el que falló y
  // llamó a logout, los dos se esperan mutuamente para siempre.
  const response = await client.post("/auth/logout", {}, { _retry: true });
  return response.data;
};

// Renueva el access token con la cookie httpOnly. Se usa al cargar la app en
// web: ahí el access token no se persiste (solo el usuario), así que sin esto
// cada recarga dejaba al cliente "deslogueado" aunque la cookie de 90 días
// siguiera viva. `_retry: true` evita que el interceptor lo encole.
export const refreshRequest = async () => {
  const response = await client.post("/auth/refresh", {}, { _retry: true });
  return response.data;
};

export const registerRequest = async (payload) => {
  const response = await client.post("/auth/register", payload);
  return response.data;
};

export const forgotPasswordRequest = async ({ email }) => {
  const response = await client.post("/auth/forgot-password", { email });
  return response.data;
};

export const resetPasswordRequest = async ({ token, password }) => {
  const response = await client.post("/auth/reset-password", {
    token,
    password,
  });
  return response.data;
};

export const resendVerificationRequest = async ({ email }) => {
  const response = await client.post("/auth/resend-verification", { email });
  return response.data;
};

export const verifyEmailRequest = async (token) => {
  const response = await client.get("/auth/verify-email", {
    params: { token },
  });
  return response.data;
};
