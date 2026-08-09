import { ScrollView, SafeAreaView, View, Image, Platform } from "react-native";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "./AppText";

/**
 * Layout reutilizable para las páginas de contenido (Beneficios, Despacho,
 * Blog, Nuestras tiendas). Encabezado con ícono + título + subtítulo y cuerpo.
 *
 * Cross-platform: en web la pantalla ya va dentro de WebLayout (que aporta su
 * propio ScrollView), así que aquí usamos un View simple — un ScrollView flex:1
 * anidado colapsaría a 0 de alto. En nativo no hay scroll exterior, así que
 * envolvemos en SafeAreaView + ScrollView propio.
 */
export default function InfoPageLayout({
  title,
  subtitle,
  icon,
  children,
  maxWidth = 980,
}) {
  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginBottom: spacing.lg,
      }}
    >
      {icon ? (
        <Image source={icon} style={{ width: 58, height: 58 }} resizeMode="contain" />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: 30, fontWeight: "900", color: colors.text }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            style={{ fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 21 }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          width: "100%",
          maxWidth,
          alignSelf: "center",
          padding: spacing.lg,
        }}
      >
        {header}
        {children}
      </View>
    );
  }

  // Sin color de fondo: lo pone `App.js` junto con el patrón de marca.
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth, alignSelf: "center" }}>
          {header}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Bloques reutilizables para las páginas de contenido ────────────────────

export function InfoCard({ icon, title, desc }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        ...shadows.card,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          backgroundColor: `${colors.primary}14`,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
          {title}
        </AppText>
        <AppText style={{ fontSize: 13.5, color: colors.muted, marginTop: 3, lineHeight: 19 }}>
          {desc}
        </AppText>
      </View>
    </View>
  );
}

export function SectionHeading({ children }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ width: 4, height: 22, borderRadius: 999, backgroundColor: colors.primary }} />
      <AppText style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
        {children}
      </AppText>
    </View>
  );
}
