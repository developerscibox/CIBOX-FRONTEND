import { useMemo } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import TransferPaymentCard from "../components/TransferPaymentCard";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";
import useAuthStore from "../store/authStore";

const PICKUP_ADDRESS =
  "Av. Lo Espejo 01565, Patio 6, Bodega 826, Centro Logístico Mersan, Lo Espejo (2da entrada por Américo Vespucio)";

export default function OrderSuccessScreen({ route, navigation }) {
  const params = route.params || {};
  const { token } = useAuthStore();
  const isGuest = !token;
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800; // ← igual que AppStack

  const paymentMethod = params.paymentMethod || null;
  const committedLabel = params.committedLabel || params.committedDate || null;
  const guestToken = params.guestToken || null;

  const paymentMessage = useMemo(() => {
    if (paymentMethod === "transfer") {
      return "Paga con los datos de transferencia de abajo y sube tu comprobante: tu pedido se confirma al verificar el pago.";
    }
    if (paymentMethod === "cash_on_pickup") {
      return "Paga al retirar en la bodega.";
    }
    return null;
  }, [paymentMethod]);

  const orderId = useMemo(() => {
    if (params.orderId) return params.orderId;
    if (Platform.OS === "web") {
      const search = new URLSearchParams(window.location.search);
      return search.get("orderId") || null;
    }
    return null;
  }, [params.orderId]);

  const goToInicio = () => {
    const home = isWebDesktop ? "Inicio" : "MainTabs"; // ← fix
    try {
      navigation.reset({ index: 0, routes: [{ name: home }] });
    } catch {
      navigation.navigate(home);
    }
  };

  const goToOrder = () => {
    const home = isWebDesktop ? "Inicio" : "MainTabs"; // ← fix
    try {
      navigation.navigate("OrderDetail", { orderId });
    } catch {
      navigation.reset({
        index: 0,
        routes: [
          { name: home },
          { name: "OrderDetail", params: { orderId } },
        ],
      });
    }
  };

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
        <AppText style={{ fontSize: 48, marginBottom: 16 }}>🎉</AppText>

        <AppText
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: colors.text,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          ¡Compra confirmada!
        </AppText>

        <AppText
          style={{
            color: colors.muted,
            marginBottom: 28,
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          {isGuest
            ? "Tu pedido fue recibido. Te enviamos un correo con el resumen de tu compra y te avisaremos cuando esté listo para retiro."
            : "Tu pedido fue creado correctamente. Revisa tu correo para ver el resumen y futuras actualizaciones."}
        </AppText>

        {/* Folio corto: es lo que el cliente muestra en caja al retirar. */}
        {orderId ? (
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              alignItems: "center",
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 16,
              marginBottom: 16,
            }}
          >
            <AppText style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
              Tu folio de pedido
            </AppText>
            <AppText
              selectable
              style={{
                fontSize: 40,
                fontWeight: "800",
                color: colors.text,
                letterSpacing: 3,
              }}
            >
              #{String(orderId).slice(-6).toUpperCase()}
            </AppText>
            <AppText
              style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 4 }}
            >
              Muéstralo en caja al retirar
            </AppText>
          </View>
        ) : null}

        {paymentMessage ? (
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              gap: 8,
            }}
          >
            <AppText
              style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}
            >
              {paymentMessage}
            </AppText>

            {committedLabel ? (
              <AppText
                style={{ color: colors.accent, fontWeight: "800", fontSize: 14 }}
              >
                Retiro comprometido: {committedLabel}
              </AppText>
            ) : null}

            <AppText
              style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}
            >
              📍 {PICKUP_ADDRESS}
            </AppText>
          </View>
        ) : null}

        {/* Transferencia: datos bancarios + subida del comprobante (H1). */}
        {paymentMethod === "transfer" && orderId ? (
          <View style={{ width: "100%", maxWidth: 440 }}>
            <TransferPaymentCard orderId={orderId} guestToken={guestToken} />
          </View>
        ) : null}

        {!isGuest && orderId ? (
          <AppButton
            title="Ver mi orden"
            onPress={goToOrder}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <AppButton
          title="Volver al inicio"
          variant={isGuest ? "primary" : "secondary"}
          onPress={goToInicio}
        />
      </View>
    </ScreenContainer>
  );
}