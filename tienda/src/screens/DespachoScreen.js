import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout, { InfoCard, SectionHeading } from "../components/InfoPageLayout";
import MapEmbed from "../components/MapEmbed";
import { addressText, openingHours } from "../constants/brand";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";

const ICON = require("../../assets/home/qa-despacho-pronto.png");

export default function DespachoScreen() {
  return (
    <InfoPageLayout
      title="Despacho y retiro"
      subtitle="Te llevamos tu compra a la puerta. También puedes retirarla en nuestra bodega si prefieres."
      icon={ICON}
    >
      {/* Retiro en bodega — el método disponible hoy */}
      <SectionHeading>Retiro gratis en bodega</SectionHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <InfoCard
            icon={<Ionicons name="location-outline" size={22} color={colors.primary} />}
            title="Dónde retirar"
            desc={addressText("Estamos definiendo la ubicación de la bodega. Te avisamos apenas esté lista.")}
          />
        </View>
        {openingHours() ? (
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <InfoCard
              icon={<Ionicons name="time-outline" size={22} color={colors.primary} />}
              title="Horario"
              desc={openingHours()}
            />
          </View>
        ) : null}
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <InfoCard
            icon={<Ionicons name="cash-outline" size={22} color={colors.primary} />}
            title="Pago al retirar"
            desc="Efectivo o transferencia bancaria. Te avisamos cuando tu pedido esté listo."
          />
        </View>
      </View>

      <MapEmbed height={300} />

      {/* Despacho a domicilio — teaser próximamente */}
      <SectionHeading>Despacho a domicilio</SectionHeading>
      <View
        style={{
          backgroundColor: `${colors.primary}0E`,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
          padding: spacing.lg,
          alignItems: "center",
        }}
      >
        <View
          style={{
            alignSelf: "center",
            backgroundColor: colors.primary,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 5,
            marginBottom: 12,
          }}
        >
          <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 }}>
            🚚 PRÓXIMAMENTE
          </AppText>
        </View>
        <AppText
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: colors.text,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          Estamos preparando el despacho a domicilio
        </AppText>
        <AppText
          style={{
            fontSize: 14,
            color: colors.muted,
            textAlign: "center",
            lineHeight: 21,
            maxWidth: 560,
          }}
        >
          Pronto vas a poder recibir tus cajas en la puerta de tu negocio o tu hogar.
          Estamos definiendo zonas de cobertura, costos y tiempos de entrega. Mientras
          tanto, puedes comprar online y retirar gratis en bodega.
        </AppText>
      </View>
    </InfoPageLayout>
  );
}
