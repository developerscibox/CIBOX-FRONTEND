import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const getProducts = async (params = {}) => {
  const response = await client.get("/products", { params });
  return unwrap(response);
};

export const getProductById = async (productId) => {
  const response = await client.get(`/products/${productId}`);
  return unwrap(response);
};

export const getFeaturedProducts = async (params = {}) => {
  const response = await client.get("/products/featured", {
    params: { limit: 8, ...params },
  });
  return unwrap(response);
};

export const getTopRatedProducts = async (params = {}) => {
  const response = await client.get("/products", {
    params: { sort: "rating", limit: 8, ...params },
  });
  return unwrap(response);
};

export const getRecommendedProducts = async (params = {}) => {
  const response = await client.get("/products/recommended", { params });
  return unwrap(response);
};

export const getRelatedProducts = async (productId, params = {}) => {
  const response = await client.get("/products", {
    params: { limit: 8, ...params },
  });
  return unwrap(response);
};

export const getMyProducts = async (params = {}) => {
  const response = await client.get("/products/mine", { params });
  return unwrap(response);
};

export const createProduct = async (payload) => {
  const response = await client.post("/products", payload);
  return unwrap(response);
};

export const updateProduct = async (productId, payload) => {
  const response = await client.patch(`/products/${productId}`, payload);
  return unwrap(response);
};

export const deactivateMyProduct = async (productId) => {
  const response = await client.patch(`/products/${productId}/toggle-active`);
  return unwrap(response);
};

export const reactivateMyProduct = async (productId) => {
  const response = await client.patch(`/products/${productId}/toggle-active`);
  return unwrap(response);
};

export const updateMyProductStock = async (productId, stock) => {
  const response = await client.patch(`/products/${productId}`, { stock });
  return unwrap(response);
};
