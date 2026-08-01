import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const getCart = async () => {
  const response = await client.get("/cart");
  return unwrap(response);
};

export const addItemToCart = async ({ productId, quantity }) => {
  const response = await client.post("/cart/items", {
    productId,
    quantity,
  });
  return unwrap(response);
};

export const updateCartItem = async ({ productId, quantity }) => {
  const response = await client.patch(`/cart/items/${productId}`, {
    quantity,
  });
  return unwrap(response);
};

export const removeCartItem = async (productId) => {
  const response = await client.delete(`/cart/items/${productId}`);
  return unwrap(response);
};

export const clearCartItems = async () => {
  const response = await client.delete("/cart");
  return unwrap(response);
};