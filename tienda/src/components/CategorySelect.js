import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../constants/theme";
import { getCategories } from "../services/categoryService";
import AppText from "./AppText";

/**
 * CategorySelect — selector de múltiples categorías con jerarquía padre → hijo.
 *
 * Props:
 *   value    → array de objetos { _id, name } seleccionados
 *   onChange → función que recibe el nuevo array al cambiar selección
 */
export default function CategorySelect({ value = [], onChange }) {
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Aseguramos que value siempre sea array
  const selected = Array.isArray(value) ? value : (value ? [value] : []);
  const selectedIds = new Set(selected.map((c) => String(c._id)));

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      const items = data?.items ?? data?.categories ?? data ?? [];
      setAllCategories(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log("GET CATEGORIES ERROR:", error?.response?.data || error.message);
      setAllCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Separar padres e hijos
  const parents  = allCategories.filter((c) => !c.parent_id);
  const children = allCategories.filter((c) => !!c.parent_id);

  // Hijos sin padre conocido (mostrar al final como "sin categoría padre")
  const parentIds = new Set(parents.map((p) => String(p._id)));
  const orphans   = children.filter((c) => !parentIds.has(String(c.parent_id)));
  const childMap  = children.reduce((acc, c) => {
    const key = String(c.parent_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const toggleCategory = (cat) => {
    const id = String(cat._id);
    if (selectedIds.has(id)) {
      onChange(selected.filter((c) => String(c._id) !== id));
    } else {
      onChange([...selected, { _id: cat._id, name: cat.name }]);
    }
  };

  if (loading) {
    return (
      <View style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.md,
        alignItems: "center",
      }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!allCategories.length) {
    return (
      <View style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}>
        <AppText style={{ color: colors.muted }}>No hay categorías disponibles.</AppText>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      {/* Chips de seleccionadas */}
      {selected.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {selected.map((cat) => (
            <Pressable
              key={String(cat._id)}
              onPress={() => toggleCategory(cat)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.primary,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <AppText style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                {cat.name}
              </AppText>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Lista con jerarquía */}
      <View style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        overflow: "hidden",
        maxHeight: 320,
      }}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
          {/* Categorías con padre */}
          {parents.map((parent) => {
            const kids = childMap[String(parent._id)] || [];
            const parentSelected = selectedIds.has(String(parent._id));

            return (
              <View key={String(parent._id)}>
                {/* Fila del padre */}
                <Pressable
                  onPress={() => toggleCategory(parent)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: pressed
                      ? `${colors.primary}10`
                      : parentSelected
                        ? `${colors.primary}08`
                        : "#fff",
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  })}
                >
                  {/* Checkbox */}
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: parentSelected ? colors.primary : "#C0C0C0",
                    backgroundColor: parentSelected ? colors.primary : "#fff",
                    justifyContent: "center",
                    alignItems: "center",
                    flexShrink: 0,
                  }}>
                    {parentSelected && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  <AppText style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: colors.text,
                    flex: 1,
                  }}>
                    {parent.name}
                  </AppText>
                  {kids.length > 0 && (
                    <AppText style={{ fontSize: 11, color: colors.muted }}>
                      {kids.length} subcategorías
                    </AppText>
                  )}
                </Pressable>

                {/* Hijos con sangría */}
                {kids.map((child, idx) => {
                  const childSelected = selectedIds.has(String(child._id));
                  const isLast = idx === kids.length - 1;

                  return (
                    <Pressable
                      key={String(child._id)}
                      onPress={() => toggleCategory(child)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        paddingLeft: 38,
                        backgroundColor: pressed
                          ? `${colors.primary}10`
                          : childSelected
                            ? `${colors.primary}06`
                            : "#FAFAFA",
                        borderBottomWidth: isLast ? 1 : 1,
                        borderColor: colors.border,
                      })}
                    >
                      {/* Línea de sangría */}
                      <View style={{
                        position: "absolute",
                        left: 22,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        backgroundColor: colors.border,
                      }} />

                      {/* Checkbox */}
                      <View style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: childSelected ? colors.primary : "#C0C0C0",
                        backgroundColor: childSelected ? colors.primary : "#fff",
                        justifyContent: "center",
                        alignItems: "center",
                        flexShrink: 0,
                      }}>
                        {childSelected && (
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        )}
                      </View>

                      <AppText style={{
                        fontSize: 13,
                        color: colors.text,
                        flex: 1,
                        fontWeight: childSelected ? "700" : "400",
                      }}>
                        {child.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          {/* Categorías sin padre conocido */}
          {orphans.map((cat) => {
            const isSelected = selectedIds.has(String(cat._id));
            return (
              <Pressable
                key={String(cat._id)}
                onPress={() => toggleCategory(cat)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: pressed
                    ? `${colors.primary}10`
                    : isSelected
                      ? `${colors.primary}08`
                      : "#fff",
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                })}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : "#C0C0C0",
                  backgroundColor: isSelected ? colors.primary : "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  flexShrink: 0,
                }}>
                  {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <AppText style={{ fontSize: 14, color: colors.text, flex: 1 }}>
                  {cat.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <AppText style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
        Puedes seleccionar una o más categorías. El backend asignará automáticamente las categorías padre.
      </AppText>
    </View>
  );
}
