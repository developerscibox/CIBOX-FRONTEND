import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
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
import { esAlcohol } from "../constants/alcohol";
import { exigirMayoriaDeEdad } from "../store/edadStore";
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
import UnitPrice from "../components/UnitPrice";

// ── Visor de imágenes ────────────────────────────────────────────────────────
// Las fotos de envase traen el gramaje y los ingredientes en letra chica: al
// tamaño de la ficha no se leen. Por eso la foto se puede abrir a pantalla
// completa y ampliar.
const ZOOM_MAX = 3; // 3x alcanza para leer una etiqueta de 100 g
const ZOOM_STEP = 0.5;

// Alto del bloque de controles de abajo, que es el más alto de los dos: margen
// 16 + píldora de escala 50 + hueco 10 + pista 28 + margen 16 = 120. Como la
// foto va centrada hay que reservar lo mismo arriba y abajo, así que el
// escenario cede 2 × este valor.
const ZOOM_CHROME = 120;

// Fondo del visor: el navy de marca (#003D49) casi opaco. Oscuro para que mande
// la foto, pero de la familia azul y no un negro genérico.
const ZOOM_BACKDROP = "rgba(0, 61, 73, 0.96)";

const absoluteFill = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

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

  // Visor a pantalla completa: guardamos desde qué foto se abrió para que el
  // visor arranque en la que el cliente tocó, no siempre en la primera.
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  const openZoom = (index) => {
    setZoomIndex(Math.max(0, index || 0));
    setZoomVisible(true);
  };

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
    // El gris suelto se reemplaza por el borde de la paleta.
    borderColor: colors.border,
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
      // La categoría se pasa para que sean de verdad relacionados y no los 8
      // primeros del catálogo completo.
      const data = await getRelatedProducts(productId, {
        limit: 8,
        categoryId: product?.category?._id || product?.category?.id || undefined,
      });
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

    // Alcohol: hay que declarar mayoría de edad antes de agregarlo (Ley 19.925).
    if (esAlcohol(product) && !(await exigirMayoriaDeEdad())) {
      showToast("No podemos venderte alcohol si eres menor de 18 años");
      return;
    }

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

  // Pista de "se puede ampliar": sin ella nadie adivina que la foto es tocable.
  // Chip lima porque es una acción, con texto oscuro encima (el blanco sobre
  // lima rinde 1,9:1).
  const renderZoomHint = (label) => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: spacing.sm,
        bottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.accent,
        borderRadius: 999,
        paddingHorizontal: label ? 12 : 8,
        paddingVertical: 8,
      }}
    >
      <Ionicons name="search" size={16} color={colors.accentText} />
      {label ? (
        <AppText
          style={{ fontSize: 13, fontWeight: "800", color: colors.accentText }}
        >
          {label}
        </AppText>
      ) : null}
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
            // Titulares en azul Cibox (manual, punto 03).
            color: colors.primary,
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
                  backgroundColor: colors.surface,
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
          // El nombre es el titular de la ficha: azul Cibox.
          color: colors.primary,
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* El precio va en azul y no en lima: el lima sobre blanco rinde
                  1,9:1 y no se lee. El lima entra como fondo del chip. */}
              <AppText style={{ fontSize: 32, fontWeight: "900", color: colors.primary }}>
                ${cajaTotal ? cajaTotal.toLocaleString("es-CL") : "—"}
              </AppText>
              <View style={{
                backgroundColor: colors.primaryDark,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
                <AppText style={{ fontSize: 13, color: colors.primaryText, fontWeight: "800" }}>
                  {isCaja ? "por caja" : "por unidad"}
                </AppText>
              </View>
              {hasCmp && (
                // El descuento es lo que hay que mirar: va en lima, el color de
                // acento de la marca, con texto oscuro encima.
                <View style={{
                  backgroundColor: colors.discount,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}>
                  <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.accentText }}>
                    -{pct}%
                  </AppText>
                </View>
              )}
            </View>
            {/* PPUM — decreto 38/2024, art. 9°: junto al precio, mismo campo visual. */}
            <UnitPrice product={product} unitPrice={selectedTierPrice} priceSize={32} style={{ marginTop: 4 }} />

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
                // Lima rebajado: resalta el ahorro sin convertirse en un fondo
                // extenso de lima puro, que el manual reserva para acentos.
                backgroundColor: colors.primaryLight,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignSelf: "flex-start",
              }}>
                <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.accentText }}>
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
              // Los distintivos pasan a la familia azul: negro, teal y violeta
              // eran restos de la identidad anterior.
              backgroundColor: colors.primary,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
              ⭐ {(product?.average_rating ?? 0).toFixed(1)} ·{" "}
              {product?.reviews_count} reseñas
            </AppText>
          </View>
        ) : null}

        {(product?.pricing?.tiers?.length || 0) > 1 ? (
          <View
            style={{
              backgroundColor: colors.primaryMid,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
              Pack disponible
            </AppText>
          </View>
        ) : null}

        {product?.cibox_plus?.enabled ? (
          <View
            style={{
              backgroundColor: colors.primaryDark,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              marginRight: 8,
              marginBottom: 8,
            }}
          >
            <AppText style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
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
            <AppText style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
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
              color: colors.primary,
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
                  // Fondo de la paleta y signo azul: antes era gris sobre gris.
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <AppText
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.primary,
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
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <AppText
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.primary,
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
              backgroundColor: colors.background,
              marginBottom: 14,
            }}
          >
            <AppText
              style={{
                color: colors.primary,
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
                  backgroundColor: colors.background,
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
                  borderWidth: isSelected ? 2 : 1,
                  // El tramo elegido se marca con azul de marca y un velo del
                  // mismo azul al 6%, en vez del gris neutro anterior.
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: radius.md,
                  padding: 12,
                  marginBottom: 10,
                  backgroundColor: isSelected ? `${colors.primary}0F` : colors.surface,
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
                  // Cada foto abre el visor en su propia posición: si el cliente
                  // desliza hasta la tercera, amplía la tercera.
                  <Pressable
                    key={`${url}-${index}`}
                    onPress={() => openZoom(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ampliar la imagen ${index + 1} del producto`}
                    style={{
                      width: 260,
                      height: 260,
                      marginRight: 10,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
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
                    {renderZoomHint()}
                  </Pressable>
                ))}
              </ScrollView>
            ) : product?.thumbnail ? (
              <Pressable
                onPress={() => openZoom(0)}
                accessibilityRole="button"
                accessibilityLabel="Ampliar la imagen del producto"
                style={{
                  width: "100%",
                  height: 260,
                  marginBottom: 16,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
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
                {renderZoomHint()}
              </Pressable>
            ) : null}

            {renderPurchaseCard()}

            <AppText
              style={{
                fontWeight: "700",
                color: colors.primary,
                marginTop: 18,
                marginBottom: 8,
                fontSize: 16,
              }}
            >
              Descripción
            </AppText>

            {/* Sin fontSize caía a los 14px por defecto de AppText; el cap. 13
                pide 16 como mínimo en cuerpo, y esto es la descripción. */}
            <AppText
              style={{
                fontSize: 16,
                color: colors.muted,
                lineHeight: 24,
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
                color: colors.primary,
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
                color: colors.primary,
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

        <ZoomViewer
          visible={zoomVisible}
          images={imageList}
          startIndex={zoomIndex}
          onClose={() => setZoomVisible(false)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={1200}>
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
                          // La miniatura activa se marca con borde azul grueso.
                          borderWidth: isActive ? 2 : 1,
                          borderColor: isActive
                            ? colors.primary
                            : colors.border,
                          backgroundColor: colors.surface,
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

                {/* La foto grande abre el visor. Con ratón el cursor cambia a
                    lupa para que se note que es tocable. */}
                <Pressable
                  onPress={() =>
                    openZoom(Math.max(0, imageList.indexOf(selectedImage)))
                  }
                  disabled={!selectedImage}
                  accessibilityRole="button"
                  accessibilityLabel="Ampliar la imagen del producto"
                  style={{
                    flex: 1,
                    minHeight: 520,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: spacing.lg,
                    ...(Platform.OS === "web" && selectedImage
                      ? { cursor: "zoom-in" }
                      : null),
                  }}
                >
                  {selectedImage ? (
                    <>
                      <Image
                        source={{ uri: selectedImage }}
                        style={{ width: "100%", height: 480 }}
                        resizeMode="contain"
                      />
                      {renderZoomHint("Ampliar")}
                    </>
                  ) : null}
                </Pressable>
              </View>
            </View>

            <View style={{ height: spacing.md }} />

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: colors.primary,
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
                  color: colors.primary,
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
                  color: colors.primary,
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

      <ZoomViewer
        visible={zoomVisible}
        images={imageList}
        startIndex={zoomIndex}
        onClose={() => setZoomVisible(false)}
      />
    </ScreenContainer>
  );
}

/**
 * Visor de imágenes a pantalla completa.
 *
 * Vive en este archivo y no en `components/` porque hoy solo lo usa la ficha; si
 * otra pantalla lo necesita, se extrae entonces.
 *
 * Cómo se maneja:
 *  - Un toque (o clic) sobre la foto amplía a 2x en el punto tocado; otro toque
 *    vuelve a 1x. Se usa toque simple y no doble toque porque es más
 *    descubrible y se comporta igual con el dedo que con el ratón.
 *  - Arrastrar mueve la foto cuando está ampliada (PanResponder funciona en web
 *    porque react-native-web implementa el sistema de responder con eventos de
 *    puntero: sirve para dedo y para ratón sin código aparte).
 *  - Pinza de dos dedos en móvil y rueda del ratón en web.
 *  - Los botones +/- están igual: son el camino evidente y el accesible.
 *  - Cierra con la X, tocando el fondo y con Escape en web.
 */
function ZoomViewer({ visible, images, startIndex, onClose }) {
  const { width, height } = useWindowDimensions();
  const compact = width < 768;

  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Los gestos leen refs y no estado: el PanResponder se crea una sola vez y sus
  // callbacks se quedarían con los valores del primer render.
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef(null);
  const stageRef = useRef({ w: 0, h: 0 });
  const indexRef = useRef(0);
  const rootRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const total = Array.isArray(images) ? images.length : 0;

  // El escenario ocupa todo salvo la barra de arriba (botón + margen) y los
  // controles de abajo (píldora + pista + margen): la foto sale lo más grande
  // que quepa sin que nada se pise. Se reserva el mismo alto arriba y abajo
  // porque la foto va centrada; con los 184/196 de antes no alcanzaba y la
  // pista de abajo caía sobre la foto en cuanto la foto era vertical.
  const stageWidth = Math.max(200, width - spacing.md * 2);
  const stageHeight = Math.max(200, height - ZOOM_CHROME * 2);
  stageRef.current = { w: stageWidth, h: stageHeight };

  const applyZoom = (nextRaw, focal) => {
    const { w, h } = stageRef.current;
    const previous = scaleRef.current;
    const next = Math.min(
      ZOOM_MAX,
      Math.max(1, Math.round((Number(nextRaw) || 1) * 100) / 100),
    );

    let x = offsetRef.current.x;
    let y = offsetRef.current.y;

    if (next === 1) {
      x = 0;
      y = 0;
    } else if (focal) {
      // `transform` escala respecto del centro y después traslada, así que para
      // llevar al centro un punto que está a `d` del centro hace falta -escala*d.
      x = -next * focal.dx;
      y = -next * focal.dy;
    } else if (previous > 0) {
      // Al cambiar de escala se conserva lo que se estaba mirando.
      const factor = next / previous;
      x *= factor;
      y *= factor;
    }

    // Nunca se despega la foto del marco: el borde no puede entrar al encuadre.
    const maxX = ((next - 1) * w) / 2;
    const maxY = ((next - 1) * h) / 2;
    x = Math.min(maxX, Math.max(-maxX, x));
    y = Math.min(maxY, Math.max(-maxY, y));

    scaleRef.current = next;
    offsetRef.current = { x, y };
    setScale(next);
    setOffset({ x, y });
  };

  const resetZoom = () => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goTo = (nextIndex) => {
    if (total < 2) return;
    const wrapped = ((nextIndex % total) + total) % total;
    indexRef.current = wrapped;
    setIndex(wrapped);
    // Cambiar de foto vuelve a 1x: quedarse ampliado en otra imagen desorienta.
    resetZoom();
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartRef.current = { ...offsetRef.current };
        pinchRef.current = null;
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event?.nativeEvent?.touches || [];

        // Pinza: la escala sigue la razón entre la distancia actual y la inicial.
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          if (!pinchRef.current) {
            pinchRef.current = { distance, scale: scaleRef.current };
          } else {
            applyZoom(
              (pinchRef.current.scale * distance) / pinchRef.current.distance,
            );
          }
          return;
        }

        if (scaleRef.current <= 1) return;

        const { w, h } = stageRef.current;
        const maxX = ((scaleRef.current - 1) * w) / 2;
        const maxY = ((scaleRef.current - 1) * h) / 2;
        const x = Math.min(
          maxX,
          Math.max(-maxX, panStartRef.current.x + gesture.dx),
        );
        const y = Math.min(
          maxY,
          Math.max(-maxY, panStartRef.current.y + gesture.dy),
        );

        offsetRef.current = { x, y };
        setOffset({ x, y });
      },
      onPanResponderRelease: (event, gesture) => {
        if (pinchRef.current) {
          pinchRef.current = null;
          return;
        }

        // Si hubo arrastre no fue un toque: no se toca el zoom.
        if (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6) return;

        if (scaleRef.current > 1) {
          applyZoom(1);
          return;
        }

        // `locationX` sirve solo estando en 1x, que es cuando la imagen ocupa el
        // escenario sin transformar; a partir de ahí las coordenadas coinciden.
        const { w, h } = stageRef.current;
        const lx = event?.nativeEvent?.locationX;
        const ly = event?.nativeEvent?.locationY;
        const focal =
          typeof lx === "number" && typeof ly === "number"
            ? { dx: lx - w / 2, dy: ly - h / 2 }
            : null;

        applyZoom(2, focal);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // Cada apertura arranca limpia y en la foto que el cliente tocó.
  useEffect(() => {
    if (!visible) return;
    const start = Math.min(Math.max(0, startIndex || 0), Math.max(0, total - 1));
    indexRef.current = start;
    setIndex(start);
    resetZoom();
  }, [visible, startIndex, total]);

  // Teclado en web: Escape cierra, las flechas cambian de foto y +/- amplían.
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeRef.current?.();
      } else if (event.key === "ArrowRight") {
        goTo(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(indexRef.current - 1);
      } else if (event.key === "+" || event.key === "=") {
        applyZoom(scaleRef.current + ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        applyZoom(scaleRef.current - ZOOM_STEP);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, total]);

  // Con el visor abierto la página de atrás no se mueve.
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  // Rueda del ratón: amplía y, de paso, corta el scroll que se podría filtrar a
  // la página de atrás. Se engancha al nodo porque react-native-web no expone
  // `onWheel` como prop de View.
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return undefined;

    const node = rootRef.current;
    if (!node || typeof node.addEventListener !== "function") return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const step = event.deltaY > 0 ? -ZOOM_STEP / 2 : ZOOM_STEP / 2;
      applyZoom(scaleRef.current + step);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [visible]);

  if (!total) return null;

  const source = images[Math.min(index, total - 1)];
  const hasMany = total > 1;
  const button = compact ? 42 : 48;

  // Los controles van en navy sólido: sobre el fondo del visor el blanco encima
  // rinde 11,9:1, y una píldora translúcida no garantizaría contraste.
  const controlStyle = {
    width: button,
    height: button,
    borderRadius: button / 2,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View ref={rootRef} style={{ flex: 1, backgroundColor: ZOOM_BACKDROP }}>
        {/* Fondo: tocar fuera de la foto cierra el visor. */}
        <Pressable
          style={absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar el visor de imágenes"
        />

        <View
          pointerEvents="box-none"
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View
            {...responder.panHandlers}
            style={{
              width: stageWidth,
              height: stageHeight,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              ...(Platform.OS === "web"
                ? { cursor: scale > 1 ? "grab" : "zoom-in" }
                : null),
            }}
          >
            <Image
              source={{ uri: source }}
              resizeMode="contain"
              style={{
                width: "100%",
                height: "100%",
                transform: [
                  { translateX: offset.x },
                  { translateY: offset.y },
                  { scale },
                ],
              }}
            />
          </View>
        </View>

        {/* Barra superior: contador y cierre. */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          {hasMany ? (
            <View
              style={{
                backgroundColor: colors.primaryDark,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {index + 1} / {total}
              </AppText>
            </View>
          ) : (
            <View />
          )}

          {/* El cierre va en lima: es la acción, y encima del lima el texto y el
              icono van oscuros (el blanco rendiría 1,9:1). */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={{
              ...controlStyle,
              backgroundColor: colors.accent,
            }}
          >
            <Ionicons
              name="close"
              size={compact ? 22 : 26}
              color={colors.accentText}
            />
          </Pressable>
        </View>

        {/* Flechas para pasar de foto sin salir del visor. */}
        {hasMany ? (
          <View
            pointerEvents="box-none"
            style={{
              ...absoluteFill,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.xs,
            }}
          >
            <Pressable
              onPress={() => goTo(index - 1)}
              accessibilityRole="button"
              accessibilityLabel="Imagen anterior"
              style={controlStyle}
            >
              <Ionicons
                name="chevron-back"
                size={compact ? 22 : 26}
                color={colors.primaryText}
              />
            </Pressable>

            <Pressable
              onPress={() => goTo(index + 1)}
              accessibilityRole="button"
              accessibilityLabel="Imagen siguiente"
              style={controlStyle}
            >
              <Ionicons
                name="chevron-forward"
                size={compact ? 22 : 26}
                color={colors.primaryText}
              />
            </Pressable>
          </View>
        ) : null}

        {/* Controles de escala + la pista de qué se puede hacer. */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.primaryDark,
              borderRadius: 999,
              paddingHorizontal: 6,
              paddingVertical: 6,
              gap: 4,
            }}
          >
            <Pressable
              onPress={() => applyZoom(scale - ZOOM_STEP)}
              disabled={scale <= 1}
              accessibilityRole="button"
              accessibilityLabel="Reducir"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                opacity: scale <= 1 ? 0.4 : 1,
              }}
            >
              <Ionicons name="remove" size={20} color={colors.primaryText} />
            </Pressable>

            <AppText
              style={{
                color: colors.primaryText,
                fontSize: 13,
                fontWeight: "700",
                minWidth: 52,
                textAlign: "center",
              }}
            >
              {Math.round(scale * 100)} %
            </AppText>

            <Pressable
              onPress={() => applyZoom(scale + ZOOM_STEP)}
              disabled={scale >= ZOOM_MAX}
              accessibilityRole="button"
              accessibilityLabel="Ampliar"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                opacity: scale >= ZOOM_MAX ? 0.4 : 1,
              }}
            >
              <Ionicons name="add" size={20} color={colors.primaryText} />
            </Pressable>
          </View>

          {/* La pista va sobre navy sólido igual que el contador: iba en blanco
              suelto y, si la foto es vertical y llega hasta abajo, el blanco
              sobre una etiqueta clara no se lee. Sobre navy rinde 11,9:1. */}
          <View
            style={{
              backgroundColor: colors.primaryDark,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <AppText
              style={{
                color: colors.primaryText,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {scale > 1
                ? "Arrastra para recorrer la imagen"
                : "Toca la imagen para ampliarla"}
            </AppText>
          </View>
        </View>
      </View>
    </Modal>
  );
}
