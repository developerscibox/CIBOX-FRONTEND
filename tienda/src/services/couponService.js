import client from "../api/client";

export const getCheckoutCouponPreview = async ({ subtotal }) => {
  const response = await client.post("/coupons/checkout-preview", {
    subtotal,
  });

  return response.data?.data || response.data;
};

export const validateCouponCode = async ({ code, subtotal }) => {
  const response = await client.post("/coupons/validate", { code, subtotal });
  return response.data?.data || response.data;
};