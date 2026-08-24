import { Platform } from "react-native";
import client from "../api/client";

export const createOrderFromCart = async (payload) => {
  const response = await client.post("/orders/from-cart", payload);
  return response.data;
};

export const createWebpayTransaction = async ({
  orderId,
  platform,
  guestToken,
}) => {
  const response = await client.post("/payments/webpay/create", {
    orderId,
    platform,
    guestToken,
  });

  const payload = response?.data?.data || response?.data || {};

  return {
    orderId: payload.orderId || orderId,
    paymentToken: payload.paymentToken || payload.token || payload.token_ws,
    paymentUrl: payload.paymentUrl || payload.url,
  };
};

export const commitWebpayTransaction = async ({ orderId, token }) => {
  const response = await client.post("/payments/webpay/commit", {
    orderId,
    token,
  });
  return response.data;
};

export const getMyOrders = async () => {
  const response = await client.get("/orders/me");
  return response.data;
};

export const getOrderById = async (orderId) => {
  const response = await client.get(`/orders/${orderId}`);
  return response.data;
};

// ✅ NUEVO: detalle de invitado
export const getGuestOrderById = async ({ orderId, email }) => {
  const response = await client.get(`/orders/guest/${orderId}`, {
    params: { email },
  });
  return response.data;
};

export const adminGetOrders = async ({ page = 1, limit = 20, status } = {}) => {
  const params = { page, limit };
  if (status) params.status = status;
  const response = await client.get("/orders/admin", { params });
  return response.data?.data || response.data;
};

export const cancelOrder = async (orderId) => {
  const response = await client.post(`/orders/${orderId}/cancel`);
  return response.data;
};

export const retryOrderPayment = async ({ orderId, platform, guestToken }) => {
  const response = await client.post(`/orders/${orderId}/retry-payment`, {
    platform,
    guestToken,
  });
  const payload = response?.data?.data || response?.data || {};
  return {
    orderId: payload.orderId || orderId,
    paymentToken: payload.paymentToken || payload.token,
    paymentUrl: payload.paymentUrl || payload.url,
  };
};

// Datos bancarios para pagar por transferencia (endpoint público).
// Devuelve el texto multilínea o null si no está configurado.
export const getTransferInfo = async () => {
  const response = await client.get("/orders/transfer-info");
  const payload = response?.data?.data || response?.data || {};
  return payload.info || null;
};

// Sube el comprobante de transferencia como multipart (campo "receipt").
// asset = resultado de expo-image-picker (web trae .file, nativo uri/mimeType).
export const uploadTransferReceipt = async ({ orderId, asset, guestToken }) => {
  const formData = new FormData();

  if (Platform.OS === "web") {
    if (asset?.file) {
      formData.append("receipt", asset.file);
    } else {
      // Fallback web: el picker entrega data/blob URI → convertir a Blob.
      const blob = await (await fetch(asset.uri)).blob();
      formData.append("receipt", blob, asset.fileName || "comprobante.jpg");
    }
  } else {
    formData.append("receipt", {
      uri: asset.uri,
      name: asset.fileName || `comprobante_${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  }

  if (guestToken) formData.append("guestToken", guestToken);

  const response = await client.post(
    `/orders/${orderId}/transfer-receipt`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
};

export const adminUpdateOrderStatus = async (orderId, { status, tracking_number, note }) => {
  const response = await client.patch(`/orders/admin/${orderId}/status`, {
    status,
    tracking_number,
    note,
  });
  return response.data;
};
/**
 * Seguimiento del pedido. El backend arma la línea de tiempo desde la máquina
 * de estados (pedidos/estados.js), así que la app NO duplica esa lógica: solo
 * la pinta. `guestToken` permite seguir un pedido hecho sin cuenta.
 */
export const getOrderTracking = async (orderId, guestToken = null) => {
  const { data } = await api.get(`/tracking/orders/${orderId}`, {
    params: guestToken ? { token: guestToken } : undefined,
  });
  return data?.data ?? data;
};
