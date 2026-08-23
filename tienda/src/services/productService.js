import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

// La tienda NO muestra lo que no hay en bodega. Todos los listados van con
// `in_stock: true`, que en el backend filtra por DISPONIBLE (stock − reservado
// − asignado) > 0, así que tampoco aparece lo que ya está comprometido en
// pedidos sin despachar.
//
// Va forzado al final del objeto, después de `...params`: si se pusiera antes,
// una pantalla que mande `in_stock: undefined` lo borraría sin querer.
// Se aplica solo a los LISTADOS: la ficha individual (`getProductById`) sigue
// abriendo aunque el producto se haya agotado, para no romper enlaces
// compartidos ni el historial de pedidos, y `getMyProducts` es del panel del
// vendedor, que necesita ver también lo agotado para reponerlo.
const soloConStock = (params = {}) => ({ ...params, in_stock: true });

export const getProducts = async (params = {}) => {
  const response = await client.get("/products", { params: soloConStock(params) });
  return unwrap(response);
};

export const getProductById = async (productId) => {
  const response = await client.get(`/products/${productId}`);
  return unwrap(response);
};

export const getFeaturedProducts = async (params = {}) => {
  const response = await client.get("/products/featured", {
    params: soloConStock({ limit: 8, ...params }),
  });
  return unwrap(response);
};

export const getTopRatedProducts = async (params = {}) => {
  const response = await client.get("/products", {
    params: soloConStock({ sort: "rating", limit: 8, ...params }),
  });
  return unwrap(response);
};

export const getRecommendedProducts = async (params = {}) => {
  const response = await client.get("/products/recommended", { params: soloConStock(params) });
  return unwrap(response);
};

/**
 * Productos relacionados: otros de la misma categoría, sin el que se está viendo.
 *
 * ANTES ignoraba el productId y pedía el listado genérico /products, cuya
 * respuesta es { items, pagination }. La ficha, en cambio, leía
 * `data.related_products`, un campo que ese endpoint nunca devuelve: la lista
 * quedaba siempre vacía y la sección entera desaparecía de todas las fichas.
 *
 * No hay endpoint de relacionados en el backend, así que se arma con el listado
 * filtrando por categoría y se devuelve en la forma que la ficha espera.
 */
export const getRelatedProducts = async (productId, params = {}) => {
  const { categoryId, limit = 8, ...resto } = params;
  const response = await client.get("/products", {
    params: soloConStock({ limit: limit + 1, ...(categoryId ? { category: categoryId } : {}), ...resto }),
  });
  const data = unwrap(response);
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    ...data,
    related_products: items
      .filter((p) => String(p?._id) !== String(productId))
      .slice(0, limit),
  };
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
