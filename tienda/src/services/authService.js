import client from "../api/client";

export const loginRequest = async ({ email, password }) => {
  const response = await client.post("/auth/login", {
    email,
    password,
  });

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
