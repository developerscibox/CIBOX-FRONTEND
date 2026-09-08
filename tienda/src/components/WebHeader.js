import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../constants/theme";
import useCategoryStore from "../store/categoryStore";
import { getProducts } from "../services/productService";
import useCartStore from "../store/cartStore";
import useAuthStore from "../store/authStore";
import AppText from "./AppText";
import CategoryMegaMenu from "./CategoryMegaMenu";

import brand from "../constants/brand";

/**
 * Caja de contenido del Manual de Diseño Digital v1.0: 1200 de ancho máximo,
 * centrada, con 24 de margen lateral. Antes eran 1280/28 y en pantallas anchas
 * la cabecera quedaba "descolgada": no coincidía con el resto de las secciones.
 * Al vivir en constantes, las tres franjas (avisos, header y navegación) se
 * alinean sí o sí en la misma columna.
 */
const MAX_WIDTH = 1200;
const GUTTER = 24;

// Barra de navegación azul (debajo del header). Cada link a su pantalla propia.
const NAV_LINKS = [
  { label: "Inicio", screen: "Inicio" },
  { label: "Mi Despensa", screen: "PantryTab" },
  { label: "Más Vendido", screen: "Products", params: { preset: "best_sellers" } },
  { label: "Imperdibles de la semana", screen: "Products", params: { preset: "liquidation" } },
  { label: "Beneficios", screen: "Beneficios" },
  { label: "Despacho", screen: "Despacho" },
  { label: "Blog", screen: "Blog" },
  { label: "Contacto", screen: "Contact" },
];

/**
 * ¿Este enlace apunta a donde ya estamos?
 *
 * Se compara también el `preset` porque "Más Vendido" e "Imperdibles de la
 * semana" son la MISMA pantalla (Products) con distinto filtro: mirando solo el
 * nombre se encenderían los dos a la vez, y también al buscar por categoría.
 */
const isActiveLink = (link, route) => {
  if (!route?.name || route.name !== link.screen) return false;
  if (link.params?.preset) return route.params?.preset === link.params.preset;
  return !route.params?.preset;
};

export default function WebHeader() {
  const navigation = useNavigation();
  // WebHeader solo se monta dentro de `withWebLayout`, o sea siempre dentro de
  // una pantalla del stack: `useRoute` es seguro y dice qué enlace resaltar.
  const route = useRoute();
  const { width } = useWindowDimensions();
  const { cartCount, loadCartSummary } = useCartStore();
  const { token } = useAuthStore();

  const [categories, setCategories] = useState([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({
    categories: [],
    products: [],
  });

  const closeCategoriesTimeoutRef = useRef(null);
  const closeSearchTimeoutRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Vía categoryStore: caché en memoria + dedupe con HomeScreen
        // (elimina la doble llamada a /categories?tree=true).
        const items = await useCategoryStore.getState().fetchTree();
        setCategories(Array.isArray(items) ? items : []);
      } catch (error) {
        console.log(
          "WEB HEADER CATEGORIES ERROR:",
          error?.response?.data || error.message
        );
      }
    };

    loadData();
    loadCartSummary();
  }, []);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const value = search.trim();

    if (!value) {
      setSearchResults({ categories: [], products: [] });
      setSearchLoading(false);
      return;
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const [productsData, categoriesData] = await Promise.all([
          getProducts({
            search: value,
            page: 1,
            limit: 6,
          }),
          // Listado plano cacheado (no re-pega a /categories en cada búsqueda).
          useCategoryStore.getState().fetchFlat(),
        ]);

        const productItems = Array.isArray(productsData?.items)
          ? productsData.items
          : [];

        const rawCategories = Array.isArray(categoriesData) ? categoriesData : [];

        const filteredCategories = (Array.isArray(rawCategories) ? rawCategories : [])
          .filter((category) =>
            String(category?.name || "")
              .toLowerCase()
              .includes(value.toLowerCase())
          )
          .slice(0, 4);

        setSearchResults({
          categories: filteredCategories,
          products: productItems,
        });

        setSearchOpen(true);
      } catch (error) {
        console.log(
          "WEB HEADER SEARCH ERROR:",
          error?.response?.data || error.message
        );
        setSearchResults({ categories: [], products: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [search]);

  // Ancho del mega-menú según el viewport (sin desbordar a la derecha).
  const megaWidth = width >= 1200 ? 780 : width >= 980 ? 620 : 480;

  // Cortes del manual: escritorio >1024, tablet 768–1024. Los ocho enlaces a
  // tamaño completo piden ~1130px; bajo 1180 se compactan (fuente y padding)
  // antes de tener que deslizarlos, que es el último recurso.
  const navCompact = width < 1180;
  const navFontSize = navCompact ? 12.5 : 13.5;
  const navGap = navCompact ? 10 : 14;

  // Bajo 1000 los rótulos de los iconos de la derecha (Mi cuenta / Despensa)
  // dejan sin aire a la caja de búsqueda; se quedan solo los iconos.
  const compactActions = width < 1000;
  // Bajo 900 el saludo de la franja superior chocaba con los accesos rápidos.
  const showWelcome = width >= 900;

  const handleSubmitSearch = () => {
    const value = search.trim();
    setSearchOpen(false);

    navigation.navigate("Products", {
      search: value,
      category: "",
    });
  };

  const handleSelectCategory = (category) => {
    setCategoriesOpen(false);
    setSearchOpen(false);
    setHoveredCategory(null);

    navigation.navigate("Products", {
      search: "",
      category: category?._id || "",
    });
  };

  const handleSelectProduct = (product) => {
    setSearchOpen(false);

    navigation.navigate("ProductDetail", {
      productId: product?._id,
    });
  };

  const handleViewAllProducts = () => {
    setSearchOpen(false);

    navigation.navigate("Products", {
      search: search.trim(),
      category: "",
    });
  };

  const handleOpenCategories = () => {
    if (closeCategoriesTimeoutRef.current) {
      clearTimeout(closeCategoriesTimeoutRef.current);
    }
    setCategoriesOpen(true);
  };

  const handleCloseCategories = () => {
    closeCategoriesTimeoutRef.current = setTimeout(() => {
      setCategoriesOpen(false);
      setHoveredCategory(null);
    }, 160);
  };

  const handleOpenSearch = () => {
    if (closeSearchTimeoutRef.current) {
      clearTimeout(closeSearchTimeoutRef.current);
    }

    if (search.trim()) {
      setSearchOpen(true);
    }
  };

  const handleCloseSearch = () => {
    closeSearchTimeoutRef.current = setTimeout(() => {
      setSearchOpen(false);
    }, 160);
  };

  const hasCategoryResults = (searchResults?.categories || []).length > 0;
  const hasProductResults = (searchResults?.products || []).length > 0;
  const hasAnyResults = hasCategoryResults || hasProductResults;

  return (
    <View style={{ width: "100%", zIndex: 1000, position: "relative" }}>
      {/* Franja superior de avisos — azul navy (`primaryDark`), el fondo más
          profundo de la paleta. Antes iba en lima con texto blanco: 1,9:1, es
          decir ilegible. El manual reserva el lima para acentos, no para
          fondos, y sobre azul el texto va blanco (11,9:1). */}
      <View style={{ backgroundColor: colors.primaryDark, paddingHorizontal: GUTTER, paddingVertical: 7 }}>
        {/* Sin el saludo queda un solo hijo: `space-between` lo dejaría pegado
            a la izquierda, así que se cambia a `flex-end` y los accesos se
            quedan donde el ojo los busca, en el borde derecho de la caja. */}
        <View style={{ width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: showWelcome ? "space-between" : "flex-end", gap: 16 }}>
          {showWelcome ? (
            <AppText weight="semiBold" numberOfLines={1} style={{ color: colors.primaryText, fontSize: 12.5, flexShrink: 1 }}>Bienvenido a {brand.name} · {brand.tagline}</AppText>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Pressable onPress={() => navigation.navigate("Stores")} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {({ hovered }) => (
                <>
                  <Ionicons name="location-outline" size={14} color={hovered ? colors.accent : colors.primaryText} />
                  <AppText weight="semiBold" style={{ color: hovered ? colors.accent : colors.primaryText, fontSize: 12.5 }}>Nuestras tiendas</AppText>
                </>
              )}
            </Pressable>
            <Pressable onPress={() => navigation.navigate("HowItWorks")} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {({ hovered }) => (
                <>
                  <Ionicons name="help-circle-outline" size={14} color={hovered ? colors.accent : colors.primaryText} />
                  <AppText weight="semiBold" style={{ color: hovered ? colors.accent : colors.primaryText, fontSize: 12.5 }}>Ayuda</AppText>
                </>
              )}
            </Pressable>
            <Pressable onPress={() => navigation.navigate(token ? "ProfileTab" : "Auth")} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {({ hovered }) => (
                <>
                  <Ionicons name="person-outline" size={14} color={hovered ? colors.accent : colors.primaryText} />
                  <AppText weight="semiBold" style={{ color: hovered ? colors.accent : colors.primaryText, fontSize: 12.5 }}>Mi cuenta</AppText>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Header principal — z-index ALTO: su dropdown de Categorías debe quedar
          por encima de la barra rosada (mega-nav), que es un hermano posterior. */}
      <View
        style={{
          width: "100%",
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: GUTTER,
          paddingVertical: 12,
          position: "relative",
          zIndex: 100,
        }}
      >
      <View
        style={{
          width: "100%",
          maxWidth: MAX_WIDTH,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <Pressable
          onPress={() => navigation.navigate("Inicio")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Image
            source={require("../../assets/logo-cibox.png")}
            style={{ width: 82, height: 86, resizeMode: "contain" }}
          />
          {/* El grosor va por `weight`, no por `fontWeight`: Montserrat se
              carga como una familia por peso (Montserrat_700Bold), así que
              pedir 900 sobre ella no trae una tipografía más gruesa, el
              navegador la ENGORDA a la fuerza y sale emborronada. */}
          {width >= 1040 ? (
            <View style={{ justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }}>
              <AppText weight="bold" style={{ fontSize: 15, color: colors.primary, lineHeight: 18 }}>
                Tu supermercado online
              </AppText>
              <AppText weight="semiBold" style={{ fontSize: 12, color: colors.muted, lineHeight: 15, marginTop: 2 }}>
                Compra desde donde estés · retira sin filas
              </AppText>
            </View>
          ) : null}
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", position: "relative" }}>
          <View
            onMouseEnter={handleOpenCategories}
            onMouseLeave={handleCloseCategories}
            style={{ position: "relative" }}
          >
            {/* Botón de acción del header: va en lima, que es el color de
                ACCIÓN del manual. Antes era blanco sobre el header blanco, o
                sea invisible hasta pasar el ratón por encima. Sobre lima el
                texto va oscuro (`accentText`, 10,1:1); en blanco daría 1,9:1. */}
            <Pressable
              onPress={() => setCategoriesOpen((prev) => !prev)}
              style={({ hovered }) => ({
                height: 42,
                borderRadius: 999,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: hovered || categoriesOpen ? colors.accentLight : colors.accent,
              })}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={colors.accentText}
                style={{ marginRight: 8 }}
              />
              <AppText
                weight="bold"
                style={{
                  fontSize: 14,
                  color: colors.accentText,
                  marginRight: 6,
                }}
              >
                Categorías
              </AppText>
              <Ionicons name="chevron-down" size={16} color={colors.accentText} />
            </Pressable>

            {categoriesOpen ? (
              <View
                style={{
                  position: "absolute",
                  top: 48,
                  left: 0,
                  zIndex: 1000,
                  width: megaWidth,
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 12,
                }}
              >
                <ScrollView style={{ maxHeight: 480 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  <View style={{ padding: 16 }}>
                    <CategoryMegaMenu
                      categories={categories}
                      onSelect={(cat) => {
                        setCategoriesOpen(false);
                        setHoveredCategory(null);
                        navigation.navigate("Products", { search: "", category: cat?._id || "" });
                      }}
                    />
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={{ flex: 1, maxWidth: 520, position: "relative" }}
          onMouseEnter={handleOpenSearch}
          onMouseLeave={handleCloseSearch}
        >
          <View
            style={{
              height: 42,
              borderRadius: 999,
              // Gris de marca en vez del #f1f1f1 suelto, con borde para que el
              // campo se lea como campo sobre el header blanco.
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
            }}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.muted}
              style={{ marginRight: 8 }}
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={handleOpenSearch}
              placeholder="Buscar productos ..."
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={handleSubmitSearch}
              style={{
                flex: 1,
                fontSize: 14,
                color: colors.text,
                outlineStyle: "none",
              }}
            />

            {search?.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearch("");
                  setSearchResults({ categories: [], products: [] });
                  setSearchOpen(false);
                }}
                style={{ marginLeft: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            ) : null}
          </View>

          {searchOpen && search.trim() ? (
            <View
              style={{
                position: "absolute",
                top: 50,
                left: 0,
                right: 0,
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
                zIndex: 230,
                maxHeight: 520,
                overflow: "hidden",
              }}
            >
              <ScrollView
                nestedScrollEnabled
                contentContainerStyle={{
                  paddingHorizontal: 18,
                  paddingTop: 16,
                  paddingBottom: 12,
                }}
              >
                {searchLoading ? (
                  <View style={{ paddingVertical: 14 }}>
                    <AppText style={{ color: colors.muted }}>Buscando...</AppText>
                  </View>
                ) : (
                  <>
                    {hasCategoryResults ? (
                      <View style={{ marginBottom: 14 }}>
                        {/* Mismo motivo que en el rótulo del logo: el grosor
                            se pide por `weight` para usar la Montserrat real y
                            no una negrita falsa del navegador. */}
                        <AppText
                          weight="bold"
                          style={{
                            fontSize: 12,
                            color: colors.muted,
                            marginBottom: 10,
                            textTransform: "uppercase",
                          }}
                        >
                          Categorías
                        </AppText>

                        {searchResults.categories.map((category) => (
                          <Pressable
                            key={category?._id || category?.name}
                            onPress={() => handleSelectCategory(category)}
                            style={{
                              paddingVertical: 8,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                            }}
                          >
                            <AppText
                              style={{
                                color: colors.text,
                                fontSize: 14,
                                textDecorationLine: "underline",
                              }}
                            >
                              {category?.name}
                            </AppText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}

                    {hasProductResults ? (
                      <View>
                        <AppText
                          weight="bold"
                          style={{
                            fontSize: 12,
                            color: colors.muted,
                            marginBottom: 10,
                            textTransform: "uppercase",
                          }}
                        >
                          Productos
                        </AppText>

                        {searchResults.products.map((product) => (
                          <Pressable
                            key={product?._id}
                            onPress={() => handleSelectProduct(product)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 10,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                            }}
                          >
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 8,
                                backgroundColor: colors.background,
                                justifyContent: "center",
                                alignItems: "center",
                                overflow: "hidden",
                                marginRight: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              {product?.thumbnail || product?.images?.[0] ? (
                                <Image
                                  source={{
                                    uri: product?.thumbnail || product?.images?.[0],
                                  }}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    resizeMode: "contain",
                                  }}
                                />
                              ) : (
                                <Ionicons
                                  name="image-outline"
                                  size={18}
                                  color={colors.muted}
                                />
                              )}
                            </View>

                            <AppText
                              numberOfLines={1}
                              weight="semiBold"
                              style={{
                                flex: 1,
                                color: colors.text,
                                fontSize: 15,
                                textTransform: "uppercase",
                              }}
                            >
                              {product?.name}
                            </AppText>
                          </Pressable>
                        ))}

                        <Pressable
                          onPress={handleViewAllProducts}
                          style={{
                            paddingTop: 12,
                            paddingBottom: 6,
                          }}
                        >
                          <AppText
                            weight="semiBold"
                            style={{
                              color: colors.muted,
                              fontSize: 13,
                              textTransform: "uppercase",
                            }}
                          >
                            Ver todos los productos
                          </AppText>
                        </Pressable>
                      </View>
                    ) : null}

                    {!searchLoading && !hasAnyResults ? (
                      <View style={{ paddingVertical: 8 }}>
                        <AppText style={{ color: colors.muted }}>
                          No encontramos resultados.
                        </AppText>
                      </View>
                    ) : null}
                  </>
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 18,
          }}
        >
          {/* Bajo 1000px los rótulos se caen y quedan solo los iconos: así el
              buscador conserva su ancho y nada se sale de la caja de 1200. */}
          <Pressable
            onPress={() => navigation.navigate(token ? "ProfileTab" : "Auth")}
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={colors.text}
              style={{ marginRight: compactActions ? 0 : 6 }}
            />
            {compactActions ? null : (
              <AppText
                weight="semiBold"
                style={{
                  fontSize: 14,
                  color: colors.text,
                }}
              >
                {token ? "Mi cuenta" : "Acceso/Registro"}
              </AppText>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate(token ? "PantryTab" : "Auth")}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons
              name="basket-outline"
              size={22}
              color={colors.text}
              style={{ marginRight: compactActions ? 0 : 6 }}
            />
            {compactActions ? null : (
              <AppText weight="semiBold" style={{ fontSize: 14, color: colors.text }}>
                Despensa
              </AppText>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate(token ? "FavoritesTab" : "Auth")}
          >
            <Ionicons name="heart-outline" size={24} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Cart")}
            style={{ position: "relative" }}
          >
            <Ionicons name="cart-outline" size={24} color={colors.text} />

            <View
              style={{
                position: "absolute",
                top: -8,
                right: -10,
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
                weight="bold"
                style={{
                  color: colors.primaryText,
                  fontSize: 10,
                }}
              >
                {cartCount || 0}
              </AppText>
            </View>
          </Pressable>
        </View>
      </View>
      </View>

      {/* Barra de navegación azul (`primary`) — z-index BAJO para quedar por
          debajo del dropdown de Categorías, que cuelga del header principal. */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: GUTTER, position: "relative", zIndex: 1 }}>
        <View style={{ width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
          {/*
            Los enlaces van CENTRADOS, no pegados a la izquierda (pedido del
            dueño). Se usa un ScrollView horizontal en lugar de `flexWrap`:
              · si los ocho enlaces caben, `flexGrow:1` estira el contenido al
                ancho de la caja y `justifyContent:"center"` los centra;
              · si no caben (ventanas de ~800), se deslizan de lado en una sola
                fila, en vez de partirse en dos filas que dejaban un hueco raro
                bajo la barra o de recortar "Contacto".
            La barra de desplazamiento se oculta: el recorte ya se insinúa
            porque el último enlace queda a medias en el borde.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {NAV_LINKS.map((l) => {
              const active = isActiveLink(l, route);

              return (
                <Pressable
                  key={l.label}
                  onPress={() => navigation.navigate(l.screen, l.params)}
                  style={{ paddingHorizontal: navGap, paddingTop: 12, paddingBottom: 9 }}
                >
                  {({ hovered }) => (
                    // El subrayado lima marca dónde estás. Va siempre dibujado
                    // (transparente cuando no toca) para que el alto de la
                    // barra no salte al cambiar de página.
                    <View
                      style={{
                        borderBottomWidth: 3,
                        borderBottomColor: active ? colors.accent : "transparent",
                        paddingBottom: 3,
                      }}
                    >
                      <AppText
                        weight="semiBold"
                        numberOfLines={1}
                        style={{
                          // Lima sobre azul: 6,3:1 el activo, 7,3:1 el hover.
                          color: active ? colors.accent : hovered ? colors.accentLight : colors.primaryText,
                          fontSize: navFontSize,
                        }}
                      >
                        {l.label}
                      </AppText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}