import client from '../api/client';

export const getReviewsByProduct = async (productId) => {
  const response = await client.get(`/reviews/product/${productId}`);
  return response.data;
};

export const getMyReviewByProduct = async (productId) => {
  const response = await client.get(`/reviews/product/${productId}/me`);
  return response.data;
};

export const createReview = async ({ productId, rating, comment }) => {
  const response = await client.post('/reviews', {
    productId,
    rating,
    comment,
  });
  return response.data;
};

export const updateMyReview = async ({ productId, rating, comment }) => {
  const response = await client.put(`/reviews/product/${productId}`, {
    rating,
    comment,
  });
  return response.data;
};

export const deleteMyReview = async (productId) => {
  const response = await client.delete(`/reviews/product/${productId}`);
  return response.data;
};