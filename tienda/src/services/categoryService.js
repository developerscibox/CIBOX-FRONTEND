import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const getCategories = async () => {
  const response = await client.get("/categories", {
    params: { limit: 100 },
  });

  return response.data?.data?.items || [];
};

export const getFeaturedCategories = async () => {
  const response = await client.get("/categories", {
    params: { is_featured: true },
  });
  return unwrap(response);
};

export const getCategoriesTree = async () => {
  const response = await client.get("/categories", {
    params: { tree: true },
  });

  return response.data?.data?.categories || [];
};