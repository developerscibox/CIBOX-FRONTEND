import { View, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout from "../components/InfoPageLayout";
import MapEmbed, { BODEGA_ADDRESS } from "../components/MapEmbed";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "../components/AppText";

import brand from "../constants/brand";
const PHONE = brand.contact.phone;
const WHATSAPP_URL = "https://wa.me/56932445772";

function InfoRow({ icon, children, onPress }) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 2 }} />
      <AppText style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 }}>
        {children}
      </AppText>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export default function StoresScreen() {
  return (
    <InfoPageLayout
      title="Nuestras tiendas"
      subtitle={`Desde aquí preparamos y despachamos todos los pedidos de ${brand.name}.`}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}>
        {/* Datos de la tienda */}
        <View
          style={{
            flexGrow: 1,
            flexBasis: 300,
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            ...shadows.card,
          }}
        >
          <AppText style={{ fontSize: 18, fontWeight: "900", color: colors.text, marginBottom: 4 }}>
            {brand.name} — {brand.address.comuna}
          </AppText>
          <AppText style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
            Centro Logístico Mersan
          </AppText>

          <InfoRow icon="location-outline">{BODEGA_ADDRESS}</InfoRow>
          <InfoRow icon="time-outline">Lun a Vie 09:00–18:00 · Sáb 09:00–13:00</InfoRow>
          <InfoRow icon="call-outline" onPress={() => Linking.openURL(WHATSAPP_URL)}>
            {PHONE} (WhatsApp)
          </InfoRow>
          <InfoRow icon="cash-outline">Pago en efectivo o transferencia al retirar</InfoRow>

          <Pressable
            onPress={() => Linking.openURL(WHATSAPP_URL)}
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <AppText style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              Escríbenos por WhatsApp
            </AppText>
          </Pressable>
        </View>

        {/* Minimapa interactivo */}
        <View style={{ flexGrow: 1.2, flexBasis: 340 }}>
          <MapEmbed height={340} />
        </View>
      </View>
    </InfoPageLayout>
  );
}
