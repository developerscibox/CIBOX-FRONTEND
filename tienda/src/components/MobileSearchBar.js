import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius } from "../constants/theme";
import { getCategories } from "../services/categoryService";
import { getProducts } from "../services/productService";
import AppText from "./AppText";

export default function MobileSearchBar() {
  const navigation = useNavigation();

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({
    categories: [],
    products: [],
  });

  const debounceRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const value = search.trim();

    if (!value) {
      setSearchResults({ categories: [], products: [] });
      setSearchLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const [productsData, categoriesData] = await Promise.all([
          getProducts({ search: value, page: 1, limit: 6 }),
          getCategories(),
        ]);

        const productItems = Array.isArray(productsData?.items)
          ? productsData.items
          : [];

        const rawCategories =
          categoriesData?.items ||
          categoriesData?.categories ||
          categoriesData ||
          [];

        const filteredCategories = (
          Array.isArray(rawCategories) ? rawCategories : []
        )
          .filter((cat) =>
            String(cat?.name || "")
              .toLowerCase()
              .includes(value.toLowerCase())
          )
          .slice(0, 4);

        setSearchResults({
          categories: filteredCategories,
          products: productItems,
        });
        setSearchOpen(true);
      } catch {
        setSearchResults({ categories: [], products: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleFocus = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (search.trim()) setSearchOpen(true);
  };

  const handleBlur = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setSearchOpen(false);
    }, 160);
  };

  const handleSubmit = () => {
    setSearchOpen(false);
    navigation.navigate("Products", { search: search.trim(), category: "" });
  };

  const handleSelectProduct = (product) => {
    setSearchOpen(false);
    navigation.navigate("ProductDetail", { productId: product._id });
  };

  const handleSelectCategory = (category) => {
    setSearchOpen(false);
    navigation.navigate("Products", {
      search: "",
      category: category._id || "",
    });
  };

  const handleViewAll = () => {
    setSearchOpen(false);
    navigation.navigate("Products", { search: search.trim(), category: "" });
  };

  const hasCategoryResults = searchResults.categories.length > 0;
  const hasProductResults = searchResults.products.length > 0;
  const hasAnyResults = hasCategoryResults || hasProductResults;

  return (
    <View style={{ position: "relative", zIndex: 100 }}>
      {/* Input */}
      <View
        style={{
          height: 44,
          borderRadius: radius.md,
          backgroundColor: "#f1f1f1",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          placeholder="Buscar productos..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={{
            flex: 1,
            fontSize: 14,
            color: colors.text,
            outlineStyle: "none",
          }}
        />
        {search.length > 0 ? (
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

      {/* Dropdown */}
      {searchOpen && search.trim() ? (
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
            zIndex: 200,
            maxHeight: 420,
            overflow: "hidden",
          }}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
            }}
          >
            {searchLoading ? (
              <View
                style={{
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginRight: 8 }}
                />
                <AppText style={{ color: colors.muted }}>Buscando...</AppText>
              </View>
            ) : (
              <>
                {hasCategoryResults ? (
                  <View style={{ marginBottom: 14 }}>
                    <AppText
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: colors.muted,
                        marginBottom: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      Categorías
                    </AppText>
                    {searchResults.categories.map((category) => (
                      <Pressable
                        key={category._id || category.name}
                        onPress={() => handleSelectCategory(category)}
                        style={{
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: "#f1f1f1",
                        }}
                      >
                        <AppText
                          style={{
                            color: colors.text,
                            fontSize: 14,
                            textDecorationLine: "underline",
                          }}
                        >
                          {category.name}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {hasProductResults ? (
                  <View>
                    <AppText
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: colors.muted,
                        marginBottom: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      Productos
                    </AppText>
                    {searchResults.products.map((product) => (
                      <Pressable
                        key={product._id}
                        onPress={() => handleSelectProduct(product)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: "#f1f1f1",
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            backgroundColor: "#f7f7f7",
                            justifyContent: "center",
                            alignItems: "center",
                            overflow: "hidden",
                            marginRight: 12,
                            borderWidth: 1,
                            borderColor: "#efefef",
                          }}
                        >
                          {product.thumbnail || product.images?.[0] ? (
                            <Image
                              source={{
                                uri: product.thumbnail || product.images[0],
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
                              size={16}
                              color={colors.muted}
                            />
                          )}
                        </View>
                        <AppText
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          {product.name}
                        </AppText>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={handleViewAll}
                      style={{ paddingTop: 12, paddingBottom: 4 }}
                    >
                      <AppText
                        style={{
                          color: colors.muted,
                          fontSize: 13,
                          fontWeight: "700",
                          textTransform: "uppercase",
                        }}
                      >
                        Ver todos los productos
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}

                {!hasAnyResults ? (
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
  );
}