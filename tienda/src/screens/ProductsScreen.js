import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProductsGridSkeleton } from "../components/SkeletonLoader";
import ScreenContainer from "../components/ScreenContainer";
import ProductCard from "../components/ProductCard";
import SearchInput from "../components/SearchInput";
import FilterBar from "../components/FilterBar";
import { colors, spacing, radius, shadows } from "../constants/theme";
import { getProducts } from "../services/productService";
import { getCategories } from "../services/categoryService";
import { addItemToCart } from "../services/cartService";
import { esAlcohol } from "../constants/alcohol";
import { exigirMayoriaDeEdad } from "../store/edadStore";
import useCartStore from "../store/cartStore";
import { showAppAlert } from "../utils/appAlerts";
import { showToast } from "../store/toastStore";
import { boxQtyOf } from "../utils/boxPricing";
import AppText from "../components/AppText";

const cleanValue = (value) => {
  const v = String(value ?? "").trim();
  return v ? v : undefined;
};

// ── % de ahorro por caja (caja vs unidad) — usado por el preset "liquidation" ──
const boxSavingsPct = (product) => {
  const tiers = [...(product?.pricing?.tiers || [])].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  const unit = tiers.find((t) => (t?.min_qty || 1) === 1) || tiers[0];
  const box = tiers[tiers.length - 1] || unit;
  if (unit?.price && box?.price && box?.min_qty > 1 && unit.price > box.price) {
    return 1 - box.price / unit.price;
  }
  return 0;
};

// Presets de navegación (Home → Productos). Ajustan título/copy y un orden/filtro
// best-effort. El backend no expone aún filtro de liquidación, así que para ese
// preset filtramos por ahorro por caja en cliente.
const PRESETS = {
  best_sellers: {
    title: "Los más vendidos",
    subtitle: "Los productos favoritos de Cibox, ordenados por popularidad.",
    sort: "popular",
  },
  liquidation: {
    title: "Zona de liquidación",
    subtitle: "Productos con mejor precio por caja. Stock limitado.",
    sort: "",
  },
};

export default function ProductsScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  // Grid denso: hasta 5-6 productos por fila en desktop, responsive hacia abajo.
  const numColumns =
    width >= 1500 ? 6 :
    width >= 1240 ? 5 :
    width >= 1000 ? 4 :
    width >= 720 ? 3 :
    width >= 480 ? 2 : 1;
  // const isWeb = Platform.OS === "web";
  const isWebDesktop = Platform.OS === "web" && width >= 800;

  const initialPreset = PRESETS[route?.params?.preset] || null;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState(route?.params?.preset || "");

  const [search, setSearch] = useState(route?.params?.search || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    route?.params?.search || "",
  );

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(
    route?.params?.category || "",
  );
  const [sort, setSort] = useState(initialPreset?.sort || "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [brand, setBrand] = useState("");
  const [debouncedBrand, setDebouncedBrand] = useState("");

  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingProductId, setAddingProductId] = useState(null);

  const { cartCount, loadCartSummary } = useCartStore();

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      const items = data?.items || data?.categories || data || [];
      setCategories(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log("ERROR CATEGORIES:", error?.response?.data || error.message);
    }
  };

  const fetchProducts = async ({ nextPage = 1, append = false } = {}) => {
    try {
      append ? setLoadingMore(true) : setLoading(true);

      // Liquidación: el backend no expone aún este filtro y el de orden, así que
      // filtramos/ordenamos en cliente. Para que el filtro client-side no quede
      // incompleto (ni rompa el "cargar más"), pedimos un set grande en una sola
      // página y deshabilitamos la paginación.
      const isLiquidation = preset === "liquidation";

      const params = {
        search: cleanValue(debouncedSearch),
        category: cleanValue(selectedCategory),
        min_price: cleanValue(minPrice),
        max_price: cleanValue(maxPrice),
        sort: cleanValue(sort),
        brand: cleanValue(debouncedBrand),
        in_stock: inStock ? true : undefined,
        page: isLiquidation ? 1 : nextPage,
        limit: isLiquidation ? 100 : 12,
      };

      const response = await getProducts(params);
      let items = Array.isArray(response?.items) ? response.items : [];
      const pagination = response?.pagination || {};

      // Liquidación: mostramos solo productos con ahorro por caja (mayor
      // descuento primero), sobre el set grande pedido arriba.
      if (isLiquidation) {
        items = items
          .map((p) => ({ p, pct: boxSavingsPct(p) }))
          .filter((x) => x.pct > 0)
          .sort((a, b) => b.pct - a.pct)
          .map((x) => x.p);
      }

      setProducts((prev) => (append ? [...prev, ...items] : items));
      setPage(Number(pagination.page) || nextPage);
      // En liquidación todo el filtrado es client-side sobre una sola página:
      // no ofrecemos "cargar más" para no agregar 0 productos.
      setHasNextPage(isLiquidation ? false : !!pagination.has_next);
    } catch (error) {
      console.log("ERROR PRODUCTS:", error?.response?.data || error.message);
      if (!append) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleClearFilters = () => {
    setPreset("");
    setSearch("");
    setDebouncedSearch("");
    setSelectedCategory("");
    setSort("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setBrand("");
    setDebouncedBrand("");
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasNextPage) return;
    fetchProducts({ nextPage: page + 1, append: true });
  };

  const handleAddFromCard = async (product, cajas = 1) => {
    if (!product?._id) return;

    // Alcohol: hay que declarar mayoría de edad antes de agregarlo (Ley 19.925).
    if (esAlcohol(product) && !(await exigirMayoriaDeEdad())) {
      showToast("No podemos venderte alcohol si eres menor de 18 años");
      return;
    }

    try {
      setAddingProductId(product._id);
      // Cibox vende por caja: agrega N cajas (cajas elegidas × tamaño de caja).
      const n = Math.max(1, Number(cajas) || 1);
      await addItemToCart({ productId: product._id, quantity: boxQtyOf(product) * n });
      await loadCartSummary();
      showToast(n > 1 ? `${n} cajas agregadas al carrito` : "Caja agregada al carrito");
    } catch (error) {
      console.log(
        "ADD FROM CARD ERROR:",
        error?.response?.data || error.message,
      );
      Alert.alert(
        "Error",
        error?.response?.data?.message || "No se pudo agregar al carrito",
      );
    } finally {
      setAddingProductId(null);
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: spacing.lg }} />;
    return (
      <View style={{ paddingVertical: spacing.md }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  useLayoutEffect(() => {
    if (isWebDesktop) return;

    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("Cart")}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: `${colors.primaryLight}33`,
            position: "relative",
          }}
        >
          <Ionicons name="bag-outline" size={21} color={colors.text} />

          {cartCount > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {cartCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, cartCount, isWebDesktop]);

  useEffect(() => {
    loadCartSummary();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (route?.params?.search !== undefined) {
      setSearch(route.params.search || "");
      setDebouncedSearch(route.params.search || "");
    }
  }, [route?.params?.search]);

  useEffect(() => {
    if (route?.params?.category !== undefined) {
      setSelectedCategory(route.params.category || "");
    }
  }, [route?.params?.category]);

  useEffect(() => {
    if (route?.params?.preset !== undefined) {
      const p = route.params.preset || "";
      setPreset(p);
      const def = PRESETS[p];
      if (def) setSort(def.sort || "");
    }
  }, [route?.params?.preset]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedBrand(brand);
    }, 400);

    return () => clearTimeout(timeout);
  }, [brand]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchProducts({ nextPage: 1, append: false });
    }, 500);

    return () => clearTimeout(timeout);
  }, [debouncedSearch, selectedCategory, sort, minPrice, maxPrice, inStock, debouncedBrand, preset]);
  
  const presetDef = PRESETS[preset] || null;
  const headerTitle = presetDef?.title || "Todos los productos";
  const headerSubtitle =
    presetDef?.subtitle ||
    "Explora el catálogo completo de Cibox y encuentra lo que necesitas.";

  if (loading && !products.length) {
    return (
      <ScreenContainer maxWidth={1320} padded={false}>
        <ProductsGridSkeleton columns={numColumns} count={numColumns * 3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={1320} padded={false}>
      <FlatList
        key={numColumns}
        data={products}
        numColumns={numColumns}
        keyExtractor={(item, index) => String(item?._id ?? index)}
        columnWrapperStyle={
          numColumns > 1
            ? {
                paddingHorizontal: spacing.md,
                gap: spacing.md,
                marginBottom: spacing.md,
              }
            : undefined
        }
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
          paddingHorizontal: numColumns === 1 ? spacing.md : 0,
          backgroundColor: colors.background,
        }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        ListHeaderComponent={
          <View
            style={{ marginBottom: spacing.md, paddingHorizontal: spacing.md }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.md,
                marginBottom: spacing.md,
                ...shadows.card,
              }}
            >
              <AppText
                style={{
                  fontSize: 30,
                  fontWeight: "900",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                {headerTitle}
              </AppText>

              <AppText
                style={{ color: colors.muted, fontSize: 14, marginBottom: 14 }}
              >
                {headerSubtitle}
              </AppText>

              {!isWebDesktop ? (
                <>
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar productos..."
                  />
                  <View style={{ height: 12 }} />
                </>
              ) : null}

              <FilterBar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                sort={sort}
                onChangeSort={setSort}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onChangeMinPrice={setMinPrice}
                onChangeMaxPrice={setMaxPrice}
                inStock={inStock}
                onChangeInStock={setInStock}
                brand={brand}
                onChangeBrand={setBrand}
                onClear={handleClearFilters}
              />
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText
                style={{
                  color: colors.text,
                  fontWeight: "800",
                  fontSize: 15,
                  marginBottom: 4,
                }}
              >
                Resultados
              </AppText>

              <AppText style={{ color: colors.muted }}>
                {products.length} producto(s) encontrados
              </AppText>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flex: 1,
              // Evita que una card sola en la última fila se estire a lo ancho.
              maxWidth: numColumns >= 3 ? 300 : undefined,
              marginBottom: numColumns === 1 ? spacing.md : 0,
            }}
          >
            <ProductCard
              product={item}
              compact={numColumns > 1}
              onPress={() =>
                navigation.navigate("ProductDetail", { productId: item._id })
              }
              onAddToCart={handleAddFromCard}
              adding={addingProductId === item._id}
            />
          </View>
        )}
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xl,
              alignItems: "center",
              marginHorizontal: spacing.md,
              gap: 12,
            }}
          >
            <AppText style={{ fontSize: 48 }}>🔍</AppText>

            <AppText
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
                textAlign: "center",
              }}
            >
              Sin resultados
            </AppText>

            <AppText style={{ color: colors.muted, textAlign: "center", lineHeight: 22 }}>
              No encontramos productos que coincidan con tu búsqueda o filtros actuales.
            </AppText>

            {/* Sugerencias */}
            <View style={{
              backgroundColor: colors.background,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              width: "100%",
              gap: 6,
            }}>
              <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Sugerencias
              </AppText>
              {[
                "Revisa la ortografía de tu búsqueda",
                "Usa palabras más generales",
                "Limpia los filtros de precio o categoría",
              ].map((tip, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <AppText style={{ color: colors.primary, fontSize: 14, lineHeight: 20 }}>•</AppText>
                  <AppText style={{ color: colors.muted, fontSize: 13, flex: 1, lineHeight: 20 }}>{tip}</AppText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleClearFilters}
              style={({ pressed }) => ({
                backgroundColor: pressed ? `${colors.primary}CC` : colors.primary,
                borderRadius: 999,
                paddingHorizontal: 24,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              })}
            >
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <AppText style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                Limpiar filtros
              </AppText>
            </Pressable>
          </View>
        }
      />
    </ScreenContainer>
  );
}
