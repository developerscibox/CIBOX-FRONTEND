import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import CategorySelect from "../components/CategorySelect";
import { colors, radius, spacing } from "../constants/theme";
import { pickMultipleImages } from "../utils/imagePicker";
import { uploadMultipleImagesAsync } from "../services/uploadService";
import { createProduct } from "../services/productService";
import { showAppAlert } from "../utils/appAlerts";

const MAX_IMAGES = 2;

export default function CreateProductScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [cats, setCats] = useState([]);
  const [images, setImages] = useState([]);
  const [unidades, setUnidades] = useState("12");
  const [precioCaja, setPrecioCaja] = useState("");
  const [refSuper, setRefSuper] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);

  const toNumber = (value) => {
    const n = Number(String(value).replace(",", ".").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  const hint = useMemo(() => {
    const total = toNumber(precioCaja);
    const un = toNumber(unidades);
    if (!Number.isFinite(total) || total <= 0) return "";
    if (!Number.isFinite(un) || un < 2) return "";
    const porUnidad = Math.round(total / un);
    return `≈ $${porUnidad.toLocaleString("es-CL")} por unidad · caja de ${un} un`;
  }, [precioCaja, unidades]);

  const handlePickImages = async () => {
    try {
      const assets = await pickMultipleImages();
      if (!assets.length) return;
      setImages((prev) => [...prev, ...assets].slice(0, MAX_IMAGES));
    } catch (error) {
      showAppAlert("Error", error?.message || "No se pudieron seleccionar imágenes");
    }
  };

  const handleRemoveImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const nombre = name.trim();
    const unidadesCaja = toNumber(unidades);
    const precioCajaTotal = toNumber(precioCaja);
    const stockNum = toNumber(stock);
    const refNum = refSuper.trim() ? toNumber(refSuper) : 0;

    if (!nombre) {
      showAppAlert("Falta el nombre", "Ingresa el nombre del producto");
      return;
    }
    if (!cats.length) {
      showAppAlert("Falta la categoría", "Selecciona al menos una categoría");
      return;
    }
    if (!Number.isFinite(unidadesCaja) || unidadesCaja < 2) {
      showAppAlert("Unidades por caja", "Debe ser un número de 2 o más");
      return;
    }
    if (!Number.isFinite(precioCajaTotal) || precioCajaTotal <= 0) {
      showAppAlert("Precio de la caja", "Ingresa un precio mayor a 0");
      return;
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      showAppAlert("Stock", "Ingresa un stock válido (0 o más)");
      return;
    }

    try {
      setSaving(true);

      let finalImages = [];
      if (images.length) {
        const uploaded = await uploadMultipleImagesAsync(images);
        finalImages = uploaded.map((item) => item.url).slice(0, MAX_IMAGES);
      }

      const precioUnit = Math.round(precioCajaTotal / unidadesCaja);

      const tiers = [
        { min_qty: 1, price: precioUnit, label: "Unidad" },
        { min_qty: unidadesCaja, price: precioUnit, label: `Caja ${unidadesCaja} un` },
      ];

      const payload = {
        name: nombre,
        description: nombre,
        sku: "",
        brand: "",
        category_ids: cats.map((c) => String(c._id)),
        compare_price: Number.isFinite(refNum) ? refNum : 0,
        pricing: { tiers },
        stock: stockNum,
        weight: { value: 0, unit: "g" },
        dimensions: { length: 0, width: 0, height: 0, unit: "cm" },
        cibox_plus: { enabled: false },
        images: finalImages,
        thumbnail: finalImages[0] || "",
      };

      await createProduct(payload);
      showAppAlert("Listo", "Producto creado");
      navigation.goBack();
    } catch (error) {
      showAppAlert(
        "Error",
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo crear el producto",
      );
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  };

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
  };

  return (
    <ScreenContainer maxWidth={620}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: colors.primary,
            marginBottom: 4,
          }}
        >
          Nuevo producto
        </AppText>
        <AppText style={{ color: colors.muted, marginBottom: spacing.lg }}>
          Carga rápida — venta por caja
        </AppText>

        <AppText style={labelStyle}>Nombre del producto</AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej: Coca-Cola 350ml"
          placeholderTextColor={colors.muted}
          style={inputStyle}
        />

        <AppText style={labelStyle}>Categoría</AppText>
        <View style={{ marginBottom: spacing.lg }}>
          <CategorySelect value={cats} onChange={setCats} />
        </View>

        <AppText style={labelStyle}>Foto (opcional)</AppText>
        <TouchableOpacity
          onPress={handlePickImages}
          disabled={images.length >= MAX_IMAGES}
          style={{
            borderWidth: 1.5,
            borderColor: colors.primaryLight,
            borderStyle: "dashed",
            borderRadius: radius.md,
            backgroundColor: colors.background,
            paddingVertical: 18,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
            opacity: images.length >= MAX_IMAGES ? 0.5 : 1,
          }}
        >
          <AppText style={{ color: colors.primary, fontWeight: "700" }}>
            {images.length >= MAX_IMAGES ? "Máximo de fotos" : "+ Agregar foto"}
          </AppText>
        </TouchableOpacity>

        {images.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.lg }}
          >
            {images.map((asset, idx) => (
              <View key={`${asset.uri}-${idx}`} style={{ marginRight: 10, width: 110 }}>
                <Image
                  source={{ uri: asset.uri }}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: radius.md,
                    marginBottom: 6,
                    backgroundColor: "#fff",
                  }}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveImage(idx)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.danger,
                    borderRadius: radius.sm,
                    paddingVertical: 6,
                    alignItems: "center",
                  }}
                >
                  <AppText
                    style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}
                  >
                    Quitar
                  </AppText>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <AppText style={labelStyle}>Unidades por caja</AppText>
        <TextInput
          value={unidades}
          onChangeText={setUnidades}
          placeholder="12"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        <AppText style={labelStyle}>Precio de la caja completa ($)</AppText>
        <TextInput
          value={precioCaja}
          onChangeText={setPrecioCaja}
          placeholder="Ej: 9990"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {hint ? (
          <View
            style={{
              backgroundColor: colors.primaryLight,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginTop: -spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            <AppText style={{ color: colors.accent, fontWeight: "700" }}>
              {hint}
            </AppText>
          </View>
        ) : null}

        <AppText style={labelStyle}>Precio referencia supermercado por unidad ($)</AppText>
        <TextInput
          value={refSuper}
          onChangeText={setRefSuper}
          placeholder="Opcional — Ej: 1290"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        <AppText style={labelStyle}>Stock disponible (unidades)</AppText>
        <TextInput
          value={stock}
          onChangeText={setStock}
          placeholder="Ej: 240"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          style={inputStyle}
        />

        {saving ? (
          <View
            style={{
              paddingVertical: 16,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={colors.primaryText} />
          </View>
        ) : (
          <AppButton title="Crear producto" onPress={handleSubmit} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
