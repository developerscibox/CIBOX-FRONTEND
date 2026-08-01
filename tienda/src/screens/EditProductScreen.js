import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import ProductForm from "../components/ProductForm";
import { getProductById, updateProduct } from "../services/productService";
import { showAppAlert } from "../utils/appAlerts";

export default function EditProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState(null);

  const loadProduct = async () => {
    try {
      setLoading(true);

      const product = await getProductById(productId);

      const tiers = Array.isArray(product?.pricing?.tiers)
        ? [...product.pricing.tiers].sort((a, b) => a.min_qty - b.min_qty)
        : [];

      const baseTier = tiers.find((tier) => tier.min_qty === 1);
      const packTier = tiers.find((tier) => tier.min_qty > 1);

      setInitialValues({
        name: product?.name || "",
        description: product?.description || "",
        sku: product?.sku || "",
        brand: product?.brand || "",
        // Cargar categorías del nuevo formato (array) con fallback al campo legacy
        selectedCategories: Array.isArray(product?.categories) && product.categories.length
          ? product.categories.map((c) => ({ _id: c.id, name: c.name }))
          : product?.category?.id
            ? [{ _id: product.category.id, name: product.category.name }]
            : [],
        stock: product?.stock ?? "",
        basePrice: baseTier?.price ?? "",
        baseLabel: baseTier?.label || "Unidad",
        packMinQty: packTier?.min_qty ?? 3,
        packPrice: packTier?.price ?? "",
        packLabel: packTier?.label || "Pack 3+",
        weightValue: product?.weight?.value ?? "",
        weightUnit: product?.weight?.unit || "g",
        length: product?.dimensions?.length ?? "",
        width: product?.dimensions?.width ?? "",
        height: product?.dimensions?.height ?? "",
        dimensionUnit: product?.dimensions?.unit || "cm",
        comparePrice: product?.compare_price ? String(product.compare_price) : "",
        ciboxPlusEnabled: Boolean(product?.cibox_plus?.enabled),
        images: Array.isArray(product?.images) ? product.images : [],
      });
    } catch (error) {
      console.log(
        "GET PRODUCT BY ID ERROR:",
        error?.response?.data || error.message
      );
      showAppAlert("Error", "No se pudo cargar el producto");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!productId) {
      showAppAlert("Error", "No se recibió el producto a editar");
      navigation.goBack();
      return;
    }

    loadProduct();
  }, [productId]);

  const handleUpdate = async (payload) => {
    try {
      await updateProduct(productId, payload);
      showAppAlert("Listo", "Producto actualizado correctamente");
      navigation.goBack();
    } catch (error) {
      console.log(
        "UPDATE PRODUCT ERROR:",
        error?.response?.data || error.message
      );

      showAppAlert(
        "Error",
        error?.response?.data?.message ||
          error.message ||
          "No se pudo actualizar el producto"
      );
    }
  };

  if (loading || !initialValues) {
    return (
      <ScreenContainer maxWidth={900}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={900}>
      <ProductForm
        mode="edit"
        initialValues={initialValues}
        onSubmit={handleUpdate}
        submitLabel="Guardar cambios"
      />
    </ScreenContainer>
  );
}