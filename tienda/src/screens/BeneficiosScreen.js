import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout, { InfoCard, SectionHeading } from "../components/InfoPageLayout";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";

const ICON = require("../../assets/home/qa-beneficios.png");

const BENEFITS = [
  {
    icon: "cube-outline",
    title: "Compra por caja, paga menos",
    desc: "Precios mayoristas por caja o display. Mientras más llevas, más ahorras frente al supermercado tradicional.",
  },
  {
    icon: "storefront-outline",
    title: "Retiro gratis en bodega",
    desc: "Retira tu pedido sin costo en nuestra bodega de Lo Espejo (Centro Logístico Mersan).",
  },
  {
    icon: "pricetags-outline",
    title: "Precios bajos todos los días",
    desc: "Ofertas y liquidaciones permanentes en abarrotes, bebidas, lácteos, aseo y más.",
  },
  {
    icon: "cash-outline",
    title: "Paga como prefieras",
    desc: "Aceptamos efectivo y transferencia bancaria. Sin complicaciones al momento de retirar.",
  },
  {
    icon: "albums-outline",
    title: "Gran variedad y stock",
    desc: "Miles de productos para tu negocio, almacén o tu hogar, con disponibilidad real en bodega.",
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
      subtitle="Somos tu supermercado mayorista: ahorra comprando por caja y retira en bodega."
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
          "Explora el catálogo y agrega cajas a tu carrito.",
          "Confirma tu pedido online y elige retiro en bodega.",
          "Te avisamos cuando esté listo y pagas al retirar (efectivo o transferencia).",
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
