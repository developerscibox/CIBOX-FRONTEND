import { useEffect, useRef } from "react";
import { Animated, View, useWindowDimensions } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

/**
 * Bloque base animado con efecto shimmer (pulso de opacidad).
 */
function SkeletonBlock({ width = "100%", height = 16, borderRadius = radius.sm, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton de una tarjeta de producto (cuadrada con título y precio).
 */
export function ProductCardSkeleton({ compact = false, mini = false }) {
  // Las medidas son LAS MISMAS que las de ProductCard: mismo padding, mismo
  // radio de 12, misma altura de imagen y las mismas franjas reservadas para
  // badge y nombre. Si el esqueleto no calza con la tarjeta que lo reemplaza,
  // al terminar de cargar el catálogo entero da un salto de forma.
  const imgH = mini ? 120 : compact ? 180 : 220;
  const cardPadding = mini ? spacing.sm : spacing.md;
  const badgeRowHeight = mini ? 22 : 30;
  const titleBlockHeight = (mini ? 18 : 22) * 2;

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: cardPadding,
      flex: 1,
    }}>
      {/* Imagen */}
      <SkeletonBlock height={imgH} borderRadius={radius.lg} />
      {/* Franja de badges: se reserva siempre, haya badge o no */}
      <View style={{ height: badgeRowHeight, justifyContent: "center", marginTop: 8 }}>
        <SkeletonBlock height={mini ? 16 : 20} width="45%" borderRadius={999} />
      </View>
      {/* Nombre: siempre dos líneas */}
      <View style={{ height: titleBlockHeight, justifyContent: "space-between", marginBottom: 6 }}>
        <SkeletonBlock height={mini ? 11 : 13} width="92%" />
        <SkeletonBlock height={mini ? 11 : 13} width="64%" />
      </View>
      {/* Precio */}
      <SkeletonBlock height={mini ? 16 : 20} width="45%" />
      {/* El hueco elástico, igual que en la tarjeta, empuja el botón abajo */}
      <View style={{ flexGrow: 1, minHeight: mini ? 4 : 6 }} />
      {/* Botón */}
      <SkeletonBlock height={mini ? 34 : 42} borderRadius={12} style={{ marginTop: 8 }} />
    </View>
  );
}

/**
 * Grid de skeletons para ProductsScreen.
 */
export function ProductsGridSkeleton({ columns = 2, count = 6 }) {
  const rows = [];
  for (let i = 0; i < count; i += columns) {
    const rowItems = [];
    for (let j = 0; j < columns; j++) {
      rowItems.push(
        <View key={j} style={{ flex: 1 }}>
          <ProductCardSkeleton compact={columns > 1} />
        </View>
      );
    }
    rows.push(
      <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        {rowItems}
      </View>
    );
  }
  return <View style={{ padding: 12 }}>{rows}</View>;
}

/**
 * Skeleton para una fila horizontal de productos (HomeScreen).
 */
export function ProductRowSkeleton({ count = 4 }) {
  // Mismo corte y mismos anchos que ProductRowSection (160 en móvil, 260 desde
  // 800px), y el mismo par compact/mini que le pasa a cada ProductCard. Con el
  // ancho fijo de 160 de antes, en escritorio el esqueleto salía a dos tercios
  // de la tarjeta y la fila se reacomodaba entera al cargar.
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 800;
  const cardWidth = isSmallScreen ? 160 : 260;

  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: cardWidth }}>
          <ProductCardSkeleton compact={!isSmallScreen} mini={isSmallScreen} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton completo para HomeScreen (banner + sección de productos).
 */
export function HomeScreenSkeleton() {
  return (
    <View style={{ gap: 20, paddingBottom: 24 }}>
      {/* Banner hero */}
      <SkeletonBlock height={180} borderRadius={radius.lg} style={{ marginHorizontal: 16 }} />

      {/* Accesos rápidos */}
      <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={{ alignItems: "center", gap: 6 }}>
            <SkeletonBlock width={56} height={56} borderRadius={28} />
            <SkeletonBlock width={48} height={10} />
          </View>
        ))}
      </View>

      {/* Sección destacados */}
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <SkeletonBlock height={20} width={140} />
        <ProductRowSkeleton count={3} />
      </View>

      {/* Sección recomendados */}
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <SkeletonBlock height={20} width={180} />
        <ProductRowSkeleton count={3} />
      </View>
    </View>
  );
}

export default SkeletonBlock;
