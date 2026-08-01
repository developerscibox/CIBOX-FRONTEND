import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { colors, radius } from "../constants/theme";

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
export function ProductCardSkeleton({ compact = false }) {
  const imgH = compact ? 130 : 180;
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      flex: 1,
    }}>
      {/* Imagen */}
      <SkeletonBlock height={imgH} borderRadius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        {/* Nombre */}
        <SkeletonBlock height={13} width="80%" />
        <SkeletonBlock height={11} width="55%" />
        {/* Precio */}
        <SkeletonBlock height={18} width="40%" style={{ marginTop: 4 }} />
        {/* Botón */}
        <SkeletonBlock height={36} borderRadius={radius.md} style={{ marginTop: 4 }} />
      </View>
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
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: 160 }}>
          <ProductCardSkeleton />
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
