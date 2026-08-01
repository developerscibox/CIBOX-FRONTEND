import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import AppText from "./AppText";

export default function StockEditModal({
  visible,
  product,
  loading = false,
  onClose,
  onSave,
}) {
  const [stockValue, setStockValue] = useState("");

  useEffect(() => {
    if (visible) {
      setStockValue(
        product?.stock != null && product?.stock !== undefined
          ? String(product.stock)
          : ""
      );
    }
  }, [visible, product]);

  const handleSave = () => {
    const parsed = Number(String(stockValue).replace(",", ".").trim());

    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }

    onSave(parsed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.md,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Editar stock
          </AppText>

          <AppText
            style={{
              color: colors.muted,
              marginBottom: spacing.md,
            }}
          >
            {product?.name || "Producto"}
          </AppText>

          <AppText
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Nuevo stock
          </AppText>

          <TextInput
            value={stockValue}
            onChangeText={setStockValue}
            keyboardType="numeric"
            placeholder="Ej: 25"
            placeholderTextColor={colors.muted}
            editable={!loading}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.background,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.text,
              marginBottom: spacing.lg,
            }}
          />

          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingVertical: 12,
                alignItems: "center",
                marginRight: 8,
              }}
            >
              <AppText style={{ color: colors.text, fontWeight: "700" }}>
                Cancelar
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.text,
                backgroundColor: colors.text,
                borderRadius: radius.md,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <AppText
                  style={{
                    color: colors.background,
                    fontWeight: "700",
                  }}
                >
                  Guardar
                </AppText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}