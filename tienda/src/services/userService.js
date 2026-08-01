import client from '../api/client';

export const getMyProfile = async () => {
  const response = await client.get("/auth/me");
  return response.data;
};