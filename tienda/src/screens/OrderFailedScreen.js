import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import AppText from "../components/AppText";
import { colors, radius, spacing, shadows } from "../constants/theme";
import { retryOrderPayment } from "../services/orderService";
import { showAppAlert } from "../utils/appAlerts";

export default function OrderFailedScreen({ route, navigation }) {
  const params = route.params || {};
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;
  const [retrying, setRetrying] = useState(false);

  const orderId = useMemo(() => {
    if (params.orderId) return params.orderId;
    if (Platform.OS === "web") {
      const search = new URLSearchParams(window.location.search);
      return search.get("orderId") || null;
    }
    return null;
  }, [params.orderId]);

  const status = useMemo(() => {
    if (params.status) return params.status;
    if (Platform.OS === "web") {
      const search = new URLSearchParams(window.location.search);
      return search.get("status") || "rejected";
    }
    return "rejected";
  }, [params.status]);

  const isCancelled = status === "cancelled";

  const goHome = () => {
    const home = isWebDesktop ? "Inicio" : "MainTabs";
    try {
      navigation.reset({ index: 0, routes: [{ name: home }] });
    } catch {
      navigation.navigate(home);
    }
  };

  const goToOrder = () => {
    if (!orderId) return;
    try {
      navigation.navigate("OrderDetail", { orderId });
    } catch {
      const home = isWebDesktop ? "Inicio" : "MainTabs";
      navigation.reset({
        index: 0,
        routes: [
          { name: home },
          { name: "OrderDetail", params: { orderId } },
        ],
      });
    }
  };

  const handleRetry = async () => {
    if (!orderId) {
      showAppAlert("Sin orden", "No se encontró el ID de la orden para reintentar.");
      return;
    }
    try {
      setRetrying(true);
      const payment = await retryOrderPayment({
        orderId,
        platform: Platform.OS === "web" ? "web" : Platform.OS,
      });

      if (!payment?.paymentToken || !payment?.paymentUrl) {
        showAppAlert("Error", "No se pudo generar el link de pago. Intenta desde el detalle de tu orden.");
        return;
      }

      navigation.replace("Webpay", {
        orderId,
        paymentToken: payment.paymentToken,
        paymentUrl: payment.paymentUrl,
      });
    } catch (error) {
      showAppAlert(
        "Error al reintentar",
        error?.response?.data?.message || "No se pudo reintentar el pago. Intenta desde el detalle de tu orden.",
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <ScreenContainer maxWidth={520}>
      <View style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xl }}>

        {/* Ícono */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: isCancelled ? `${colors.accent}18` : `${colors.danger}12`,
            borderWidth: 2,
            borderColor: isCancelled ? `${colors.accent}35` : `${colors.danger}25`,
            justifyContent: "center",
            alignItems: "center",
          }}>
            <Ionicons
              name={isCancelled ? "close-circle-outline" : "alert-circle-outline"}
              size={48}
              color={isCancelled ? colors.accent : colors.danger}
            />
          </View>
        </View>

        {/* Título y descripción */}
        <AppText style={{
          fontSize: 26,
          fontWeight: "900",
          color: colors.text,
          textAlign: "center",
          marginBottom: 10,
        }}>
          {isCancelled ? "Pago cancelado" : "Pago no completado"}
        </AppText>

        <AppText style={{
          fontSize: 14,
          color: colors.muted,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: 32,
          paddingHorizontal: 16,
        }}>
          {isCancelled
            ? "Cancelaste el proceso de pago. Tu orden sigue pendiente — puedes intentarlo nuevamente cuando quieras."
            : "No se pudo completar el pago. Tu orden sigue pendiente y no se realizó ningún cobro."}
        </AppText>

        {/* Acciones */}
        <View style={{ gap: 12 }}>

          {/* Reintentar pago — acción principal */}
          {orderId && (
            <Pressable
              onPress={handleRetry}
              disabled={retrying}
              style={({ pressed }) => ({
                backgroundColor: pressed || retrying ? `${colors.primary}CC` : colors.primary,
                borderRadius: radius.lg,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                ...shadows.card,
              })}
            >
              {retrying
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="refresh-outline" size={20} color="#fff" />
              }
              <AppText style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {retrying ? "Generando link de pago..." : "Reintentar pago"}
              </AppText>
            </Pressable>
          )}

          {/* Ver detalle de la orden */}
          {orderId && (
            <Pressable
              onPress={goToOrder}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.border : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              })}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.text} />
              <AppText style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                Ver detalle de la orden
              </AppText>
            </Pressable>
          )}

          {/* Volver al inicio */}
          <Pressable
            onPress={goHome}
            style={{ alignItems: "center", paddingVertical: 12 }}
          >
            <AppText style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
              Volver al inicio
            </AppText>
          </Pressable>
        </View>

        {/* Nota de seguridad */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 32,
          backgroundColor: `${colors.primary}08`,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: `${colors.primary}18`,
          padding: spacing.md,
        }}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <AppText style={{ fontSize: 12, color: colors.muted, flex: 1, lineHeight: 18 }}>
            No se realizó ningún cobro. Tu orden queda en estado pendiente hasta que completes el pago.
          </AppText>
        </View>

      </View>
    </ScreenContainer>
  );
}
