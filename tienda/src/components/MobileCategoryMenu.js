import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../constants/theme";
import { getCategoriesTree } from "../services/categoryService";
import AppText from "./AppText";
import CategoryMegaMenu from "./CategoryMegaMenu";

export default function MobileCategoryMenu({ visible, onClose }) {
  const navigation = useNavigation();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (visible) loadCategories();
  }, [visible]);

  const loadCategories = async () => {
    try {
      const items = await getCategoriesTree();
      const cats = Array.isArray(items) ? items : [];
      setCategories(cats);
      // Selecciona la primera categoría con hijos por defecto
      const firstWithChildren = cats.find((c) => c.children?.length > 0);
      setSelectedCategory(firstWithChildren || cats[0] || null);
    } catch (error) {
      console.log("ERROR CATEGORIES MENU:", error?.response?.data || error.message);
    }
  };

  const handleSelectCategory = (category) => {
    onClose();
    navigation.navigate("Products", {
      search: "",
      category: category._id || "",
    });
  };

  const subcategories = selectedCategory?.children || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Fondo oscuro — toca afuera para cerrar */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        {/* Contenedor del menú */}
        <Pressable
          onPress={() => {}}
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: "hidden",
          }}
        >
          {/* Header del modal */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.md,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="grid-outline" size={20} color={colors.primary} />
              <AppText style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                Categorías
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#f1f1f1",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Mega-menú de tarjetas (1 columna en móvil) */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <CategoryMegaMenu
              categories={categories}
              onSelect={(cat) => {
                onClose();
                navigation.navigate("Products", { search: "", category: cat?._id || "" });
              }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}