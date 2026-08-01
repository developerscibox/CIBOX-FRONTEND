import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InfoPageLayout from "../components/InfoPageLayout";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "../components/AppText";

// Ícono 3D "NEWS" de la marca para la sección Blog/Noticias.
const NEWS_ICON = require("../../assets/home/qa-news.png");

// Estructura de artículos (placeholder por ahora; data-driven a futuro).
const POSTS = [
  {
    tag: "Ahorro",
    title: "Cómo comprar por caja y ahorrar todo el mes",
    excerpt: "Guía rápida para armar tu pedido mayorista y aprovechar mejor cada caja.",
  },
  {
    tag: "Bodega 12",
    title: "Novedades y nuevos productos en bodega",
    excerpt: "Te contamos qué llegó esta semana al Centro Logístico Mersan.",
  },
  {
    tag: "Tips",
    title: "Organiza tu despensa y reduce el desperdicio",
    excerpt: "Ideas simples para mantener tu stock ordenado y a mano.",
  },
];

export default function BlogScreen() {
  return (
    <InfoPageLayout
      title="Blog & Noticias"
      subtitle="Consejos para ahorrar, novedades de la bodega y todo lo nuevo en Bodega 12."
      icon={NEWS_ICON}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {POSTS.map((p) => (
          <View
            key={p.title}
            style={{
              flexGrow: 1,
              flexBasis: 280,
              maxWidth: 460,
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              ...shadows.card,
            }}
          >
            {/* Cabecera con el ícono de marca */}
            <View
              style={{
                height: 110,
                backgroundColor: `${colors.primary}10`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="newspaper-outline" size={40} color={colors.primary} />
            </View>
            <View style={{ padding: spacing.md }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: `${colors.primary}14`,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  marginBottom: 8,
                }}
              >
                <AppText style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>
                  {p.tag}
                </AppText>
              </View>
              <AppText style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6 }}>
                {p.title}
              </AppText>
              <AppText style={{ fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
                {p.excerpt}
              </AppText>
              <AppText style={{ fontSize: 12.5, color: colors.primary, fontWeight: "800", marginTop: 12 }}>
                Próximamente →
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          backgroundColor: `${colors.primary}0E`,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: `${colors.primary}33`,
          padding: spacing.lg,
          alignItems: "center",
        }}
      >
        <AppText style={{ fontSize: 15, fontWeight: "800", color: colors.text, textAlign: "center" }}>
          📰 Estamos preparando nuestro blog
        </AppText>
        <AppText
          style={{ fontSize: 13.5, color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 20, maxWidth: 560 }}
        >
          Muy pronto vas a encontrar aquí artículos con ofertas, recetas y consejos para
          aprovechar al máximo tus compras mayoristas.
        </AppText>
      </View>
    </InfoPageLayout>
  );
}
