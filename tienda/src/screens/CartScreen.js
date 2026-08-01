import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
  Image,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { colors, spacing } from "../constants/theme";
import {
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cartService";
import useCartStore from "../store/cartStore";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "../components/AppText";

export default function CartScreen({ navigation }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const { loadCartSummary } = useCartStore();

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCart();
      setCart(data);
      await loadCartSummary();
    } catch (error) {
      console.log("GET CART ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudo cargar el carrito");
    } finally {
      setLoading(false);
    }
  }, [loadCartSummary]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const formatPrice = (value) => {
    const number = Number(value || 0);
    return number.toLocaleString("es-CL");
  };

  const recalculateCart = (items = []) => {
    const total = items.reduce(
      (acc, item) => acc + Number(item.subtotal || 0),
      0,
    );

    return {
      items,
      total,
    };
  };

  // Tras actualizar una cantidad, el subtotal/total real depende de los tiers de
  // precio del backend. Usamos la respuesta del servidor (o refetcheamos) en vez
  // de un cálculo lineal optimista para no divergir del backend.
  const syncCart = async (serverCart) => {
    let data = serverCart;

    if (!data || !Array.isArray(data.items)) {
      data = await getCart();
    }

    setCart((prev) => {
      const items = data?.items || [];
      const total =
        data?.total != null ? data.total : recalculateCart(items).total;

      return {
        ...(prev || {}),
        ...data,
        items,
        total,
      };
    });
  };

  const getBoxItems = (item) => {
    if (Array.isArray(item?.box_items) && item.box_items.length > 0) {
      return item.box_items;
    }

    if (
      Array.isArray(item?.product?.box_items) &&
      item.product.box_items.length > 0
    ) {
      return item.product.box_items;
    }

    return [];
  };

  const isBoxProduct = (item) => {
    return (
      item?.product_type === "box" ||
      item?.product?.product_type === "box" ||
      getBoxItems(item).length > 0
    );
  };

  const handleIncrease = async (item) => {
    try {
      setUpdatingId(item.product_id);

      // Bodega 12 vende por caja: el + suma una caja completa.
      const step = Number(item.box_qty) || 1;
      const newQuantity = Number(item.quantity || 0) + step;

      const updated = await updateCartItem({
        productId: item.product_id,
        quantity: newQuantity,
      });

      await syncCart(updated);

      await loadCartSummary();
    } catch (error) {
      console.log("UPDATE ITEM ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudo actualizar la cantidad");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDecrease = async (item) => {
    // Bodega 12 vende por caja: el − resta una caja; bajo el mínimo, elimina.
    const step = Number(item.box_qty) || 1;
    if (Number(item.quantity || 0) <= step) {
      await handleRemove(item.product_id);
      return;
    }

    try {
      setUpdatingId(item.product_id);

      const newQuantity = Number(item.quantity || 0) - step;

      const updated = await updateCartItem({
        productId: item.product_id,
        quantity: newQuantity,
      });

      await syncCart(updated);

      await loadCartSummary();
    } catch (error) {
      console.log("UPDATE ITEM ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudo actualizar la cantidad");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (productId) => {
    try {
      setUpdatingId(productId);

      await removeCartItem(productId);

      setCart((prev) => {
        if (!prev) return prev;

        const updatedItems = (prev.items || []).filter(
          (item) => item.product_id !== productId,
        );

        const recalculated = recalculateCart(updatedItems);

        return {
          ...prev,
          items: recalculated.items,
          total: recalculated.total,
        };
      });

      await loadCartSummary();
    } catch (error) {
      console.log("REMOVE ITEM ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudo eliminar el producto");
    } finally {
      setUpdatingId(null);
    }
  };

  const items = cart?.items || [];
  const total = cart?.total || 0;

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  };

  if (loading) {
    return (
      <ScreenContainer maxWidth={900}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!items.length) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
          }}
        >
          <AppText
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 10,
            }}
          >
            Tu carrito está vacío
          </AppText>

          <AppText
            style={{
              color: colors.muted,
              marginBottom: 20,
              textAlign: "center",
              maxWidth: 420,
            }}
          >
            Agrega productos de tu distribuidora Bodega 12 para comenzar tu compra.
          </AppText>

          <AppButton
            title="Ir al catálogo"
            onPress={() => navigation.navigate("Products")}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={900}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.product_id || index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <AppText
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              Mi carrito
            </AppText>

            <AppText style={{ color: colors.muted, fontSize: 15 }}>
              Revisa tus productos antes de continuar al checkout.
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const isUpdating = updatingId === item.product_id;
          const boxItems = getBoxItems(item);
          const showBoxContents = isBoxProduct(item) && boxItems.length > 0;

          return (
            <View
              style={{
                ...cardStyle,
                marginBottom: 12,
                opacity: isUpdating ? 0.7 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                {item.thumbnail || item.image || item.product?.thumbnail ? (
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 16,
                      backgroundColor: colors.background,
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          item.thumbnail ||
                          item.image ||
                          item.product?.thumbnail,
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}

                <View style={{ flex: 1 }}>
                  <AppText
                    numberOfLines={2}
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    {item.name}
                  </AppText>

                  {Number(item.box_qty) > 1 ? (
                    <>
                      <AppText
                        style={{
                          color: colors.text,
                          fontSize: 17,
                          fontWeight: "900",
                          marginBottom: 2,
                        }}
                      >
                        ${formatPrice(Number(item.unit_price) * Number(item.box_qty))}{" "}
                        <AppText
                          style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}
                        >
                          / caja
                        </AppText>
                      </AppText>
                      <AppText
                        style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
                      >
                        Caja de {item.box_qty} un · ≈ ${formatPrice(item.unit_price)} c/u
                      </AppText>
                    </>
                  ) : (
                    <AppText
                      style={{
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: "800",
                        marginBottom: 4,
                      }}
                    >
                      ${formatPrice(item.unit_price)}
                    </AppText>
                  )}

                  <AppText
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                    }}
                  >
                    Subtotal:{" "}
                    <AppText style={{ color: colors.text, fontWeight: "800" }}>
                      ${formatPrice(item.subtotal)}
                    </AppText>
                  </AppText>

                  {showBoxContents ? (
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <AppText
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: colors.text,
                          marginBottom: 8,
                        }}
                      >
                        Contiene esta caja
                      </AppText>

                      {boxItems.map((boxItem, index) => (
                        <View
                          key={boxItem?.product_id || boxItem?._id || index}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: index === boxItems.length - 1 ? 0 : 6,
                            gap: 10,
                          }}
                        >
                          <AppText
                            style={{
                              flex: 1,
                              color: colors.text,
                              fontSize: 12,
                              lineHeight: 18,
                            }}
                          >
                            {boxItem?.quantity || 1} x{" "}
                            {boxItem?.name ||
                              boxItem?.product_name ||
                              boxItem?.product?.name ||
                              "Producto"}
                          </AppText>

                          {boxItem?.unit_price ? (
                            <AppText
                              style={{
                                color: colors.muted,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              ${formatPrice(boxItem.unit_price)}
                            </AppText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  rowGap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.primaryLight,
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Pressable
                      onPress={() => handleDecrease(item)}
                      disabled={isUpdating}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#fff",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <AppText style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>
                        -
                      </AppText>
                    </Pressable>

                    <AppText
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: colors.text,
                        minWidth: 30,
                        textAlign: "center",
                        marginHorizontal: 8,
                      }}
                    >
                      {Number(item.box_qty) > 1
                        ? Math.max(1, Math.round(Number(item.quantity) / Number(item.box_qty)))
                        : item.quantity}
                    </AppText>

                    <Pressable
                      onPress={() => handleIncrease(item)}
                      disabled={isUpdating}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.primary,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <AppText style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
                        +
                      </AppText>
                    </Pressable>
                  </View>

                  <AppText style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
                    {Number(item.box_qty) > 1 ? "caja(s)" : "unidad(es)"}
                  </AppText>
                </View>

                <Pressable
                  onPress={() => handleRemove(item.product_id)}
                  disabled={isUpdating}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <AppText
                    style={{
                      color: "#C2410C",
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    Eliminar
                  </AppText>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View
            style={{
              ...cardStyle,
              marginTop: 4,
              backgroundColor: colors.background,
              borderColor: colors.border,
            }}
          >
            <AppText
              style={{
                fontSize: 14,
                color: colors.muted,
                marginBottom: 6,
              }}
            >
              Total de tu compra
            </AppText>

            <AppText
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 16,
              }}
            >
              ${formatPrice(total)}
            </AppText>

            <AppButton
              title="Continuar al checkout"
              onPress={() => navigation.navigate("Checkout")}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}
