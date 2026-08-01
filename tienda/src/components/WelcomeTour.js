import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";

import AppText from "./AppText";
import useOnboardingStore from "../store/onboardingStore";
import { colors, radius, spacing } from "../constants/theme";

import brand from "../constants/brand";
// Pasos del tour de bienvenida (texto tal cual, en español).
const SLIDES = [
  {
    emoji: "👋",
    title: `Bienvenido a ${brand.name}`,
    body: "Somos un supermercado mayorista: precios bajos comprando por caja, con retiro GRATIS en nuestra bodega de Lo Espejo. En 1 minuto te mostramos cómo funciona. Puedes saltarlo cuando quieras.",
  },
  {
    emoji: "📦",
    title: "Aquí se vende por caja",
    body: "Las compras son POR CAJA, no por unidad suelta. El precio que ves es POR UNIDAD; el total de la caja = precio por unidad × unidades de la caja. Mientras más rinde la caja, más ahorras.",
  },
  {
    emoji: "🏬",
    title: "Solo retiro en bodega",
    body: "Hoy retiras tu pedido GRATIS en nuestra bodega de Lo Espejo (Av. Lo Espejo 01565, Patio 6, Bodega 826). El despacho a domicilio viene pronto. En el carrito eliges el día de retiro.",
  },
  {
    emoji: "🔎",
    title: "Busca y filtra",
    body: 'Usa el buscador por nombre o marca, y entra a "Ver catálogo" para filtrar por categoría, marca, precio o ver solo lo disponible. Toca un producto para ver el detalle de la caja.',
  },
  {
    emoji: "🛒",
    title: "Agrega cajas al carrito",
    body: "Toca el botón de agregar para sumar una caja (puedes elegir cuántas). Verás el contador en la bolsa, arriba a la derecha. Para comprar, inicia sesión.",
  },
  {
    emoji: "💵",
    title: "Elige el día y paga al retirar",
    body: "En el checkout eliges el DÍA de retiro y cómo pagar: transferencia o efectivo al retirar. El pago es presencial. Aceptas los términos y confirmas la compra.",
  },
  {
    emoji: "📋",
    title: "Tus pedidos y favoritos",
    body: `En la barra inferior: en "Mis pedidos" sigues el estado de tu pedido; en "Favoritos" guardas productos para recomprar en un toque. ¡Listo, ya sabes comprar en ${brand.name}!`,
  },
];

export default function WelcomeTour() {
  const seen = useOnboardingStore((state) => state.seen);
  const open = useOnboardingStore((state) => state.open);
  const closeTour = useOnboardingStore((state) => state.closeTour);
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const loadOnboarding = useOnboardingStore((state) => state.loadOnboarding);

  const [step, setStep] = useState(0);

  // Carga el flag persistido al montar
  useEffect(() => {
    loadOnboarding();
  }, [loadOnboarding]);

  // Se muestra automáticamente la primera vez (si !seen) o cuando open=true.
  const visible = open || !seen;

  // Reinicia al primer paso cada vez que se abre
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  if (!visible) return null;

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const finish = () => {
    markSeen();
    closeTour();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => Math.min(s + 1, SLIDES.length - 1));
  };

  // En web el overlay debe ser fixed para cubrir todo el viewport.
  const overlayPosition =
    Platform.OS === "web" ? { position: "fixed" } : { position: "absolute" };

  return (
    <View
      style={[
        {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: "rgba(20, 6, 16, 0.78)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        },
        overlayPosition,
      ]}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 440,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        {/* Botón Saltar */}
        <Pressable
          onPress={finish}
          hitSlop={10}
          style={{ alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 6 }}
        >
          <AppText
            weight="semiBold"
            style={{ color: colors.muted, fontSize: 14 }}
          >
            Saltar
          </AppText>
        </Pressable>

        {/* Emoji ilustrativo */}
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.primaryLight,
            alignSelf: "center",
            justifyContent: "center",
            alignItems: "center",
            marginTop: spacing.xs,
            marginBottom: spacing.md,
          }}
        >
          <AppText style={{ fontSize: 42, lineHeight: 50 }}>
            {slide.emoji}
          </AppText>
        </View>

        {/* Título */}
        <AppText
          weight="bold"
          style={{
            fontSize: 22,
            color: colors.text,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          {slide.title}
        </AppText>

        {/* Cuerpo */}
        <ScrollView
          style={{ maxHeight: 220 }}
          contentContainerStyle={{ paddingHorizontal: 2 }}
          showsVerticalScrollIndicator={false}
        >
          <AppText
            style={{
              fontSize: 15,
              lineHeight: 23,
              color: colors.muted,
              textAlign: "center",
            }}
          >
            {slide.body}
          </AppText>
        </ScrollView>

        {/* Puntos de progreso */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 4,
                marginHorizontal: 3,
                backgroundColor: i === step ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        {/* Botones */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={finish}
            hitSlop={8}
            style={{ paddingVertical: 12, paddingHorizontal: 8 }}
          >
            <AppText
              weight="semiBold"
              style={{ color: colors.muted, fontSize: 15 }}
            >
              Saltar
            </AppText>
          </Pressable>

          <Pressable
            onPress={next}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 13,
              paddingHorizontal: 28,
              borderRadius: radius.lg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText
              weight="bold"
              style={{ color: colors.primaryText, fontSize: 15 }}
            >
              {isLast ? "Empezar" : "Siguiente"}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
