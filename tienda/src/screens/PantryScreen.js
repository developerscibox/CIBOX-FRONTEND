import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { checkoutPantry, getPantry } from "../services/pantryService";
import { addItemToCart } from "../services/cartService";
import useAuthStore from "../store/authStore";
import { showAppAlert } from "../utils/appAlerts";
import { showToast } from "../store/toastStore";
import { colors, spacing, radius, shadows } from "../constants/theme";
import AppText from "../components/AppText";

export default function PantryScreen({ navigation }) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;

  // En web desktop la ruta del catálogo es "Inicio"; en nativo es "MainTabs".
  const goToCatalog = () =>
    isWebDesktop
      ? navigation.navigate("Inicio")
      : navigation.navigate("MainTabs", { screen: "Inicio" });

  const [pantry, setPantry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState(null);
  const [movingAll, setMovingAll] = useState(false);

  const fetchPantry = useCallback(async () => {
    if (!token) {
      setPantry(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getPantry();
      setPantry(data);
    } catch (error) {
      console.log("GET PANTRY ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudo cargar la despensa");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Agregar un solo producto al carrito (POST /cart/items).
  const handleMove = async (productId) => {
    if (!productId) return;
    if (!token) {
      showAppAlert("Inicia sesión", "Debes iniciar sesión para usar tu despensa");
      navigation.navigate("Auth");
      return;
    }

    try {
      setMovingId(productId);
      await addItemToCart({ productId, quantity: 1 });
      showToast("Producto agregado al carrito");
    } catch (error) {
      console.log(
        "ADD PANTRY ITEM TO CART ERROR:",
        error?.response?.data || error.message
      );
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo agregar al carrito"
      );
    } finally {
      setMovingId(null);
    }
  };

  // Recomprar toda la despensa: convierte la despensa en un carrito activo y va al carrito.
  const handleMoveAll = async () => {
    if (!token) {
      navigation.navigate("Auth");
      return;
    }
    if (!(pantry?.items || []).length) return;
    try {
      setMovingAll(true);
      await checkoutPantry();
      showToast("Despensa agregada al carrito");
      navigation.navigate("Cart");
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo recomprar la despensa",
      );
    } finally {
      setMovingAll(false);
    }
  };

  useEffect(() => {
    fetchPantry();
  }, [fetchPantry]);

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadows.card,
            }}
          >
            <AppText
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text,
                marginBottom: spacing.sm,
                textAlign: "center",
              }}
            >
              Inicia sesión para ver tu despensa
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                marginBottom: spacing.lg,
                lineHeight: 22,
              }}
            >
              Guarda productos frecuentes y mantén una lista recurrente de compra
              para agregarlos fácilmente cuando quieras.
            </AppText>

            <Pressable
              onPress={() => navigation.navigate("Auth")}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                Iniciar sesión
              </AppText>
            </Pressable>

            <Pressable
              onPress={goToCatalog}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  color: colors.primary,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                Volver al catálogo
              </AppText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const items = pantry?.items || [];

  // Grid responsive: móvil 2 columnas, tablet/desktop 3 (2 filas = 6 visibles).
  const [gridW, setGridW] = useState(0);
  const cols = width >= 680 ? 3 : 2;
  const gap = spacing.md;
  const cardW = gridW > 0 ? (gridW - gap * (cols - 1)) / cols : "48%";

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText
            style={{
              marginTop: spacing.sm,
              color: colors.muted,
            }}
          >
            Cargando despensa...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadows.card,
            }}
          >
            <AppText
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: colors.text,
                marginBottom: spacing.sm,
                textAlign: "center",
              }}
            >
              Tu despensa está vacía
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                marginBottom: spacing.lg,
                lineHeight: 22,
              }}
            >
              Guarda tus cajas frecuentes desde el catálogo y vuelve a pedirlas
              con un toque cuando quieras.
            </AppText>

            <Pressable
              onPress={goToCatalog}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                Explorar productos
              </AppText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          width: "100%",
          maxWidth: 1000,
          alignSelf: "center",
          paddingBottom: spacing.xl,
        }}
      >
        {/* Encabezado + acciones */}
        <View style={{ marginBottom: spacing.lg }}>
          <AppText
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.text,
              marginBottom: spacing.xs,
            }}
          >
            Mi despensa
          </AppText>

          <AppText style={{ color: colors.muted, fontSize: 15 }}>
            Guarda productos frecuentes y agrégalos al carrito cuando quieras.
          </AppText>

          <Pressable
            onPress={handleMoveAll}
            disabled={movingAll}
            style={{
              marginTop: spacing.md,
              backgroundColor: movingAll ? colors.muted : colors.primary,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              ...shadows.card,
            }}
          >
            <AppText style={{ color: colors.primaryText, fontWeight: "800", fontSize: 15 }}>
              {movingAll ? "Agregando todo…" : `🛒 Recomprar todo (${items.length})`}
            </AppText>
          </Pressable>

          <Pressable
            onPress={goToCatalog}
            style={{
              marginTop: spacing.sm,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.surface,
            }}
          >
            <AppText style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>
              + Agregar productos
            </AppText>
          </Pressable>
        </View>

        {/* Grid responsive de productos */}
        <View
          onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
          style={{ flexDirection: "row", flexWrap: "wrap", gap }}
        >
          {items.map((item, index) => {
            const product = item.product || null;
            const productId = product?._id || item.product_id;
            const isMoving = movingId === productId;

            const name = product?.name || item.name || "Producto";
            const image =
              product?.thumbnail ||
              (Array.isArray(product?.images) ? product.images[0] : null);
            const boxPrice = item.box_price ?? null;
            const freqDays = item.frequency_days ?? null;

            return (
              <View
                key={String(productId || index)}
                style={{
                  width: cardW,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  ...shadows.card,
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: 120,
                    borderRadius: radius.md,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <AppText style={{ fontSize: 34 }}>📦</AppText>
                  )}
                </View>

                <AppText
                  numberOfLines={2}
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: colors.text,
                    marginBottom: 4,
                    minHeight: 38,
                  }}
                >
                  {name}
                </AppText>

                <AppText
                  style={{ color: colors.text, fontWeight: "700", fontSize: 14, marginBottom: 2 }}
                >
                  {boxPrice != null
                    ? `$${Number(boxPrice).toLocaleString("es-CL")} / caja`
                    : "Precio por caja: —"}
                </AppText>

                <AppText style={{ color: colors.muted, fontSize: 12.5, marginBottom: spacing.sm }}>
                  Cantidad: {item.quantity}
                  {freqDays ? ` · cada ${freqDays} días` : ""}
                </AppText>

                <Pressable
                  onPress={() => handleMove(productId)}
                  disabled={isMoving}
                  style={{
                    backgroundColor: isMoving ? colors.muted : colors.primary,
                    paddingVertical: 11,
                    borderRadius: radius.md,
                    alignItems: "center",
                  }}
                >
                  <AppText style={{ color: colors.primaryText, fontWeight: "800", fontSize: 14 }}>
                    {isMoving ? "Agregando..." : "Agregar al carrito"}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}