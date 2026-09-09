import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout, { InfoCard, SectionHeading } from "../components/InfoPageLayout";
import {
  DESPACHO_COMUNAS,
  DESPACHO_REGION,
  comunasEnTexto,
  tarifaEnTexto,
} from "../constants/delivery";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";

const ICON = require("../../assets/home/qa-despacho-pronto.png");

// Esta es la página donde se publica la cobertura: cuando alguien pregunta
// "¿llegan a mi casa?", es el enlace que se le manda. Por eso la lista de
// comunas y la tarifa salen de constants/delivery.js y no están escritas aquí:
// si cambia la zona o el precio, esta página cambia sola.
export default function DespachoScreen() {
  return (
    <InfoPageLayout
      title="Despacho a domicilio"
      subtitle={`Te llevamos el pedido a la puerta en ${comunasEnTexto()}. Tarifa plana de ${tarifaEnTexto()} por pedido.`}
      icon={ICON}
    >
      <SectionHeading>Dónde llegamos</SectionHeading>

      {/* Las comunas, una por tarjeta: es más fácil buscar la propia en una
          grilla que dentro de una frase larga. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {DESPACHO_COMUNAS.map((comuna) => (
          <View
            key={comuna}
            style={{
              flexGrow: 1,
              flexBasis: 140,
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="location" size={18} color={colors.primary} />
            <AppText style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
              {comuna}
            </AppText>
          </View>
        ))}
      </View>

      <AppText
        style={{
          fontSize: 13.5,
          color: colors.muted,
          lineHeight: 20,
          marginBottom: spacing.md,
        }}
      >
        Todas en la {DESPACHO_REGION}. Fuera de estas cuatro comunas todavía no
        podemos despachar: estamos trabajando para llegar a más lugares.
      </AppText>

      <SectionHeading>Cómo funciona</SectionHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <InfoCard
            icon={<Ionicons name="pricetag-outline" size={22} color={colors.primary} />}
            title={`Despacho ${tarifaEnTexto()}`}
            desc="Tarifa plana por pedido: el mismo precio para las cuatro comunas, pidas poco o pidas mucho. Lo ves sumado en el carrito, antes de pagar."
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <InfoCard
            icon={<Ionicons name="card-outline" size={22} color={colors.primary} />}
            title="Pagas con tarjeta"
            desc="Crédito o débito por Webpay Plus de Transbank. El pedido entra a preparación apenas se aprueba el pago."
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <InfoCard
            icon={<Ionicons name="notifications-outline" size={22} color={colors.primary} />}
            title="Te avisamos por correo"
            desc="Cuando tu pedido esté preparado y cuando salga a reparto. También lo sigues desde “Mis pedidos”."
          />
        </View>
      </View>

      <SectionHeading>Antes de comprar</SectionHeading>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
          padding: spacing.lg,
        }}
      >
        <AppText
          style={{
            fontSize: 15,
            color: colors.text,
            lineHeight: 22,
            marginBottom: 6,
          }}
        >
          Al finalizar la compra, lo primero que eliges es tu comuna. Si no está en la
          lista, te lo decimos ahí mismo y no tienes que llenar el resto del
          formulario.
        </AppText>
        <AppText style={{ fontSize: 13.5, color: colors.muted, lineHeight: 20 }}>
          Necesitamos calle y número, y si vives en departamento u oficina, el
          número. Una referencia para llegar (color de la reja, un negocio al
          frente) nos ahorra llamarte.
        </AppText>
      </View>
    </InfoPageLayout>
  );
}
