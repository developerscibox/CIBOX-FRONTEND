import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadows, spacing } from "../constants/theme";
import AppText from "./AppText";

const MORADO = "#7A1B73";
const LOGO = require("../../assets/bodega12-logo.png");
export const COUPON_CODE = "BODEGA10";

// ─── Franja de confianza (separa secciones + refuerza por qué comprar) ───────────
// Barra horizontal compacta. En desktop los 4 ítems van en fila; en móvil 2×2.
export function TrustStrip() {
  const items = [
    { icon: "storefront-outline", label: "Retiro gratis", sub: "en bodega Lo Espejo" },
    { icon: "cash-outline", label: "Efectivo o transferencia", sub: "pago al retirar" },
    { icon: "cube-outline", label: "Venta por caja", sub: "precio mayorista" },
    { icon: "time-outline", label: "Lun a Sáb", sub: "horario de atención" },
  ];
  return (
    <View
      style={{
        marginBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: `${colors.primary}20`,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 12,
        columnGap: 12,
        ...shadows.card,
      }}
    >
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            flexGrow: 1,
            flexBasis: 150,
            minWidth: 140,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: `${colors.primary}12`,
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Ionicons name={it.icon} size={19} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={{ fontSize: 12.5, fontWeight: "800", color: colors.text }}>
              {it.label}
            </AppText>
            <AppText style={{ fontSize: 10.5, color: colors.muted }}>{it.sub}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Banner de cupón 10% (logo Bodega 12 + código BODEGA10) ──────────────────────
export function PromoStrip({ navigation, isWebDesktop }) {
  return (
    <Pressable
      onPress={() => navigation.navigate("Products")}
      style={{
        marginBottom: spacing.lg,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        gap: 14,
        minHeight: isWebDesktop ? 124 : 104,
      }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: "#FF3DA6", opacity: 0.4 }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: -30, bottom: -55, width: 160, height: 160, borderRadius: 80, backgroundColor: MORADO, opacity: 0.5 }}
      />

      {/* Logo Bodega 12 */}
      <View
        style={{
          width: isWebDesktop ? 78 : 64,
          height: isWebDesktop ? 78 : 64,
          borderRadius: 18,
          backgroundColor: "#fff",
          padding: 4,
          flexShrink: 0,
          ...shadows.card,
        }}
      >
        <Image
          source={LOGO}
          style={{ width: "100%", height: "100%", borderRadius: 14 }}
          resizeMode="cover"
        />
      </View>

      {/* Texto + código */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(255,255,255,0.22)",
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
            marginBottom: 5,
          }}
        >
          <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
            🎉 CUPÓN DE BIENVENIDA
          </AppText>
        </View>

        <AppText style={{ color: "#fff", fontSize: isWebDesktop ? 19 : 16, fontWeight: "900" }}>
          10% OFF en tu primera compra
        </AppText>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <AppText style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
            Usa el código
          </AppText>
          {/* "Ticket" del código */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: "#fff",
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: "rgba(255,255,255,0.6)",
              borderStyle: "dashed",
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Ionicons name="pricetag" size={13} color={colors.primary} />
            <AppText style={{ color: colors.primary, fontWeight: "900", fontSize: 13, letterSpacing: 1 }}>
              {COUPON_CODE}
            </AppText>
          </View>
          <AppText style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
            en el checkout
          </AppText>
        </View>
      </View>

      {/* CTA (solo desktop por espacio) */}
      {isWebDesktop ? (
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <AppText style={{ color: colors.primary, fontWeight: "900", fontSize: 13 }}>
            Ver catálogo
          </AppText>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Infografía: comprar por caja en 3 pasos ─────────────────────────────────────
export function HowToBoxStrip({ isWebDesktop }) {
  const steps = [
    { n: "1", icon: "search-outline", label: "Elige tu producto", sub: "del catálogo mayorista" },
    { n: "2", icon: "cube-outline", label: "Suma cajas", sub: "mientras más, mejor precio" },
    { n: "3", icon: "storefront-outline", label: "Retira gratis", sub: "en bodega Lo Espejo" },
  ];
  return (
    <View
      style={{
        marginBottom: spacing.lg,
        backgroundColor: `${MORADO}0A`,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${MORADO}22`,
        padding: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Ionicons name="cube" size={18} color={MORADO} />
        <AppText style={{ fontSize: 16, fontWeight: "900", color: MORADO }}>
          Comprar por caja en 3 pasos
        </AppText>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {steps.map((s) => (
          <View
            key={s.n}
            style={{
              flexGrow: 1,
              flexBasis: isWebDesktop ? 0 : 150,
              minWidth: 150,
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              ...shadows.card,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <AppText style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>{s.n}</AppText>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                {s.label}
              </AppText>
              <AppText style={{ fontSize: 11, color: colors.muted, lineHeight: 15 }}>
                {s.sub}
              </AppText>
            </View>
            <Ionicons name={s.icon} size={20} color={`${MORADO}99`} />
          </View>
        ))}
      </View>
    </View>
  );
}
