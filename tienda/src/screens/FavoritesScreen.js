import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFavorites, removeFavorite } from "../services/favoriteService";
import { showAppAlert } from "../utils/appAlerts";
import useAuthStore from "../store/authStore";
import AppText from "../components/AppText";
import { colors, radius, spacing, shadows } from "../constants/theme";
import { boxTierOf, boxQtyOf } from "../utils/boxPricing";
import { getProductImage, productEmoji, productTint } from "../utils/productImage";

const formatPrice = (value) => "$" + Number(value || 0).toLocaleString("es-CL");

export default function FavoritesScreen({ navigation }) {
  const { token } = useAuthStore();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!token) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getFavorites();
      const items = data?.items || [];
      setFavorites(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log(
        "GET FAVORITES ERROR:",
        error?.response?.data || error.message,
      );
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleRemove = async (productId) => {
    if (!productId) return;
    if (!token) {
      navigation.navigate("Auth");
      return;
    }

    try {
      await removeFavorite(productId);
      await fetchFavorites();
    } catch (error) {
      console.log(
        "REMOVE FAVORITE ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudo quitar de favoritos");
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.centered}>
          <AppText style={styles.emptyTitle}>Inicia sesión</AppText>
          <AppText style={styles.emptyText}>
            Debes iniciar sesión para ver tus favoritos.
          </AppText>
          <Pressable
            onPress={() => navigation.navigate("Auth")}
            style={styles.cta}
          >
            <AppText style={styles.ctaText}>Iniciar sesión</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!favorites.length) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={34} color={colors.primary} />
          </View>
          <AppText style={styles.emptyTitle}>No tienes favoritos</AppText>
          <AppText style={styles.emptyText}>
            Guarda productos para revisarlos y comprarlos por caja más tarde.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={favorites}
        keyExtractor={(item, index) =>
          String(item?._id ?? item?.product_id ?? index)
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="heart" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={styles.title}>Favoritos</AppText>
              <AppText style={styles.subtitle}>
                {favorites.length}{" "}
                {favorites.length === 1 ? "producto guardado" : "productos guardados"}
              </AppText>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const product = item?.product_id || item?.product || item;
          const productId = product?._id || item?.product_id;
          const productName = product?.name || "Producto";
          const boxTier = boxTierOf(product);
          const boxQty = boxQtyOf(product);
          const boxTotal =
            boxTier?.price != null ? boxTier.price * boxQty : null;
          const photo = getProductImage(product);

          return (
            <View style={styles.card}>
              <Pressable
                style={styles.row}
                onPress={() =>
                  productId &&
                  navigation.navigate("ProductDetail", { productId })
                }
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      styles.thumbFicha,
                      { backgroundColor: productTint(product) },
                    ]}
                  >
                    <AppText style={{ fontSize: 30 }}>
                      {productEmoji(product)}
                    </AppText>
                  </View>
                )}

                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={styles.name} numberOfLines={2}>
                    {productName}
                  </AppText>
                  <View style={styles.boxTag}>
                    <AppText style={styles.boxTagText}>Venta por caja</AppText>
                  </View>
                  <AppText style={styles.price}>
                    {boxTotal != null ? formatPrice(boxTotal) : "—"}
                    <AppText style={styles.priceUnit}> / caja</AppText>
                  </AppText>
                  {boxQty > 1 ? (
                    <AppText style={styles.boxMeta}>Caja {boxQty} unidades</AppText>
                  ) : null}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.muted}
                />
              </Pressable>

              <Pressable
                onPress={() => handleRemove(productId)}
                style={styles.removeBtn}
              >
                <Ionicons name="heart-dislike-outline" size={15} color={colors.danger} />
                <AppText style={styles.removeText}>Quitar de favoritos</AppText>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 1 },

  // Tarjeta de favorito
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: "#f3f4f6",
  },
  thumbFicha: {
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 5 },
  boxTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  boxTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  price: { fontSize: 17, fontWeight: "800", color: colors.text },
  priceUnit: { fontSize: 12, fontWeight: "600", color: colors.muted },
  boxMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Quitar
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: "100%",
  },
  removeText: { color: colors.danger, fontWeight: "700", fontSize: 13 },

  // Estados vacíos
  centered: {
    flex: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  ctaText: { color: colors.primaryText, fontWeight: "800" },
});
