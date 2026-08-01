import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const getNotifications = async ({
  unreadOnly = false,
  limit = 20,
} = {}) => {
  const response = await client.get("/notifications", {
    params: {
      unread_only: unreadOnly ? "true" : "false",
      limit,
    },
  });

  return unwrap(response);
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await client.patch(`/notifications/${notificationId}/read`);
  return unwrap(response);
};

export const markAllNotificationsAsRead = async () => {
  const response = await client.patch("/notifications/read-all");
  return unwrap(response);
};

export const savePushToken = async (pushToken) => {
  if (!pushToken) return;
  const response = await client.put("/notifications/push-token", { push_token: pushToken });
  return unwrap(response);
};