import { Linking, ScrollView, View, Pressable, Platform, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import { colors, spacing, radius, shadows } from "../constants/theme";

// ─── Paleta B2B (paleta verde heredada del pitch original — pendiente rebrand visual)───────────────────────────
const G = "#38B27B";
const G2 = "#3CC18E";

// ─── Datos ──────────────────────────────────────────────────────────────────
const META = [
  { label: "Razón social", value: "BODEGA 12 SpA" },
  { label: "RUT", value: "78.245.061-1" },
  { label: "Dirección", value: "La Concepción 81, Of. 214, Providencia" },
  { label: "Web", value: "www.bodega12.cl", url: "https://www.bodega12.cl" },
  { label: "Ciudad", value: "Santiago, 2026" },
];

const SECTIONS = [
  {
    num: "1",
    title: "Contexto Estratégico",
    subtitle: "Marco de relación y objetivo estratégico de la alianza.",
    tag: "Modalidad 1: Proveedor B2B",
    cards: [
      {
        icon: "handshake-outline",
        title: "Marco de la Relación",
        items: [
          "Modalidad 1: Proveedor B2B acordada formalmente.",
          "Venta directa a Bodega 12 — comercialización B2C por Bodega 12.",
        ],
      },
      {
        icon: "trophy-outline",
        title: "Objetivo Estratégico",
        items: [
          "Traspasar hasta 20% de ahorro real al cliente final.",
          "Mantener margen operacional saludable.",
          "Escalar regionalmente con eficiencia logística.",
          "Construir relación sólida, eficiente y escalable.",
        ],
      },
    ],
    cta: {
      title: "Resultado esperado",
      body: "Un acuerdo escrito que asegure competitividad, continuidad operativa y escalamiento regional.",
    },
  },
  {
    num: "2",
    title: "Condiciones Clave del Acuerdo",
    subtitle: "Condiciones comerciales + logística/operación para un modelo B2B→B2C eficiente.",
    tag: "Estructura Comercial + Operación",
    cards: [
      {
        icon: "layers-outline",
        title: "A. Condiciones Comerciales",
        items: [
          "Listado oficial de productos (SKU formalizado).",
          "Precio preferencial exclusivo (unidad / pack / caja).",
          "Banda de precios por volumen.",
          "Vigencia precios 30–60–90 días (ideal 60).",
          "Cláusula precio más bajo garantizado.",
          "Escalamiento por volumen.",
          "Bonificaciones comerciales y campañas omnicanal.",
          "Participación estratégica en última milla.",
        ],
      },
      {
        icon: "car-outline",
        title: "B. Logística y Operación",
        items: [
          "Modelo Picking & Packing / Fulfillment B2C.",
          "Lead Time objetivo: 12–24–48 hrs RM.",
          "Fill Rate histórico validado.",
          "Integración órdenes: API / EDI / correo automatizado.",
          "Política formal ante quiebres de stock.",
          "Capacidad despacho diario definida.",
          "Responsabilidad productos dañados.",
          "Cumplimiento Ley 20.606 y resolución sanitaria vigente.",
        ],
      },
    ],
  },
  {
    num: "3",
    title: "Financiero, Riesgo y Estructura",
    subtitle: "Condiciones financieras, inventario, cláusulas críticas y validación de margen.",
    tag: "Formalización y Control",
    cards: [
      {
        icon: "cash-outline",
        title: "C. Condiciones Financieras",
        items: [
          "Pago Win/Win: 24 hrs con precios preferenciales para Bodega 12.",
          "Pago fast: 72 hrs.",
          "Pago ideal: 30–45 días.",
        ],
      },
      {
        icon: "cube-outline",
        title: "D. Inventario y Abastecimiento",
        items: [
          "Información de stock en tiempo real o integración.",
          "Reserva de inventario exclusivo para campañas o alta demanda.",
        ],
      },
      {
        icon: "shield-checkmark-outline",
        title: "E. Contractual y Riesgo",
        items: [
          "NDA formalizado.",
          "No venta directa a base de clientes Bodega 12.",
          "No competencia digital en categorías acordadas.",
          "Seguro responsabilidad civil vigente.",
          "Protocolo recall sanitario definido.",
        ],
      },
      {
        icon: "bar-chart-outline",
        title: "F. Categoría y Margen Bodega 12",
        items: [
          "Hasta 20% ahorro real para el cliente.",
          "Margen bruto saludable garantizado.",
          "Cobertura costos logísticos y financieros.",
          "Identificación de categorías estratégicas.",
          "Desarrollo de Cajas Exclusivas Bodega 12.",
        ],
      },
    ],
    cta: {
      title: "¿Listos para avanzar?",
      body: "Escríbenos a contacto@bodega12.cl para iniciar la formalización.",
      email: "contacto@bodega12.cl",
    },
  },
];

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function MetaRow({ label, value, url }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
      <AppText style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,.85)", minWidth: 96 }}>
        {label}
      </AppText>
      {url ? (
        <Pressable onPress={() => Linking.openURL(url)}>
          <AppText style={{ fontSize: 12, color: "#fff", textDecorationLine: "underline" }}>
            {value}
          </AppText>
        </Pressable>
      ) : (
        <AppText style={{ fontSize: 12, color: "#fff", flex: 1 }}>{value}</AppText>
      )}
    </View>
  );
}

function Tag({ label }) {
  return (
    <View style={{
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: `${G}14`,
    }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: G }} />
      <AppText style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>{label}</AppText>
    </View>
  );
}

function InfoCard({ icon, title, items }) {
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: 12,
      ...shadows.card,
    }}>
      {/* Card header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: `${G}18`,
          borderWidth: 1,
          borderColor: `${G}30`,
          justifyContent: "center",
          alignItems: "center",
        }}>
          <Ionicons name={icon} size={18} color={G} />
        </View>
        <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text, flex: 1 }}>
          {title}
        </AppText>
      </View>

      {/* Items */}
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: G, marginTop: 7, flexShrink: 0 }} />
          <AppText style={{ fontSize: 13, color: colors.text, lineHeight: 20, flex: 1 }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function CtaBanner({ title, body, email }) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: `${G}30`,
      padding: spacing.md,
      backgroundColor: `${G}0D`,
      marginTop: 6,
      flexWrap: "wrap",
    }}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <AppText style={{ fontSize: 14, fontWeight: "900", color: colors.text, marginBottom: 3 }}>
          {title}
        </AppText>
        <AppText style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
          {body}
        </AppText>
      </View>
      {email && (
        <Pressable
          onPress={() => Linking.openURL(
            `mailto:${email}?subject=Formalización Proveedor B2B Bodega 12`
          )}
          style={({ pressed }) => ({
            backgroundColor: pressed ? G2 : G,
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            shadowColor: G,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          })}
        >
          <Ionicons name="mail-outline" size={16} color="#fff" />
          <AppText style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>
            Iniciar formalización
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

function SectionBlock({ section }) {
  const isEven = parseInt(section.num) % 2 === 0;
  return (
    <View style={{
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isEven ? "#F9FAF8" : colors.surface,
      padding: spacing.md,
      marginBottom: 18,
      overflow: "hidden",
      ...shadows.card,
    }}>
      {/* Number watermark */}
      <AppText style={{
        position: "absolute",
        right: 12,
        top: 8,
        fontSize: 110,
        fontWeight: "900",
        color: `${G}12`,
        lineHeight: 110,
      }}>
        {section.num}
      </AppText>

      {/* Section header */}
      <View style={{
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingBottom: 14,
        marginBottom: 16,
        gap: 10,
      }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <AppText style={{ fontSize: 19, fontWeight: "900", color: colors.text, flex: 1 }}>
            {section.title}
          </AppText>
          <Tag label={section.tag} />
        </View>
        <AppText style={{ fontSize: 12, color: colors.muted }}>{section.subtitle}</AppText>
      </View>

      {/* Cards grid */}
      {section.cards.map((card, i) => (
        <InfoCard key={i} icon={card.icon} title={card.title} items={card.items} />
      ))}

      {/* CTA inside section */}
      {section.cta && (
        <CtaBanner
          title={section.cta.title}
          body={section.cta.body}
          email={section.cta.email}
        />
      )}
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────────────────
export default function B2BProviderScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = width >= 800;

  // Solo disponible en web — en móvil nativo no se muestra
  if (!isWeb) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="desktop-outline" size={48} color={colors.muted} style={{ marginBottom: 16 }} />
        <AppText style={{ fontSize: 16, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 8 }}>
          Solo disponible en web
        </AppText>
        <AppText style={{ fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
          Esta página está disponible en{"\n"}app.bodega12.cl/bodega12presentation
        </AppText>
      </View>
    );
  }

  // En web standalone mostramos topbar mínimo
  const showTopBar = isWide;
  // En desktop ancho el topbar da contexto; en web angosto/móvil mostramos
  // el botón flotante de volver para no dejar al usuario sin salida.
  const canGoBack = navigation?.canGoBack?.() ?? false;
  const showBackBtn = !isWide && canGoBack;

  return (
    <ScreenContainer maxWidth={760} padded={false}>
      {/* ── TOP BAR (solo web desktop standalone) ── */}
      {showTopBar && (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <AppText style={{ fontSize: 16, fontWeight: "900", color: colors.text, letterSpacing: 1 }}>
            Bodega 12
          </AppText>
          <Pressable
            onPress={() => Linking.openURL("https://www.bodega12.cl")}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <AppText style={{ fontSize: 13, color: G, fontWeight: "700" }}>www.bodega12.cl</AppText>
            <Ionicons name="open-outline" size={14} color={G} />
          </Pressable>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ── BANNER ── */}
        <View style={{
          backgroundColor: G,
          paddingHorizontal: spacing.lg,
          paddingTop: showBackBtn ? 56 : 36,
          paddingBottom: 32,
          overflow: "hidden",
        }}>

        {/* Botón flotante de volver (móvil / web estrecho) */}
        {showBackBtn && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              position: "absolute",
              top: insets.top + 12,
              left: 16,
              zIndex: 10,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,.22)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.30)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
        )}
          {/* Círculo decorativo */}
          <View style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: "rgba(255,255,255,.10)",
            top: -80,
            right: -60,
          }} />
          <View style={{
            position: "absolute",
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: "rgba(255,255,255,.07)",
            bottom: -60,
            left: -40,
          }} />

          {/* Logo */}
          <View style={{ marginBottom: 18, zIndex: 1 }}>
            <AppText style={{ fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: 1 }}>
              Bodega 12
            </AppText>
            <AppText style={{ fontSize: 11, color: "rgba(255,255,255,.75)", fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Comercializadora SpA
            </AppText>
          </View>

          <AppText style={{ fontSize: 22, fontWeight: "900", color: "#fff", lineHeight: 30, marginBottom: 8, zIndex: 1 }}>
            Formalización Condiciones Comerciales y Operativas
          </AppText>
          <AppText style={{ fontSize: 13, color: "rgba(255,255,255,.92)", lineHeight: 20, marginBottom: 24 }}>
            Modalidad <AppText style={{ fontWeight: "800", color: "#fff" }}>Proveedor B2B</AppText> — Venta directa a Bodega 12 y comercialización B2C por Bodega 12.
          </AppText>

          {/* Meta card */}
          <View style={{
            backgroundColor: "rgba(255,255,255,.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.22)",
            borderRadius: radius.lg,
            padding: spacing.md,
          }}>
            <AppText style={{ fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Información del Emisor
            </AppText>
            {META.map((m, i) => (
              <MetaRow key={i} label={m.label} value={m.value} url={m.url} />
            ))}
          </View>
        </View>

        {/* ── SECCIONES ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          {SECTIONS.map((s, i) => (
            <SectionBlock key={i} section={s} />
          ))}

          {/* Footer */}
          <View style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 16,
            marginTop: 6,
          }}>
            <AppText style={{ fontSize: 11, color: colors.muted, lineHeight: 17 }}>
              <AppText style={{ fontWeight: "700" }}>Nota: </AppText>
              Este documento resume los puntos clave a formalizar para estructurar la relación B2B con Bodega 12.
            </AppText>
            <AppText style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
              © 2026 BODEGA 12 SpA — www.bodega12.cl
            </AppText>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
