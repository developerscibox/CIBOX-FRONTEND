import { useMemo, useState } from "react";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";
import useAuthStore from "../store/authStore";

// A esta pantalla se llega después de que Transbank confirmó el pago: cuando
// el cliente la ve, la plata ya está cobrada y el pedido entra a preparación.
// Por eso aquí no queda nada por pagar ni nada que mostrar en una caja.

export default function OrderSuccessScreen({ route, navigation }) {
  const params = route.params || {};
  const { token } = useAuthStore();
  const isGuest = !token;
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800; // ← igual que AppStack

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

  // Folio corto: los últimos 6 del identificador. Es LO ÚNICO que le queda a
  // quien compró sin cuenta para volver a encontrar su pedido, así que aquí
  // tiene que estar a la vista y poder copiarse de un toque.
  const folio = orderId ? String(orderId).slice(-6).toUpperCase() : null;
  const [copiado, setCopiado] = useState(false);

  const copiarFolio = async () => {
    if (!folio) return;
    try {
      await Clipboard.setStringAsync(folio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Si el navegador no deja copiar, el número igual está seleccionable.
    }
  };

  // El invitado no tiene "Mis pedidos": su camino de vuelta es el seguimiento
  // público. Le llevamos el folio ya escrito para que solo ponga su correo.
  const goToTracking = () => {
    navigation.navigate("TrackOrder", folio ? { folio } : undefined);
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
            ? "Recibimos tu pago y tu pedido. Te enviamos un correo con el resumen y te avisamos cuando salga a reparto."
            : "Tu pago fue aprobado y tu pedido está en preparación. Revisa tu correo para ver el resumen y las actualizaciones."}
        </AppText>

        {/* Folio corto: la referencia con la que el cliente nos escribe si
            necesita algo de su pedido, y con la que lo sigue si compró sin
            cuenta. Por eso lleva botón de copiar y no solo texto seleccionable:
            si se pierde, al invitado no le queda ningún otro camino de vuelta. */}
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
              #{folio}
            </AppText>

            <Pressable
              onPress={copiarFolio}
              style={({ hovered, pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: colors.primary,
                backgroundColor: hovered || pressed ? colors.background : "transparent",
              })}
            >
              <Ionicons
                name={copiado ? "checkmark" : "copy-outline"}
                size={15}
                color={colors.primary}
              />
              <AppText weight="bold" style={{ color: colors.primary, fontSize: 13 }}>
                {copiado ? "Copiado" : "Copiar número"}
              </AppText>
            </Pressable>

            <AppText
              style={{
                color: colors.muted,
                fontSize: 12.5,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 17,
              }}
            >
              {isGuest
                ? "Guárdalo: con este número y tu correo puedes ver en qué va tu pedido cuando quieras."
                : "Tenlo a mano si nos escribes"}
            </AppText>
          </View>
        ) : null}

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
          <AppText style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
            Pago aprobado con tarjeta. Preparamos tu pedido y lo despachamos a
            la dirección que nos diste.
          </AppText>

          <AppText style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {isGuest
              ? "Te escribimos por correo cuando salga a reparto. Compraste sin cuenta, así que para volver a ver tu pedido usa “Seguir mi pedido” con el número de arriba y tu correo."
              : "Te escribimos por correo cuando salga a reparto. El detalle de tu pedido, con la dirección de entrega, queda en “Mis pedidos”."}
          </AppText>
        </View>

        {!isGuest && orderId ? (
          <AppButton
            title="Ver mi orden"
            onPress={goToOrder}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {/* Al invitado el seguimiento es lo que MÁS le sirve de aquí en adelante,
            así que se lleva el botón primario (lima, según el manual). */}
        {isGuest && orderId ? (
          <AppButton
            title="Seguir mi pedido"
            onPress={goToTracking}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <AppButton
          title="Volver al inicio"
          variant={isGuest && !orderId ? "primary" : "secondary"}
          onPress={goToInicio}
        />
      </View>
    </ScreenContainer>
  );
}