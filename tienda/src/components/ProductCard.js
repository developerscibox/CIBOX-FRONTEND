import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../constants/theme";
import AppText from "./AppText";
import { getProductImage, productEmoji, productTint } from "../utils/productImage";
import useAuthStore from "../store/authStore";
import { addFavorite, removeFavorite } from "../services/favoriteService";
import { addItemToPantry } from "../services/pantryService";
import { showToast } from "../store/toastStore";

import brand from "../constants/brand";
export default function ProductCard({
  product,
  onPress,
  onAddToCart,
  compact = false,
  mini = false,
  adding = false,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [fav, setFav] = useState(Boolean(product?.is_favorite));
  const [cajas, setCajas] = useState(1);
  const [savingPantry, setSavingPantry] = useState(false);
  const token = useAuthStore((s) => s.token);

  // Sincroniza fav cuando la lista recicla la tarjeta con otro producto
  useEffect(() => {
    setFav(Boolean(product?.is_favorite));
  }, [product?._id]);

  const handleToggleFav = async () => {
    if (!token) {
      Alert.alert("Favoritos", "Inicia sesión para guardar favoritos");
      return;
    }
    const next = !fav;
    setFav(next); // optimista
    try {
      if (next) {
        await addFavorite(product?._id);
      } else {
        await removeFavorite(product?._id);
      }
    } catch (e) {
      setFav(!next); // revierte si falla
    }
  };

  // ── Precio por caja (Cibox vende por caja, no por unidad) ──
  const tiers = Array.isArray(product?.pricing?.tiers)
    ? product.pricing.tiers
    : [];
  const sortedTiers = [...tiers].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  const unitTier =
    sortedTiers.find((t) => (t?.min_qty || 1) === 1) || sortedTiers[0] || null;
  const boxTier = sortedTiers[sortedTiers.length - 1] || unitTier; // mayor cantidad = caja
  // tier.price es POR UNIDAD; el precio total de la caja = price * min_qty.
  const boxUnitPrice = boxTier?.price ?? null;
  const boxQty = boxTier?.min_qty && boxTier.min_qty > 1 ? boxTier.min_qty : null;
  const boxTotal =
    boxQty && boxUnitPrice != null ? boxUnitPrice * boxQty : boxUnitPrice;
  const perUnit = boxQty ? boxUnitPrice : null; // c/u dentro de la caja
  const unitPrice = unitTier?.price ?? null;
  const boxLabel = boxTier?.label || (boxQty ? `Caja de ${boxQty} un` : "Por caja");
  const boxSavingsPct =
    unitPrice && boxUnitPrice && boxQty && unitPrice > boxUnitPrice
      ? Math.round((1 - boxUnitPrice / unitPrice) * 100)
      : 0;
  const hasPackTier = !!boxQty;

  // Cantidad por caja para guardar en despensa (cae a 1 si no hay pack tier).
  const boxQtyOf = (p) =>
    boxQty && boxQty > 1 ? boxQty : p?.box_quantity || 1;

  // Guardar rápido en Mi Despensa. Autocontenido: no depende de props nuevas.
  const handleSaveToPantry = async () => {
    if (savingPantry) return;
    if (!token) {
      showToast("Inicia sesión para usar tu despensa", "info");
      return;
    }
    try {
      setSavingPantry(true);
      await addItemToPantry({
        productId: product?._id,
        quantity: boxQtyOf(product),
      });
      showToast("Guardado en Mi Despensa");
    } catch (e) {
      showToast(
        e?.response?.data?.message || "No se pudo guardar en tu despensa",
        "error",
      );
    } finally {
      setSavingPantry(false);
    }
  };

  const averageRating = Number(product?.average_rating ?? 0);
  const reviewsCount = Number(product?.reviews_count ?? 0);
  const hasReviews = reviewsCount > 0;

  const ciboxPlusEnabled = !!product?.cibox_plus?.enabled;
  const imageUrl = imgFailed ? null : getProductImage(product);

  const formatPrice = (value) => {
    if (value === null || value === undefined) return "—";
    return `$${Number(value).toLocaleString("es-CL")}`;
  };

  // Tamaños según modo
  const imageHeight = mini ? 120 : compact ? 180 : 220;
  const titleSize = mini ? 13 : compact ? 16 : 17;
  const priceSize = mini ? 15 : compact ? 18 : 20;
  const cardPadding = mini ? spacing.sm : spacing.md;

  const chipStyle = (backgroundColor) => ({
    backgroundColor,
    paddingHorizontal: mini ? 6 : 10,
    paddingVertical: mini ? 3 : 6,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  });

  return (
    <View
      style={{
        // overflow:hidden FUERZA a Chrome a re-pintar el fondo blanco en TODA la
        // caja (capa de composición propia). Sin esto, con el flex anidado del
        // carrusel el fondo se pintaba corto y "Ver detalle/Guardar" quedaba sobre
        // el rosado, aunque la caja sí incluyera el footer. Alto por contenido.
        width: "100%",
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: "#ececec",
        borderRadius: radius.xl,
        padding: cardPadding,
        ...shadows.card,
      }}
    >
      <Pressable onPress={onPress}>
        {/* Imagen */}
        <View
          style={{
            width: "100%",
            height: imageHeight,
            borderRadius: radius.lg,
            backgroundColor: imageUrl ? "#f7f7f7" : productTint(product),
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: mini ? 8 : spacing.md,
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <AppText style={{ fontSize: mini ? 40 : 58, marginBottom: 6 }}>
                {productEmoji(product)}
              </AppText>
              <AppText
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: mini ? 11 : 13,
                  fontWeight: "800",
                  textAlign: "center",
                  opacity: 0.7,
                }}
              >
                {product?.name || product?.category?.name || brand.name}
              </AppText>
            </View>
          )}

          {/* Botón favorito (corazón) */}
          <Pressable
            onPress={handleToggleFav}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.85)",
              alignItems: "center",
              justifyContent: "center",
              ...shadows.card,
            }}
          >
            <Ionicons
              name={fav ? "heart" : "heart-outline"}
              size={20}
              color={fav ? colors.primary : colors.text}
            />
          </Pressable>
        </View>

        {/* Chips — ocultos en mini para ahorrar espacio */}
        {!mini && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "flex-start",
              minHeight: 34,
              marginBottom: 8,
            }}
          >
            {hasPackTier ? (
              <View style={chipStyle(colors.primary)}>
                <AppText style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                  Venta por caja
                </AppText>
              </View>
            ) : null}
            {ciboxPlusEnabled ? (
              <View style={chipStyle("#6d28d9")}>
                <AppText style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                  Cibox+
                </AppText>
              </View>
            ) : null}
          </View>
        )}

        {/* Chips mini — solo íconos */}
        {mini && (hasPackTier || ciboxPlusEnabled) && (
          <View style={{ flexDirection: "row", marginBottom: 6, gap: 4 }}>
            {hasPackTier && (
              <View style={chipStyle(colors.primary)}>
                <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                  Por caja
                </AppText>
              </View>
            )}
            {ciboxPlusEnabled && (
              <View style={chipStyle("#6d28d9")}>
                <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                  Cibox+
                </AppText>
              </View>
            )}
          </View>
        )}

        {/* Nombre */}
        <View style={{ marginBottom: 6 }}>
          <AppText
            numberOfLines={2}
            style={{
              fontSize: titleSize,
              fontWeight: "800",
              color: colors.text,
              lineHeight: mini ? 18 : 22,
            }}
          >
            {product?.name || "Producto"}
          </AppText>
        </View>

        {/* Precio por caja */}
        <View style={{ marginBottom: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <AppText
              style={{ fontSize: priceSize, fontWeight: "900", color: colors.text }}
            >
              {formatPrice(boxTotal)}
            </AppText>
            <AppText
              style={{
                fontSize: mini ? 11 : 13,
                color: colors.accent,
                fontWeight: "800",
              }}
            >
              {boxQty ? "/ caja" : "/ un"}
            </AppText>
          </View>

          <AppText
            style={{ fontSize: mini ? 10 : 12, color: colors.muted, marginTop: 1 }}
          >
            {boxLabel}
            {perUnit ? ` · ≈ ${formatPrice(perUnit)} c/u` : ""}
          </AppText>

          {boxSavingsPct >= 3 && (
            <AppText
              style={{
                fontSize: mini ? 10 : 12,
                color: colors.success,
                fontWeight: "800",
                marginTop: 2,
              }}
            >
              Ahorra {boxSavingsPct}% por caja
            </AppText>
          )}
        </View>

        {/* Categoría */}
        <View style={{ marginBottom: mini ? 6 : 6 }}>
          <AppText
            numberOfLines={1}
            style={{ color: colors.muted, fontSize: mini ? 12 : 14 }}
          >
            {product?.category?.name || "Sin categoría"}
          </AppText>
        </View>

        {/* Reseñas — ocultas en mini */}
        {!mini && (
          <View style={{ marginBottom: 14 }}>
            {hasReviews ? (
              <AppText style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                {averageRating.toFixed(1)} · {reviewsCount} reseñas
              </AppText>
            ) : (
              <AppText style={{ color: colors.muted, fontSize: 12 }}>
                Aún sin reseñas
              </AppText>
            )}
          </View>
        )}
      </Pressable>

      {/* Botones — fondo blanco PROPIO que sangra a los bordes de la card. Así,
          aunque el fondo del root se pintara corto en el carrusel, este bloque
          (stepper + agregar caja + Ver detalle/Guardar) SIEMPRE queda sobre
          blanco. El overflow:hidden + radius del root le redondea las esquinas. */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#eeeeee",
          paddingTop: mini ? 8 : 12,
          gap: mini ? 6 : 10,
          backgroundColor: colors.surface,
          marginHorizontal: -cardPadding,
          marginBottom: -cardPadding,
          paddingHorizontal: cardPadding,
          paddingBottom: cardPadding,
        }}
      >
        {/* Selector de cajas — solo con pack tier y fuera de modo mini */}
        {hasPackTier && !mini && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginBottom: 4,
            }}
          >
            <Pressable
              onPress={() => setCajas((n) => Math.max(1, n - 1))}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: "#e0e0e0",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <AppText style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                −
              </AppText>
            </Pressable>
            <AppText
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: colors.text,
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {cajas}
            </AppText>
            <Pressable
              onPress={() => setCajas((n) => n + 1)}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: "#e0e0e0",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <AppText style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                +
              </AppText>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={async () => {
            // Cibox vende SOLO por caja. Si el producto no tiene formato de
            // caja configurado, no se agrega por unidad: dirigimos al detalle.
            if (!hasPackTier) {
              onPress?.();
              return;
            }
            try {
              await onAddToCart?.(product, cajas);
              setCajas(1); // resetea el selector tras agregar exitoso
            } catch (e) {
              // si falla, no reseteamos el selector
            }
          }}
          disabled={adding}
          style={{
            backgroundColor: hasPackTier ? colors.primary : colors.muted,
            height: mini ? 34 : 42,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: adding ? 0.7 : 1,
          }}
        >
          <AppText style={{ color: "#fff", fontSize: mini ? 12 : 14, fontWeight: "700" }}>
            {adding
              ? "Agregando..."
              : cajas > 1
                ? `Agregar ${cajas}`
                : "Agregar"}
          </AppText>
        </Pressable>

        {!mini && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 20,
            }}
          >
            {/* "Ver detalle" se quitó: pinchar la tarjeta ya abre el detalle.
                Queda solo "Guardar en despensa", que es una acción distinta. */}
            <Pressable
              onPress={handleSaveToPantry}
              disabled={savingPantry}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                opacity: savingPantry ? 0.6 : 1,
              }}
            >
              <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
              <AppText style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }}>
                {savingPantry ? "Guardando..." : "Guardar en despensa"}
              </AppText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}