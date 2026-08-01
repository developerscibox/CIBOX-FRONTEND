import { ScrollView, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import { colors, spacing } from "../constants/theme";

const STEPS = [
  {
    icon: "search-outline",
    title: "1. Explora el catálogo mayorista",
    description:
      "Navega por el catálogo completo. Filtra por categoría o busca directamente lo que necesitas.",
  },
  {
    icon: "cube-outline",
    title: "2. Agrega cajas y packs",
    description:
      "Compra por caja y ahorra: mientras más unidades, mejor precio. Agrega los formatos mayoristas directo al carrito.",
  },
  {
    icon: "card-outline",
    title: "3. Reserva y paga al retirar",
    description:
      "Reserva tu pedido y paga al retirar (efectivo o transferencia). Sin pagos online: confirmas tu compra y cancelas en bodega.",
  },
  {
    icon: "storefront-outline",
    title: "4. Retira en bodega",
    description:
      "Cuando tu pedido esté listo, te avisamos para que lo retires en nuestra bodega. Rápido y sin filas.",
  },
];

export default function HowItWorksScreen({ navigation }) {
  return (
    <ScreenContainer maxWidth={700} padded>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {/* Hero */}
        <View
          style={{
            backgroundColor: `${colors.primary}12`,
            borderRadius: 20,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            alignItems: "center",
            borderWidth: 1,
            borderColor: `${colors.primary}25`,
          }}
        >
          <Ionicons
            name="information-circle"
            size={48}
            color={colors.primary}
            style={{ marginBottom: 12 }}
          />
          <AppText
            style={{
              fontSize: 22,
              fontWeight: "900",
              color: colors.text,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            ¿Cómo funciona Cibox?
          </AppText>
          <AppText
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 21,
            }}
          >
            Tu mayorista de confianza. Compra por caja, ahorra más y retira
            tu pedido directo en nuestra bodega.
          </AppText>
        </View>

        {/* Pasos */}
        {STEPS.map((step, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: spacing.md,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 14,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: `${colors.primary}15`,
                justifyContent: "center",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Ionicons name={step.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {step.title}
              </AppText>
              <AppText
                style={{ fontSize: 13, color: colors.muted, lineHeight: 20 }}
              >
                {step.description}
              </AppText>
            </View>
          </View>
        ))}

        {/* CTA */}
        <Pressable
          onPress={() => navigation.navigate("Products")}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: spacing.md,
          }}
        >
          <AppText
            style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}
          >
            Empezar a comprar →
          </AppText>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}