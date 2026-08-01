import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import ProductRowSection from "../components/ProductRowSection";
import { colors, radius, spacing } from "../constants/theme";
import { addItemToCart } from "../services/cartService";
import { addItemToPantry } from "../services/pantryService";
import {
  addFavorite,
  checkFavorite,
  removeFavorite,
} from "../services/favoriteService";
import {
  createReview,
  deleteMyReview,
  getMyReviewByProduct,
  getReviewsByProduct,
  updateMyReview,
} from "../services/reviewService";
import { getProductById, getRelatedProducts } from "../services/productService";
import useCartStore from "../store/cartStore";
import useAuthStore from "../store/authStore";
import { showAppAlert } from "../utils/appAlerts";
import { showToast } from "../store/toastStore";
import { boxTierOf } from "../utils/boxPricing";
import AppText from "../components/AppText";

export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params;
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  // const isWeb = Platform.OS === "web";
  const isWebDesktop = Platform.OS === "web" && width >= 800;


  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [addingToPantry, setAddingToPantry] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);

  const { loadCartSummary } = useCartStore();

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: "#dcdcdc",
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface,
    color: colors.text,
  };

  const requireAuth = () => {
    showAppAlert(
      "Inicia sesión",
      "Debes iniciar sesión para usar esta función",
    );
    navigation.navigate("Auth");
  };

  const fetchProduct = async () => {
    try {
      const data = await getProductById(productId);
      const item = data?.data || data?.product || data;
      setProduct(item);
    } catch (error) {
      console.log(
        "PRODUCT DETAIL ERROR:",
        error?.response?.data || error.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedProducts = async () => {
    try {
      setRelatedLoading(true);
      const data = await getRelatedProducts(productId, { limit: 8 });
      const items = data?.related_products || [];
      setRelatedProducts(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log(
        "RELATED PRODUCTS ERROR:",
        error?.response?.data || error.message,
      );
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const data = await getReviewsByProduct(productId);
      const items =
        data?.reviews || data?.data?.reviews || data?.data || data || [];
      setReviews(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log("GET REVIEWS ERROR:", error?.response?.data || error.message);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const fetchMyReview = async () => {
    if (!token) {
      setMyReview(null);
      setReviewRating("5");
      setReviewComment("");
      return;
    }

    try {
      const data = await getMyReviewByProduct(productId);
      const item =
        data?.review || data?.data?.review || data?.data || data || null;

      if (item && item._id) {
        setMyReview(item);
        setReviewRating(String(item.rating ?? 5));
        setReviewComment(item.comment || "");
      } else {
        setMyReview(null);
        setReviewRating("5");
        setReviewComment("");
      }
    } catch (error) {
      console.log(
        "GET MY REVIEW ERROR:",
        error?.response?.data || error.message,
      );
      setMyReview(null);
      setReviewRating("5");
      setReviewComment("");
    }
  };

  const fetchFavoriteStatus = async () => {
    if (!token) {
      setIsFavorite(false);
      return;
    }

    try {
      const data = await checkFavorite(productId);
      const favoriteValue =
        data?.is_favorite ?? data?.isFavorite ?? data?.favorite ?? false;
      setIsFavorite(!!favoriteValue);
    } catch (error) {
      console.log(
        "CHECK FAVORITE ERROR:",
        error?.response?.data || error.message,
      );
      setIsFavorite(false);
    }
  };

  const handleAddToCart = async () => {
    // Compra sin cuenta: el carrito de invitado (x-guest-id) ya funciona en el
    // backend; no exigimos login para agregar (igual que ProductsScreen).
    if (!product?._id) return;

    try {
      setAdding(true);

      await addItemToCart({
        productId: product._id,
        quantity: selectedQuantity,
      });

      await loadCartSummary();
      showToast("Producto agregado al carrito");
    } catch (error) {
      console.log("ADD TO CART ERROR:", error?.response?.data || error.message);
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo agregar al carrito",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleAddToPantry = async () => {
    if (!token) {
      requireAuth();
      return;
    }

    if (!product?._id) return;

    try {
      setAddingToPantry(true);

      await addItemToPantry({
        productId: product._id,
        quantity: 1,
        frequency: "monthly",
      });

      showToast("Guardado en Mi Despensa");
    } catch (error) {
      console.log(
        "ADD TO PANTRY ERROR:",
        error?.response?.data || error.message,
      );
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo agregar a la despensa",
      );
    } finally {
      setAddingToPantry(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!token) {
      requireAuth();
      return;
    }

    try {
      setFavoriteLoading(true);

      if (isFavorite) {
        await removeFavorite(productId);
        setIsFavorite(false);
      } else {
        await addFavorite(productId);
        setIsFavorite(true);
      }
    } catch (error) {
      console.log(
        "TOGGLE FAVORITE ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudo actualizar favorito");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!token) {
      requireAuth();
      return;
    }

    const ratingNumber = Number(reviewRating);

    if (!ratingNumber || ratingNumber < 1 || ratingNumber > 5) {
      showAppAlert("Error", "La calificación debe ser entre 1 y 5");
      return;
    }

    try {
      setReviewSubmitting(true);

      if (myReview?._id) {
        await updateMyReview({
          productId,
          rating: ratingNumber,
          comment: reviewComment,
        });
        showAppAlert("Éxito", "Reseña actualizada");
      } else {
        await createReview({
          productId,
          rating: ratingNumber,
          comment: reviewComment,
        });
        showAppAlert("Éxito", "Reseña creada");
      }

      await fetchMyReview();
      await fetchReviews();
    } catch (error) {
      console.log(
        "SUBMIT REVIEW ERROR:",
        error?.response?.data || error.message,
      );
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo guardar la reseña",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!token) {
      requireAuth();
      return;
    }

    try {
      setReviewSubmitting(true);
      await deleteMyReview(productId);
      setMyReview(null);
      setReviewRating("5");
      setReviewComment("");
      await fetchReviews();
      showAppAlert("Éxito", "Reseña eliminada");
    } catch (error) {
      console.log(
        "DELETE REVIEW ERROR:",
        error?.response?.data || error.message,
      );
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo eliminar la reseña",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Solo por caja: +/- se mueven de a una caja (min_qty del tier de caja).
  const handleDecreaseQuantity = () => {
    const step = selectedTier?.min_qty || 1;
    setSelectedQuantity((prev) => Math.max(step, prev - step));
  };

  const handleIncreaseQuantity = () => {
    const step = selectedTier?.min_qty || 1;
    setSelectedQuantity((prev) => prev + step);
  };

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    fetchRelatedProducts();
  }, [productId]);

  useEffect(() => {
    fetchFavoriteStatus();
  }, [productId, token]);

  useEffect(() => {
    fetchMyReview();
  }, [productId, token]);

  useEffect(() => {
    if (product?.pricing?.tiers?.length) {
      // Supermercado: parte en 1 unidad. El tramo del pack (si existe) lo
      // aplica el backend solo cuando la cantidad llega a pack_size.
      const unidad = product.pricing.tiers.find((t) => Number(t.min_qty) === 1);
      const defaultTier = unidad || product.pricing.tiers[0];
      setSelectedTier(defaultTier);
      setSelectedQuantity(1);
    }

    if (Array.isArray(product?.images) && product.images.length > 0) {
      setSelectedImage(product.images[0]);
    } else if (product?.thumbnail) {
      setSelectedImage(product.thumbnail);
    }
  }, [product]);

  const imageList = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images;
    }
    if (product?.thumbnail) {
      return [product.thumbnail];
    }
    return [];
  }, [product]);

  const boxItems = useMemo(() => {
    if (product?.product_type !== "box") return [];
    if (!Array.isArray(product?.box_items)) return [];
    return product.box_items.filter((item) => item?.product_id);
  }, [product]);

  // ── Breadcrumb navegable ──────────────────────────────────────────────────
  const breadcrumbCats = useMemo(() => {
    if (Array.isArray(product?.categories) && product.categories.length) {
      return [...product.categories].reverse(); // [hijo, padre] → invertir a [padre, hijo]
    }
    if (product?.category?.name) {
      return [{ id: product.category.id, name: product.category.name }];
    }
    return [];
  }, [product]);

  const renderBreadcrumb = () => (
    <View style={{
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 14,
      gap: 2,
    }}>
      <Pressable onPress={() => navigation.navigate(isWebDesktop ? "Inicio" : "MainTabs")}>
        <AppText style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
          Inicio
        </AppText>
      </Pressable>

      {breadcrumbCats.map((cat, i) => (
        <View key={cat.id || i} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Ionicons name="chevron-forward" size={12} color={colors.muted} />
          <Pressable onPress={() => navigation.navigate("Products", { category: cat.id })}>
            <AppText style={{
              fontSize: 12,
              color: i === breadcrumbCats.length - 1 ? colors.text : colors.primary,
              fontWeight: i === breadcrumbCats.length - 1 ? "700" : "600",
            }}>
              {cat.name}
            </AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer maxWidth={1200}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer maxWidth={1200}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AppText style={{ color: colors.text }}>
            No se pudo cargar el producto
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  const baseTierPrice = product?.pricing?.tiers?.[0]?.price || 0;
  const selectedTierPrice = selectedTier?.price || baseTierPrice || 0;
  const estimatedSubtotal = selectedTierPrice * selectedQuantity;
  const baseSubtotal = baseTierPrice * selectedQuantity;
  const estimatedSavings =
    selectedTierPrice < baseTierPrice ? baseSubtotal - estimatedSubtotal : 0;

  // tier.price es POR UNIDAD; el precio de UNA caja = price * min_qty.
  const cajaQty = selectedTier?.min_qty || 1;
  const cajaTotal = selectedTierPrice * cajaQty;
  const isCaja = cajaQty > 1;
  // Solo tiers de caja/pack son comprables (nunca por unidad).
  const purchasableTiers = (product?.pricing?.tiers || []).filter(
    (t) => (t?.min_qty || 1) > 1,
  );
  const selectableTiers = purchasableTiers.length
    ? purchasableTiers
    : product?.pricing?.tiers || [];

  const renderBoxContents = () => {
    if (product?.product_type !== "box" || !boxItems.length) return null;

    return (
      <View style={cardStyle}>
        <AppText
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: colors.text,
            marginBottom: 10,
          }}
        >
          Qué contiene esta caja
        </AppText>

        <AppText
          style={{
            color: colors.muted,
            marginBottom: 16,
            lineHeight: 22,
          }}
        >
          Esta caja incluye los siguientes productos:
        </AppText>

        {boxItems.map((item, index) => {
          const childProduct = item.product_id;
          const image =
            childProduct?.thumbnail ||
            childProduct?.images?.[0] ||
            "https://via.placeholder.com/120";

          const unitPrice = childProduct?.pricing?.tiers?.[0]?.price || 0;

          return (
            <View
              key={`${childProduct?._id || index}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: radius.md,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Image
                  source={{ uri: image }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppText
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {item.quantity} x {childProduct?.name || "Producto"}
                </AppText>

                {childProduct?.brand ? (
                  <AppText
                    style={{
                      color: colors.muted,
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    Marca: {childProduct.brand}
                  </AppText>
                ) : null}

                <AppText
                  style={{
                    color: colors.muted,
                    fontSize: 13,
                  }}
                >
                  Precio referencia: ${unitPrice}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPurchaseCard = () => (
    <View
      style={{
        ...cardStyle,
        ...(isWebDesktop 
          ? {
              position: "sticky",
              top: 24,
              alignSelf: "flex-start",
            }
          : {}),
      }}
    >
      <AppText
        style={{
          fontSize: isWebDesktop  ? 30 : 28,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 8,
        }}
      >
        {product.name}
      </AppText>

      {/* Comparación de precio — el número grande es el precio de la caja */}
      {(() => {
        const cpUnit = Number(product?.compare_price || 0);
        const hasCmp = cpUnit > 0 && selectedTierPrice > 0 && cpUnit > selectedTierPrice;
        const cpCaja = cpUnit * cajaQty;
        const savedCaja = hasCmp ? cpCaja - cajaTotal : 0;
        const pct = hasCmp ? Math.round((1 - selectedTierPrice / cpUnit) * 100) : 0;
        return (
          <View style={{ marginBottom: 14 }}>
            {hasCmp && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <AppText style={{ fontSize: 15, color: colors.muted, textDecorationLine: "line-through" }}>
                  ${cpCaja.toLocaleString("es-CL")}
                </AppText>
                <AppText style={{ fontSize: 12, color: colors.muted }}>
                  En supermercado
                </AppText>
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <AppText style={{ fontSize: 32, fontWeight: "900", color: colors.text }}>
                ${cajaTotal ? cajaTotal.toLocaleString("es-CL") : "—"}
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.accent, fontWeight: "800" }}>
                {isCaja ? "/ caja" : "/ un"}
              </AppText>
              {hasCmp && (
                <View style={{
                  backgroundColor: "#dcfce7",
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}>
                  <AppText style={{ fontSize: 13, fontWeight: "800", color: "#16a34a" }}>
                    -{pct}%
                  </AppText>
                </View>
              )}
            </View>
            {isCaja && (
              <AppText style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                ≈ ${selectedTierPrice.toLocaleString("es-CL")} c/u · caja de {cajaQty} un
              </AppText>
            )}
            {hasCmp && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 6,
                backgroundColor: "#f0fdf4",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignSelf: "flex-start",
              }}>
                <AppText style={{ fontSize: 13, fontWeight: "800", color: "#16a34a" }}>
                  Ahorras ${savedCaja.toLocaleString("es-CL")} vs supermercado por caja
                </AppText>
              </View>
            )}
          </View>
        );
      })()}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {(product?.reviews_count ?? 0) > 0 ? (
          <View
            style={{
              backgroundColor: "#111",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              ⭐ {(product?.average_rating ?? 0).toFixed(1)} ·{" "}
              {product?.reviews_count} reseñas
            </AppText>
          </View>
        ) : null}

        {(product?.pricing?.tiers?.length || 0) > 1 ? (
          <View
            style={{
              backgroundColor: "#0f766e",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              Pack disponible
            </AppText>
          </View>
        ) : null}

        {product?.cibox_plus?.enabled ? (
          <View
            style={{
              backgroundColor: "#7c3aed",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              Beneficio Cibox+
            </AppText>
          </View>
        ) : null}

        {product?.product_type === "box" ? (
          <View
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              Caja Cibox
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText style={{ color: colors.muted, marginBottom: 18 }}>
        Puntuación promedio: {product?.average_rating ?? 0} · Reseñas:{" "}
        {product?.reviews_count ?? 0}
      </AppText>

      {(product?.pricing?.tiers?.length || 0) > 0 ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 16,
            marginBottom: 20,
          }}
        >
          <AppText
            style={{
              fontWeight: "700",
              color: colors.text,
              marginBottom: 12,
              fontSize: 16,
            }}
          >
            {product?.product_type === "box"
              ? "Opciones de compra"
              : "Opciones de precio"}
          </AppText>

          <View style={{ marginBottom: 16 }}>
            <AppText
              style={{
                color: colors.muted,
                marginBottom: 10,
              }}
            >
              {isCaja
                ? `Cajas: ${Math.max(1, Math.round(selectedQuantity / cajaQty))} · ${selectedQuantity} unidades`
                : `Cantidad seleccionada: ${selectedQuantity}`}
            </AppText>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={handleDecreaseQuantity}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "#f0f0f0",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <AppText
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  -
                </AppText>
              </Pressable>

              <AppText
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.text,
                  minWidth: 30,
                  textAlign: "center",
                  marginRight: 12,
                }}
              >
                {selectedQuantity}
              </AppText>

              <Pressable
                onPress={handleIncreaseQuantity}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "#f0f0f0",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <AppText
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  +
                </AppText>
              </Pressable>
            </View>

            {selectedTier?.min_qty > 1 ? (
              <AppText
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                Venta por caja de {selectedTier.min_qty} unidades. El + y − mueven
                una caja completa.
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: 12,
              backgroundColor: "#fafafa",
              marginBottom: 14,
            }}
          >
            <AppText
              style={{
                color: colors.text,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Resumen estimado
            </AppText>

            <AppText style={{ color: colors.muted, marginBottom: 4 }}>
              {product?.product_type === "box"
                ? `Precio por caja: $${Number(cajaTotal).toLocaleString("es-CL")}`
                : `Precio unitario: $${Number(selectedTierPrice).toLocaleString("es-CL")}`}
            </AppText>

            <AppText style={{ color: colors.muted, marginBottom: 4 }}>
              Cantidad: {selectedQuantity}
            </AppText>

            <AppText
              style={{
                color: colors.text,
                fontWeight: "700",
                marginBottom: estimatedSavings > 0 ? 4 : 0,
              }}
            >
              Subtotal estimado: ${Number(estimatedSubtotal).toLocaleString("es-CL")}
            </AppText>

            {estimatedSavings > 0 ? (
              <AppText style={{ color: colors.success, fontSize: 12 }}>
                Ahorro estimado vs precio base: ${Number(estimatedSavings).toLocaleString("es-CL")}
              </AppText>
            ) : null}
          </View>

          {/* ── Tabla de precios mayoristas ── */}
          {(product?.pricing?.tiers?.length || 0) > 1 ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "#f5f5f5",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <AppText style={{ flex: 1.4, fontSize: 12, fontWeight: "800", color: colors.text }}>
                  Cantidad mínima
                </AppText>
                <AppText style={{ flex: 1, fontSize: 12, fontWeight: "800", color: colors.text, textAlign: "right" }}>
                  Precio c/u
                </AppText>
                <AppText style={{ flex: 0.9, fontSize: 12, fontWeight: "800", color: colors.text, textAlign: "right" }}>
                  Ahorro %
                </AppText>
              </View>

              {product.pricing.tiers
                .filter((t) => (t?.min_qty || 1) > 1)
                .map((tier, index) => {
                const pct =
                  baseTierPrice > 0 && tier.price < baseTierPrice
                    ? Math.round(((baseTierPrice - tier.price) / baseTierPrice) * 100)
                    : 0;
                const qtyLabel =
                  tier.label ||
                  (tier.min_qty > 1 ? `${tier.min_qty} un` : "Unidad");

                return (
                  <View
                    key={`tier-row-${tier.min_qty}-${index}`}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <AppText style={{ flex: 1.4, fontSize: 13, color: colors.text }}>
                      {qtyLabel}
                    </AppText>
                    <AppText style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.text, textAlign: "right" }}>
                      ${Number(tier.price).toLocaleString("es-CL")}
                    </AppText>
                    <AppText
                      style={{
                        flex: 0.9,
                        fontSize: 13,
                        fontWeight: "700",
                        color: pct > 0 ? colors.success : colors.muted,
                        textAlign: "right",
                      }}
                    >
                      {pct > 0 ? `-${pct}%` : "—"}
                    </AppText>
                  </View>
                );
              })}
            </View>
          ) : null}

          {selectableTiers.map((tier, index) => {
            const isSelected = selectedTier?.min_qty === tier.min_qty;
            const tierQty = tier.min_qty || 1;
            const tierCajaTotal = tier.price * tierQty;
            const savingsPerUnit =
              tier.min_qty > 1 ? Math.max(baseTierPrice - tier.price, 0) : 0;
            const savingsAtMinimum =
              tier.min_qty > 1 ? savingsPerUnit * tierQty : 0;

            return (
              <Pressable
                key={`${tier.min_qty}-${index}`}
                onPress={() => {
                  const prevStep = selectedTier?.min_qty || 1;
                  const newStep = tier.min_qty || 1;
                  const cajas = Math.max(1, Math.round(selectedQuantity / prevStep));
                  setSelectedTier(tier);
                  setSelectedQuantity(cajas * newStep);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: isSelected ? colors.text : colors.border,
                  borderRadius: radius.md,
                  padding: 12,
                  marginBottom: 10,
                  backgroundColor: isSelected ? "#f5f5f5" : colors.surface,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <AppText
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                    }}
                  >
                    {tier.label
                      ? tier.label
                      : tier.min_qty > 1
                        ? `${product?.product_type === "box" ? "Pack de cajas" : "Caja"} · ${tier.min_qty} unidades`
                        : "Unidad"}
                  </AppText>

                  <AppText
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                    }}
                  >
                    ${tierCajaTotal.toLocaleString("es-CL")}
                  </AppText>
                </View>

                {tier.min_qty > 1 ? (
                  <>
                    <AppText style={{ color: colors.muted, fontSize: 12 }}>
                      ≈ ${tier.price.toLocaleString("es-CL")} c/u · Mejor precio por
                      volumen
                    </AppText>

                    {savingsAtMinimum > 0 ? (
                      <AppText
                        style={{
                          color: colors.success,
                          fontSize: 12,
                          marginTop: 4,
                          fontWeight: "700",
                        }}
                      >
                        Ahorras ${savingsAtMinimum.toLocaleString("es-CL")} por caja
                      </AppText>
                    ) : null}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <AppButton
        title={adding ? "Agregando..." : "Agregar al carrito"}
        onPress={handleAddToCart}
        disabled={adding}
      />

      <AppButton
        title={
          addingToPantry
            ? "Agregando a Mi Despensa..."
            : "+ Agregar a Mi Despensa"
        }
        onPress={handleAddToPantry}
        disabled={addingToPantry}
        variant="secondary"
        style={{ marginTop: 12 }}
      />

      <AppButton
        title={
          favoriteLoading
            ? "Cargando..."
            : isFavorite
              ? "Quitar de favoritos"
              : "Agregar a favoritos"
        }
        onPress={handleToggleFavorite}
        disabled={favoriteLoading}
        variant="secondary"
        style={{ marginTop: 12 }}
      />
    </View>
  );

  if (!isWebDesktop ) {
    return (
      <ScreenContainer maxWidth={720}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {renderBreadcrumb()}
          <View style={cardStyle}>
            {Array.isArray(product?.images) && product.images.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {product.images.map((url, index) => (
                  <View
                    key={`${url}-${index}`}
                    style={{
                      width: 260,
                      height: 260,
                      marginRight: 10,
                      borderRadius: radius.md,
                      backgroundColor: "#fff",
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Image
                      source={{ uri: url }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            ) : product?.thumbnail ? (
              <View
                style={{
                  width: "100%",
                  height: 260,
                  marginBottom: 16,
                  borderRadius: radius.md,
                  backgroundColor: "#fff",
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={{ uri: product.thumbnail }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            {renderPurchaseCard()}

            <AppText
              style={{
                fontWeight: "700",
                color: colors.text,
                marginTop: 18,
                marginBottom: 8,
                fontSize: 16,
              }}
            >
              Descripción
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                lineHeight: 22,
                marginBottom: 20,
              }}
            >
              {product.description || "Sin descripción"}
            </AppText>

            {renderBoxContents()}
          </View>

          <View style={{ height: spacing.md }} />

          <View style={cardStyle}>
            <AppText
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 14,
              }}
            >
              Tu reseña
            </AppText>

            {!token ? (
              <AppText style={{ color: colors.muted }}>
                Inicia sesión para crear tu reseña.
              </AppText>
            ) : (
              <>
                <AppText
                  style={{
                    marginBottom: 6,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Puntuación (1 a 5)
                </AppText>

                <TextInput
                  value={reviewRating}
                  onChangeText={setReviewRating}
                  keyboardType="numeric"
                  placeholder="5"
                  style={{
                    ...inputStyle,
                    marginBottom: 14,
                  }}
                />

                <AppText
                  style={{
                    marginBottom: 6,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Comentario
                </AppText>

                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Escribe tu reseña"
                  multiline
                  style={{
                    ...inputStyle,
                    minHeight: 110,
                    textAlignVertical: "top",
                    marginBottom: 14,
                  }}
                />

                <AppButton
                  title={
                    reviewSubmitting
                      ? "Guardando..."
                      : myReview?._id
                        ? "Actualizar reseña"
                        : "Crear reseña"
                  }
                  onPress={handleSubmitReview}
                  disabled={reviewSubmitting}
                />

                {myReview?._id ? (
                  <AppButton
                    title="Eliminar reseña"
                    onPress={handleDeleteReview}
                    disabled={reviewSubmitting}
                    variant="secondary"
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </>
            )}
          </View>

          <View style={{ height: spacing.md }} />

          <View style={cardStyle}>
            <AppText
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 14,
              }}
            >
              Reseñas del producto
            </AppText>

            {reviewsLoading ? (
              <AppText style={{ color: colors.muted }}>
                Cargando reseñas...
              </AppText>
            ) : !reviews.length ? (
              <AppText style={{ color: colors.muted }}>
                Este producto aún no tiene reseñas.
              </AppText>
            ) : (
              reviews.map((item) => (
                <View
                  key={item._id}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 12,
                    marginTop: 12,
                  }}
                >
                  <AppText
                    style={{
                      fontWeight: "700",
                      marginBottom: 4,
                      color: colors.text,
                    }}
                  >
                    Rating: {item.rating}/5
                  </AppText>

                  <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                    {item.comment || "Sin comentario"}
                  </AppText>

                  <AppText style={{ color: colors.muted, fontSize: 12 }}>
                    {item.user_id?.name ||
                      item.user?.name ||
                      item.user?.email ||
                      "Cliente"}
                  </AppText>
                </View>
              ))
            )}
          </View>

          <View style={{ height: spacing.md }} />

          <View style={{ marginTop: spacing.md }}>
            {relatedLoading ? (
              <AppText style={{ color: colors.muted }}>
                Cargando productos relacionados...
              </AppText>
            ) : (
              <ProductRowSection
                title="Productos relacionados"
                products={relatedProducts}
                onPressProduct={(item) =>
                  navigation.push("ProductDetail", { productId: item._id })
                }
              />
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={1280}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {renderBreadcrumb()}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flex: 1.15 }}>
            <View style={{ ...cardStyle, padding: spacing.lg }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.md,
                }}
              >
                <View style={{ width: 88 }}>
                  {imageList.map((url, index) => {
                    const isActive = selectedImage === url;

                    return (
                      <Pressable
                        key={`${url}-${index}`}
                        onPress={() => setSelectedImage(url)}
                        style={{
                          width: 88,
                          height: 88,
                          marginBottom: 10,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: isActive
                            ? colors.primary
                            : colors.border,
                          backgroundColor: "#fff",
                          overflow: "hidden",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Image
                          source={{ uri: url }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="contain"
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={{
                    flex: 1,
                    minHeight: 520,
                    borderRadius: radius.lg,
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: spacing.lg,
                  }}
                >
                  {selectedImage ? (
                    <Image
                      source={{ uri: selectedImage }}
                      style={{ width: "100%", height: 480 }}
                      resizeMode="contain"
                    />
                  ) : null}
                </View>
              </View>
            </View>

            <View style={{ height: spacing.md }} />

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Descripción
              </AppText>

              <AppText
                style={{
                  color: colors.muted,
                  lineHeight: 24,
                }}
              >
                {product.description || "Sin descripción"}
              </AppText>
            </View>

            {product?.product_type === "box" && boxItems.length ? (
              <>
                <View style={{ height: spacing.md }} />
                {renderBoxContents()}
              </>
            ) : null}

            <View style={{ height: spacing.md }} />

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 14,
                }}
              >
                Tu reseña
              </AppText>

              {!token ? (
                <AppText style={{ color: colors.muted }}>
                  Inicia sesión para crear tu reseña.
                </AppText>
              ) : (
                <>
                  <AppText
                    style={{
                      marginBottom: 6,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    Puntuación (1 a 5)
                  </AppText>

                  <TextInput
                    value={reviewRating}
                    onChangeText={setReviewRating}
                    keyboardType="numeric"
                    placeholder="5"
                    style={{
                      ...inputStyle,
                      marginBottom: 14,
                    }}
                  />

                  <AppText
                    style={{
                      marginBottom: 6,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    Comentario
                  </AppText>

                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="Escribe tu reseña"
                    multiline
                    style={{
                      ...inputStyle,
                      minHeight: 110,
                      textAlignVertical: "top",
                      marginBottom: 14,
                    }}
                  />

                  <AppButton
                    title={
                      reviewSubmitting
                        ? "Guardando..."
                        : myReview?._id
                          ? "Actualizar reseña"
                          : "Crear reseña"
                    }
                    onPress={handleSubmitReview}
                    disabled={reviewSubmitting}
                  />

                  {myReview?._id ? (
                    <AppButton
                      title="Eliminar reseña"
                      onPress={handleDeleteReview}
                      disabled={reviewSubmitting}
                      variant="secondary"
                      style={{ marginTop: 10 }}
                    />
                  ) : null}
                </>
              )}
            </View>

            <View style={{ height: spacing.md }} />

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 14,
                }}
              >
                Reseñas del producto
              </AppText>

              {reviewsLoading ? (
                <AppText style={{ color: colors.muted }}>
                  Cargando reseñas...
                </AppText>
              ) : !reviews.length ? (
                <AppText style={{ color: colors.muted }}>
                  Este producto aún no tiene reseñas.
                </AppText>
              ) : (
                reviews.map((item) => (
                  <View
                    key={item._id}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: 14,
                      marginTop: 14,
                    }}
                  >
                    <AppText
                      style={{
                        fontWeight: "700",
                        marginBottom: 4,
                        color: colors.text,
                      }}
                    >
                      Rating: {item.rating}/5
                    </AppText>

                    <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                      {item.comment || "Sin comentario"}
                    </AppText>

                    <AppText style={{ color: colors.muted, fontSize: 12 }}>
                      {item.user_id?.name ||
                        item.user?.name ||
                        item.user?.email ||
                        "Cliente"}
                    </AppText>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={{ width: 390 }}>{renderPurchaseCard()}</View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          {relatedLoading ? (
            <AppText style={{ color: colors.muted }}>
              Cargando productos relacionados...
            </AppText>
          ) : (
            <ProductRowSection
              title="Productos relacionados"
              products={relatedProducts}
              onPressProduct={(item) =>
                navigation.push("ProductDetail", { productId: item._id })
              }
            />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
