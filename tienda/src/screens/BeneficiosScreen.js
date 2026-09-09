import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout, { InfoCard, SectionHeading } from "../components/InfoPageLayout";
import { colors, spacing } from "../constants/theme";
import { comunasEnTexto, tarifaEnTexto } from "../constants/delivery";
import AppText from "../components/AppText";

import brand from "../constants/brand";
const ICON = require("../../assets/home/qa-beneficios.png");

const BENEFITS = [
  {
    icon: "cart-outline",
    title: "Todo el supermercado, online",
    desc: "Haz la compra completa desde el celular o el computador, a la hora que quieras. Sin filas ni estacionamiento.",
  },
  {
    icon: "cube-outline",
    title: "Packs con descuento",
    desc: "Varios productos tienen precio especial al llevar el pack completo. Puedes comprar una sola unidad si prefieres.",
  },
  {
    icon: "pricetags-outline",
    title: "Precios bajos todos los días",
    desc: "Ofertas y rebajas permanentes en abarrotes, bebidas, lácteos, aseo y más.",
  },
  {
    icon: "card-outline",
    title: "Pago seguro con tarjeta",
    desc: "Crédito o débito por Webpay Plus de Transbank. Los datos de tu tarjeta los recibe Transbank: nosotros no los vemos ni los guardamos.",
  },
  {
    icon: "albums-outline",
    title: "Gran variedad y stock",
    desc: "Miles de productos para tu hogar, con stock real: si aparece en la web, lo tenemos.",
  },
  {
    icon: "people-outline",
    title: "Atención personalizada",
    desc: "Te ayudamos a armar tu pedido y a aprovechar mejor cada caja. Estamos para ayudarte.",
  },
];

export default function BeneficiosScreen() {
  return (
    <InfoPageLayout
      title="Beneficios de comprar en Cibox"
      subtitle={`Todo el supermercado a un clic: compra online y te lo dejamos en la puerta en ${comunasEnTexto()}.`}
      icon={ICON}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={{ width: "100%", maxWidth: 460, flexGrow: 1, flexBasis: 300 }}>
            <InfoCard
              icon={<Ionicons name={b.icon} size={22} color={colors.primary} />}
              title={b.title}
              desc={b.desc}
            />
          </View>
        ))}
      </View>

      <SectionHeading>¿Cómo funciona?</SectionHeading>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
        }}
      >
        {[
          "Explora el catálogo y agrega productos a tu carrito.",
          `Escribe tu dirección de despacho y paga con tarjeta (despacho ${tarifaEnTexto()}).`,
          "Preparamos tu pedido, te avisamos por correo y te lo llevamos a tu casa.",
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: i < 2 ? 14 : 0 }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AppText style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{i + 1}</AppText>
            </View>
            <AppText style={{ flex: 1, color: colors.text, fontSize: 14.5, lineHeight: 21 }}>
              {step}
            </AppText>
          </View>
        ))}
      </View>
    </InfoPageLayout>
  );
}
