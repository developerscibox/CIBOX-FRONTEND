import { useEffect } from "react";
import { Image, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import AppText from "./AppText";
import useBienvenidaStore from "../store/bienvenidaStore";
import { colors, shadows, spacing } from "../constants/theme";

import brand from "../constants/brand";

// Degradado de marca de Cibox (verde profundo → verde → lima), el mismo que usan
// la portada y el bloque de ofertas.
const GRAD = ["#3E7D1E", "#4E9B27", "#C3E062"];
// Sobre el verde va el logo en blanco: el logo a color es lima y sobre este
// fondo se pierde (queda en 1:1 de contraste).
const LOGO = require("../../assets/logo-cibox-blanco.png");

/**
 * Ventana de bienvenida del relanzamiento.
 *
 * Sale una sola vez por dispositivo, encima de cualquier pantalla, y lleva al
 * cliente a los productos rebajados. Va montada en la raíz de la navegación
 * (`navigation/index.js`), dentro del gate de tienda pausada.
 *
 * Convive con el tour de bienvenida: mientras este aviso está en pantalla, el
 * tour se queda esperando. Dos ventanas superpuestas al entrar es la forma más
 * rápida de que el cliente cierre todo sin leer nada.
 */
export default function AvisoRelanzamiento({ navigationRef }) {
  const visto = useBienvenidaStore((s) => s.visto);
  const cargado = useBienvenidaStore((s) => s.cargado);
  const cerrarAviso = useBienvenidaStore((s) => s.cerrarAviso);
  const { width } = useWindowDimensions();

  useEffect(() => {
    useBienvenidaStore.getState().cargarAviso();
  }, []);

  if (!cargado || visto) return null;

  const esAngosto = width < 620;

  const irAOfertas = () => {
    cerrarAviso();
    try {
      navigationRef?.current?.navigate?.("Products", { preset: "liquidation" });
    } catch {}
  };

  // En web el overlay va fixed para cubrir el viewport completo aunque la página
  // esté scrolleada (mismo criterio que WelcomeTour y BrandBackdrop).
  const posicion = Platform.OS === "web" ? { position: "fixed" } : { position: "absolute" };

  return (
    <View
      style={[
        posicion,
        {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(17,24,17,0.62)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.md,
          zIndex: 1000,
        },
      ]}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: colors.surface,
          ...shadows.card,
        }}
      >
        {/* Cabecera de marca: degradado, logo en blanco y los círculos que la
            portada usa como firma visual. */}
        <LinearGradient
          colors={GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: esAngosto ? 26 : 32, paddingBottom: esAngosto ? 22 : 28, paddingHorizontal: 24, alignItems: "center" }}
        >
          <View
            pointerEvents="none"
            style={{ position: "absolute", right: -34, top: -34, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.14)" }}
          />
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: -30, bottom: -46, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.10)" }}
          />

          <View
            style={{
              width: esAngosto ? 74 : 88,
              height: esAngosto ? 74 : 88,
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}
          >
            <Image
              source={LOGO}
              resizeMode="contain"
              style={{ width: (esAngosto ? 54 : 66) * 0.75, height: esAngosto ? 54 : 66 }}
            />
          </View>

          <View style={{ alignSelf: "center", marginTop: 16, backgroundColor: colors.discount, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 }}>
            <AppText style={{ color: "#7a4d00", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>
              🎉 ESTAMOS DE VUELTA
            </AppText>
          </View>
        </LinearGradient>

        {/* Cuerpo */}
        <View style={{ padding: esAngosto ? 22 : 28 }}>
          <AppText
            style={{
              fontSize: esAngosto ? 22 : 26,
              fontWeight: "900",
              color: colors.text,
              textAlign: "center",
              lineHeight: esAngosto ? 27 : 31,
            }}
          >
            ¡Bienvenido de vuelta a {brand.name}!
          </AppText>

          <AppText
            style={{
              fontSize: 14.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 21,
              marginTop: 10,
            }}
          >
            Volvimos con ofertas imperdibles en abarrotes, bebidas, lácteos y aseo.
            Haz tu compra desde donde estés y nosotros preparamos tu pedido.
          </AppText>

          <Pressable
            onPress={irAOfertas}
            style={{
              marginTop: 22,
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
              Ver ofertas imperdibles
            </AppText>
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </Pressable>

          <Pressable onPress={cerrarAviso} style={{ marginTop: 12, paddingVertical: 10, alignItems: "center" }}>
            <AppText style={{ color: colors.muted, fontWeight: "700", fontSize: 13.5 }}>
              Seguir mirando la tienda
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
