import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import useAuthStore from "../store/authStore";
import { savePushToken } from "../services/notificationService";

// Configuración global: muestra la notif incluso si la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Hook que:
 * 1. Pide permiso de notificaciones al usuario
 * 2. Obtiene el Expo Push Token y lo guarda en el backend
 * 3. Escucha notificaciones en foreground (las muestra)
 * 4. Escucha tap en notificaciones → navega a la pantalla correcta
 *
 * Uso: llamar en App.js o en el componente raíz de navegación.
 * Recibe `navigationRef` para poder navegar desde fuera del navigator.
 */
export function usePushNotifications(navigationRef) {
  const { token: authToken } = useAuthStore();
  const notifListener = useRef(null);
  const responseListener = useRef(null);
  const registered = useRef(false);

  useEffect(() => {
    // Solo funciona en iOS/Android (no en web)
    if (Platform.OS === "web") return;
    // Solo si el usuario está logueado
    if (!authToken) return;
    // Evitar registros duplicados
    if (registered.current) return;

    registered.current = true;
    registerForPushNotifications();

    // Escucha notificaciones que llegan mientras la app está abierta
    notifListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Solo log en dev; puedes añadir lógica extra aquí (badge, etc.)
        console.log("[Push] Notificación recibida:", notification.request.content.title);
      },
    );

    // Escucha cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data || {};
        handleNotificationTap(data, navigationRef);
      },
    );

    return () => {
      registered.current = false;
      if (notifListener.current) {
        Notifications.removeNotificationSubscription(notifListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [authToken]);

  return null;
}

// ── Registro del dispositivo ────────────────────────────────────────────────
async function registerForPushNotifications() {
  try {
    // Verificar / solicitar permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permisos denegados — no se registra token");
      return;
    }

    // Obtener el Expo Push Token (requiere projectId del app.json)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "2cd33dc1-3ac6-47c5-a492-4fec8572d82b",
    });

    const pushToken = tokenData.data;
    console.log("[Push] Token obtenido:", pushToken);

    // Guardar en el backend
    await savePushToken(pushToken);
    console.log("[Push] Token guardado en backend ✓");
  } catch (err) {
    console.log("[Push] Error en registro:", err?.message);
  }
}

// ── Navegación al tocar notificación ───────────────────────────────────────
function handleNotificationTap(data, navigationRef) {
  if (!navigationRef?.current) return;

  try {
    if (data?.orderId) {
      navigationRef.current.navigate("OrderDetail", { orderId: data.orderId });
      return;
    }
    // Agrega más casos según necesites:
    // if (data?.productId) navigationRef.current.navigate("ProductDetail", { productId: data.productId });
  } catch (err) {
    console.log("[Push] Error al navegar:", err?.message);
  }
}
