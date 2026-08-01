import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { colors, radius, spacing, shadows } from "../constants/theme";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationService";
import useAuthStore from "../store/authStore";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "../components/AppText";

export default function NotificationsScreen({ navigation }) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;

  // En web desktop la ruta del catálogo es "Inicio"; en nativo es "MainTabs".
  const goToCatalog = () =>
    isWebDesktop
      ? navigation.navigate("Inicio")
      : navigation.navigate("MainTabs", { screen: "Inicio" });

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(!!token);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await getNotifications({
        unreadOnly: activeFilter === "unread",
        limit: 50,
      });
      setNotifications(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(data?.unread_count ?? 0);
    } catch (error) {
      console.log(
        "GET NOTIFICATIONS ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, token]);

  const handleNotificationPress = async (item) => {
    if (!token) {
      navigation.navigate("Auth");
      return;
    }

    // Marcar como leída si no lo está (sin esperar, para que la navegación sea instantánea)
    if (!item.is_read) {
      markNotificationAsRead(item._id)
        .then(() => fetchNotifications())
        .catch(() => {});
    }

    // Navegar según el tipo de notificación
    const orderId = item?.data?.orderId;
    if (orderId) {
      navigation.navigate("OrderDetail", { orderId });
    }
  };

  const handleMarkAll = async () => {
    if (!token) {
      navigation.navigate("Auth");
      return;
    }

    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead();
      await fetchNotifications();
    } catch (error) {
      console.log(
        "MARK ALL NOTIFICATIONS ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudieron marcar todas");
    } finally {
      setMarkingAll(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  };

  const renderNotification = ({ item }) => {
    const title = item?.title || item?.type || "Notificación";
    const message = item?.body || item?.message || "Sin detalle";
    const isRead = item?.is_read;
    const createdAt = item?.created_at
      ? new Date(item.created_at).toLocaleString()
      : "";

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={{
          ...cardStyle,
          backgroundColor: isRead ? colors.surface : "#f3f4f6",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <AppText
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.text,
              flex: 1,
              marginRight: 12,
            }}
          >
            {title}
          </AppText>

          {!isRead ? (
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Nueva
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText
          style={{
            color: colors.muted,
            marginBottom: 8,
            lineHeight: 20,
          }}
        >
          {message}
        </AppText>

        <AppText style={{ color: colors.muted, fontSize: 12 }}>
          {createdAt}
        </AppText>
      </Pressable>
    );
  };

  if (!token) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.lg,
              ...shadows.card,
            }}
          >
            <AppText
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text,
                textAlign: "center",
                marginBottom: spacing.sm,
              }}
            >
              Inicia sesión para ver tus notificaciones
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: spacing.lg,
              }}
            >
              Aquí verás novedades importantes sobre tus compras, tu cuenta y el
              estado de tus pedidos.
            </AppText>

            <AppButton
              title="Iniciar sesión"
              onPress={() => navigation.navigate("Auth")}
            />

            <AppButton
              title="Volver al catálogo"
              onPress={goToCatalog}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (loading) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: spacing.sm, color: colors.muted }}>
            Cargando notificaciones...
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={720}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderNotification}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <AppText
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              Notificaciones
            </AppText>

            <AppText style={{ color: colors.muted, marginBottom: spacing.md }}>
              No leídas: {unreadCount}
            </AppText>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Pressable
                onPress={() => setActiveFilter("all")}
                style={{
                  backgroundColor:
                    activeFilter === "all" ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                  marginRight: 10,
                }}
              >
                <AppText
                  style={{
                    color:
                      activeFilter === "all"
                        ? colors.primaryText
                        : colors.primary,
                    fontWeight: "700",
                  }}
                >
                  Todas
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => setActiveFilter("unread")}
                style={{
                  backgroundColor:
                    activeFilter === "unread" ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                }}
              >
                <AppText
                  style={{
                    color:
                      activeFilter === "unread"
                        ? colors.primaryText
                        : colors.primary,
                    fontWeight: "700",
                  }}
                >
                  No leídas
                </AppText>
              </Pressable>
            </View>

            <AppButton
              title={markingAll ? "Marcando..." : "Marcar todas como leídas"}
              onPress={handleMarkAll}
              disabled={markingAll || unreadCount === 0}
            />
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              paddingVertical: spacing.xl,
              alignItems: "center",
            }}
          >
            <AppText
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              No hay notificaciones
            </AppText>
            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                maxWidth: 420,
              }}
            >
              Cuando ocurran eventos importantes, aparecerán aquí.
            </AppText>
          </View>
        }
      />
    </ScreenContainer>
  );
}
