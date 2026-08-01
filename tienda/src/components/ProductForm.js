import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppButton from "../components/AppButton";
import CategorySelect from "../components/CategorySelect";
import { colors, radius, spacing } from "../constants/theme";
import { pickMultipleImages } from "../utils/imagePicker";
import { uploadMultipleImagesAsync } from "../services/uploadService";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "./AppText";

export default function ProductForm({
  mode = "create",
  initialValues = null,
  onSubmit,
  submitLabel,
}) {
  const [name, setName] = useState(initialValues?.name || "");
  const [description, setDescription] = useState(
    initialValues?.description || "",
  );

  const [sku, setSku] = useState(initialValues?.sku || "");
  const [brand, setBrand] = useState(initialValues?.brand || "");

  const [weightValue, setWeightValue] = useState(
    initialValues?.weightValue != null ? String(initialValues.weightValue) : "",
  );
  const [weightUnit, setWeightUnit] = useState(
    initialValues?.weightUnit || "g",
  );

  const [length, setLength] = useState(
    initialValues?.length != null ? String(initialValues.length) : "",
  );
  const [width, setWidth] = useState(
    initialValues?.width != null ? String(initialValues.width) : "",
  );
  const [height, setHeight] = useState(
    initialValues?.height != null ? String(initialValues.height) : "",
  );
  const [dimensionUnit, setDimensionUnit] = useState(
    initialValues?.dimensionUnit || "cm",
  );

  // Multi-categoría: array de { _id, name }
  const [selectedCategories, setSelectedCategories] = useState(
    Array.isArray(initialValues?.selectedCategories)
      ? initialValues.selectedCategories
      : initialValues?.selectedCategory
        ? [initialValues.selectedCategory]
        : [],
  );

  const [stock, setStock] = useState(
    initialValues?.stock != null ? String(initialValues.stock) : "",
  );
  const [basePrice, setBasePrice] = useState(
    initialValues?.basePrice != null ? String(initialValues.basePrice) : "",
  );
  const [baseLabel, setBaseLabel] = useState(
    initialValues?.baseLabel || "Unidad",
  );

  const [packMinQty, setPackMinQty] = useState(
    initialValues?.packMinQty != null ? String(initialValues.packMinQty) : "3",
  );
  const [packPrice, setPackPrice] = useState(
    initialValues?.packPrice != null ? String(initialValues.packPrice) : "",
  );
  const [packLabel, setPackLabel] = useState(
    initialValues?.packLabel || "Pack 3+",
  );

  const [comparePrice, setComparePrice] = useState(
    initialValues?.comparePrice != null ? String(initialValues.comparePrice) : "",
  );

  const [ciboxPlusEnabled, setCiboxPlusEnabled] = useState(
    Boolean(initialValues?.ciboxPlusEnabled),
  );

  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageUrls, setCurrentImageUrls] = useState(
    Array.isArray(initialValues?.images) ? initialValues.images : [],
  );

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    marginBottom: spacing.md,
  };

  const labelStyle = {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  };

  const parseNumber = (value) => {
    const normalized = String(value).replace(",", ".").trim();
    return Number(normalized);
  };

  const validateForm = () => {
    if (!name.trim()) return "Debes ingresar el nombre del producto";
    if (!description.trim()) return "Debes ingresar la descripción";
    if (!selectedCategories.length) return "Debes seleccionar al menos una categoría";
    if (!stock.trim()) return "Debes ingresar stock";
    if (!basePrice.trim()) return "Debes ingresar el precio base";

    const stockValue = parseNumber(stock);
    const basePriceValue = parseNumber(basePrice);

    if (Number.isNaN(stockValue) || stockValue < 0) {
      return "El stock no es válido";
    }

    if (Number.isNaN(basePriceValue) || basePriceValue <= 0) {
      return "El precio base debe ser mayor a 0";
    }

    if (packPrice.trim()) {
      const packPriceValue = parseNumber(packPrice);
      const packMinQtyValue = parseNumber(packMinQty);

      if (Number.isNaN(packMinQtyValue) || packMinQtyValue < 2) {
        return "La cantidad mínima del pack debe ser 2 o más";
      }

      if (Number.isNaN(packPriceValue) || packPriceValue <= 0) {
        return "El precio pack no es válido";
      }
    }

    if (weightValue.trim()) {
      const parsedWeight = parseNumber(weightValue);
      if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
        return "El peso no es válido";
      }
    }

    if (length.trim()) {
      const parsedLength = parseNumber(length);
      if (Number.isNaN(parsedLength) || parsedLength < 0) {
        return "El largo no es válido";
      }
    }

    if (width.trim()) {
      const parsedWidth = parseNumber(width);
      if (Number.isNaN(parsedWidth) || parsedWidth < 0) {
        return "El ancho no es válido";
      }
    }

    if (height.trim()) {
      const parsedHeight = parseNumber(height);
      if (Number.isNaN(parsedHeight) || parsedHeight < 0) {
        return "El alto no es válido";
      }
    }

    return null;
  };

  const handlePickImages = async () => {
    try {
      const assets = await pickMultipleImages();

      if (!assets.length) return;

      setSelectedImages((prev) => {
        const merged = [...prev, ...assets];
        return merged.slice(0, 6);
      });
    } catch (error) {
      showAppAlert(
        "Error",
        error.message || "No se pudieron seleccionar imágenes",
      );
    }
  };

  const handleRemoveSelectedImage = (indexToRemove) => {
    setSelectedImages((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleRemoveCurrentImage = (indexToRemove) => {
    setCurrentImageUrls((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleMakePrimaryCurrent = (index) => {
    setCurrentImageUrls((prev) => {
      const newArr = [...prev];
      const selected = newArr[index];
      newArr.splice(index, 1);
      newArr.unshift(selected);
      return newArr;
    });
  };

  const handleMakePrimarySelected = (index) => {
    setSelectedImages((prev) => {
      const newArr = [...prev];
      const selected = newArr[index];
      newArr.splice(index, 1);
      newArr.unshift(selected);
      return newArr;
    });
  };

  const handleInternalSubmit = async () => {
    const validationError = validateForm();

    if (validationError) {
      showAppAlert("Formulario incompleto", validationError);
      return;
    }

    try {
      setSaving(true);

      let finalImages = [...currentImageUrls];

      if (selectedImages.length) {
        setUploadingImage(true);

        const uploadedImages = await uploadMultipleImagesAsync(selectedImages);
        const uploadedUrls = uploadedImages.map((item) => item.url);

        finalImages = [...finalImages, ...uploadedUrls].slice(0, 6);

        setCurrentImageUrls(finalImages);
        setUploadingImage(false);
      }

      const tiers = [
        {
          min_qty: 1,
          price: parseNumber(basePrice),
          label: baseLabel.trim() || "Unidad",
        },
      ];

      if (packPrice.trim()) {
        tiers.push({
          min_qty: parseNumber(packMinQty),
          price: parseNumber(packPrice),
          label: packLabel.trim() || `Pack ${parseNumber(packMinQty)}+`,
        });
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        sku: sku.trim(),
        brand: brand.trim(),
        // El backend resuelve category, categories y category_ids a partir de estos IDs
        category_ids: selectedCategories.map((c) => String(c._id)),
        compare_price: comparePrice.trim() ? parseNumber(comparePrice) : 0,
        pricing: {
          tiers,
        },
        stock: parseNumber(stock),
        weight: {
          value: weightValue.trim() ? parseNumber(weightValue) : 0,
          unit: weightUnit.trim() || "g",
        },
        dimensions: {
          length: length.trim() ? parseNumber(length) : 0,
          width: width.trim() ? parseNumber(width) : 0,
          height: height.trim() ? parseNumber(height) : 0,
          unit: dimensionUnit.trim() || "cm",
        },
        cibox_plus: {
          enabled: ciboxPlusEnabled,
        },
        images: finalImages,
        thumbnail: finalImages[0] || "",
      };
      console.log("FINAL IMAGES:", finalImages);
      console.log("PRODUCT PAYLOAD:", JSON.stringify(payload, null, 2));
      await onSubmit(payload);
    } catch (error) {
      showAppAlert(
        "Error",
        error?.response?.data?.message ||
          error.message ||
          "No se pudo guardar el producto",
      );
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <AppText
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 6,
        }}
      >
        {mode === "create" ? "Crear producto" : "Editar producto"}
      </AppText>

      <AppText
        style={{
          color: colors.muted,
          marginBottom: spacing.lg,
        }}
      >
        {mode === "create"
          ? "Completa la información básica del producto."
          : "Modifica la información del producto."}
      </AppText>

      <AppText style={labelStyle}>Nombre</AppText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Ej: Proteína Whey 1kg"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <AppText style={labelStyle}>Descripción</AppText>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Describe el producto"
        placeholderTextColor={colors.muted}
        style={[inputStyle, { minHeight: 110, textAlignVertical: "top" }]}
        multiline
      />

      <AppText style={labelStyle}>SKU</AppText>
      <TextInput
        value={sku}
        onChangeText={setSku}
        placeholder="Ej: WHEY-1KG-VAN"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <AppText style={labelStyle}>Marca</AppText>
      <TextInput
        value={brand}
        onChangeText={setBrand}
        placeholder="Ej: Nutrivital"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <AppText
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        Peso
      </AppText>

      <AppText style={labelStyle}>Valor</AppText>
      <TextInput
        value={weightValue}
        onChangeText={setWeightValue}
        placeholder="Ej: 1000"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Unidad de peso</AppText>
      <TextInput
        value={weightUnit}
        onChangeText={setWeightUnit}
        placeholder="Ej: g"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <AppText
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        Dimensiones
      </AppText>

      <AppText style={labelStyle}>Largo</AppText>
      <TextInput
        value={length}
        onChangeText={setLength}
        placeholder="Ej: 20"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Ancho</AppText>
      <TextInput
        value={width}
        onChangeText={setWidth}
        placeholder="Ej: 10"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Alto</AppText>
      <TextInput
        value={height}
        onChangeText={setHeight}
        placeholder="Ej: 30"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Unidad de dimensiones</AppText>
      <TextInput
        value={dimensionUnit}
        onChangeText={setDimensionUnit}
        placeholder="Ej: cm"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <AppText style={labelStyle}>Categorías</AppText>
      <CategorySelect value={selectedCategories} onChange={setSelectedCategories} />

      <AppText style={labelStyle}>Stock</AppText>
      <TextInput
        value={stock}
        onChangeText={setStock}
        placeholder="Ej: 25"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        Precio base
      </AppText>

      <AppText style={labelStyle}>Precio</AppText>
      <TextInput
        value={basePrice}
        onChangeText={setBasePrice}
        placeholder="Ej: 19990"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Etiqueta precio base</AppText>
      <TextInput
        value={baseLabel}
        onChangeText={setBaseLabel}
        placeholder="Ej: Unidad"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      {/* Precio comparativo supermercado */}
      <View style={{
        borderWidth: 1,
        borderColor: "#FDE68A",
        borderRadius: radius.md,
        backgroundColor: "#FFFBEB",
        padding: spacing.md,
        marginBottom: spacing.md,
      }}>
        <AppText style={{ fontSize: 13, fontWeight: "800", color: "#92400E", marginBottom: 4 }}>
          💡 Precio en supermercado tradicional
        </AppText>
        <AppText style={{ fontSize: 12, color: "#B45309", marginBottom: 10 }}>
          Opcional. Si lo ingresas, la app mostrará el ahorro real en la tarjeta del producto.
        </AppText>
        <AppText style={labelStyle}>Precio referencia supermercado ($)</AppText>
        <TextInput
          value={comparePrice}
          onChangeText={setComparePrice}
          placeholder="Ej: 2990 (deja vacío si no aplica)"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />
      </View>

      <AppText
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        Precio pack opcional
      </AppText>

      <AppText style={labelStyle}>Cantidad mínima pack</AppText>
      <TextInput
        value={packMinQty}
        onChangeText={setPackMinQty}
        placeholder="Ej: 3"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Precio pack</AppText>
      <TextInput
        value={packPrice}
        onChangeText={setPackPrice}
        placeholder="Ej: 17990"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={inputStyle}
      />

      <AppText style={labelStyle}>Label pack</AppText>
      <TextInput
        value={packLabel}
        onChangeText={setPackLabel}
        placeholder="Ej: Pack 3+"
        placeholderTextColor={colors.muted}
        style={inputStyle}
      />

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          padding: spacing.md,
          marginBottom: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <AppText
            style={{
              color: colors.text,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Bodega 12 Plus
          </AppText>
          <AppText style={{ color: colors.muted }}>
            Activa si este producto aplica beneficios para clientes Bodega 12+.
          </AppText>
        </View>

        <Switch value={ciboxPlusEnabled} onValueChange={setCiboxPlusEnabled} />
      </View>

      <AppText style={labelStyle}>Imágenes del producto</AppText>

      <TouchableOpacity
        onPress={handlePickImages}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          padding: spacing.md,
          marginBottom: spacing.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 120,
        }}
      >
        <AppText
          style={{ color: colors.text, fontWeight: "700", marginBottom: 4 }}
        >
          Agregar imágenes
        </AppText>
        <AppText style={{ color: colors.muted }}>
          Puedes subir hasta 6 imágenes
        </AppText>
      </TouchableOpacity>

      {currentImageUrls.length ? (
        <View style={{ marginBottom: spacing.md }}>
          <AppText
            style={{
              color: colors.text,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            Imágenes actuales
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {currentImageUrls.map((url, index) => (
              <View
                key={`${url}-${index}`}
                style={{
                  marginRight: 10,
                  width: 120,
                }}
              >
                <Image
                  source={{ uri: url }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radius.md,
                    marginBottom: 8,
                    backgroundColor: "#fff",
                  }}
                  resizeMode="contain"
                />

                {index === 0 ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#2f8f4e",
                      backgroundColor: "#2f8f4e",
                      borderRadius: radius.md,
                      paddingVertical: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <AppText
                      style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}
                    >
                      Principal
                    </AppText>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleMakePrimaryCurrent(index)}
                    style={{
                      borderWidth: 1,
                      borderColor: "#2f8f4e",
                      borderRadius: radius.md,
                      paddingVertical: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <AppText
                      style={{
                        color: "#2f8f4e",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Usar como principal
                    </AppText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleRemoveCurrentImage(index)}
                  style={{
                    borderWidth: 1,
                    borderColor: "#d33",
                    borderRadius: radius.md,
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <AppText
                    style={{ color: "#d33", fontWeight: "700", fontSize: 12 }}
                  >
                    Quitar
                  </AppText>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {selectedImages.length ? (
        <View style={{ marginBottom: spacing.md }}>
          <AppText
            style={{
              color: colors.text,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            Nuevas imágenes
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedImages.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={{
                  marginRight: 10,
                  width: 120,
                }}
              >
                <Image
                  source={{ uri: asset.uri }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radius.md,
                    marginBottom: 8,
                    backgroundColor: "#fff",
                  }}
                  resizeMode="contain"
                />

                {index === 0 && !currentImageUrls.length ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#2f8f4e",
                      backgroundColor: "#2f8f4e",
                      borderRadius: radius.md,
                      paddingVertical: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <AppText
                      style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}
                    >
                      Principal
                    </AppText>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleMakePrimarySelected(index)}
                    style={{
                      borderWidth: 1,
                      borderColor: "#2f8f4e",
                      borderRadius: radius.md,
                      paddingVertical: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <AppText
                      style={{
                        color: "#2f8f4e",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Usar como principal
                    </AppText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleRemoveSelectedImage(index)}
                  style={{
                    borderWidth: 1,
                    borderColor: "#d33",
                    borderRadius: radius.md,
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                >
                  <AppText
                    style={{ color: "#d33", fontWeight: "700", fontSize: 12 }}
                  >
                    Quitar
                  </AppText>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {uploadingImage ? (
        <AppText style={{ color: colors.muted, marginBottom: spacing.md }}>
          Subiendo imágenes...
        </AppText>
      ) : null}

      {saving ? (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <AppButton
          title={
            submitLabel ||
            (mode === "create" ? "Crear producto" : "Guardar cambios")
          }
          onPress={handleInternalSubmit}
        />
      )}
    </ScrollView>
  );
}
