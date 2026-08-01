import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const addFavorite = async (productId) => {
  const response = await client.post("/favorites", { productId });
  return unwrap(response);
};

export const removeFavorite = async (productId) => {
  const response = await client.delete(`/favorites/${productId}`);
  return unwrap(response);
};

export const checkFavorite = async (productId) => {
  const response = await client.get("/favorites/check", {
    params: { productId },
  });
  return unwrap(response);
};

export const getFavorites = async () => {
  const response = await client.get("/favorites");
  return unwrap(response);
};