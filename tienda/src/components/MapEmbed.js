import React from "react";
import { Platform, Pressable, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import AppText from "./AppText";

// Dirección real de la bodega (Centro Logístico Mersan, Lo Espejo).
export const BODEGA_ADDRESS =
  "Av. Lo Espejo 01565, Patio 6, Bodega 826, Lo Espejo, Santiago, Chile";

const Q = encodeURIComponent(BODEGA_ADDRESS);
// Embed clásico de Google Maps: NO requiere API key (sirve en iframe).
const EMBED_URL = `https://maps.google.com/maps?q=${Q}&z=16&output=embed`;
// Deep link de navegación (abre la ruta en Google Maps / app móvil).
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${Q}`;

/**
 * Minimapa de la tienda. En web embebe Google Maps (iframe, sin API key); en
 * nativo muestra un botón que abre el mapa. Siempre incluye "Cómo llegar".
 */
export default function MapEmbed({ height = 320 }) {
  const openDirections = () => Linking.openURL(DIRECTIONS_URL);

  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {Platform.OS === "web" ? (
        // RNW renderiza a DOM: createElement('iframe') es válido en web.
        React.createElement("iframe", {
          src: EMBED_URL,
          title: "Mapa Bodega 12",
          loading: "lazy",
          referrerPolicy: "no-referrer-when-downgrade",
          style: { width: "100%", height, border: 0, display: "block" },
        })
      ) : (
        <Pressable
          onPress={openDirections}
          style={{
            height,
            backgroundColor: `${colors.primary}10`,
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="map" size={42} color={colors.primary} />
          <AppText style={{ color: colors.primary, fontWeight: "800" }}>
            Toca para ver el mapa
          </AppText>
        </Pressable>
      )}

      <Pressable
        onPress={openDirections}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 13,
          backgroundColor: colors.primary,
        }}
      >
        <Ionicons name="navigate" size={18} color="#fff" />
        <AppText style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
          Cómo llegar
        </AppText>
      </Pressable>
    </View>
  );
}
