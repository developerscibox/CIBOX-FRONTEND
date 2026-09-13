import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import AppText from "./AppText";
import { iconForCategory } from "../utils/categoryIcons";

/**
 * Mega-menú estilo supermercado:
 * - Columna izquierda: lista vertical de categorías padre con ícono
 * - Panel derecho: subcategorías de la categoría en hover, en grilla
 */
export default function CategoryMegaMenu({ categories = [], onSelect }) {
  const parents = useMemo(
    () => categories.filter((c) => Array.isArray(c.children)),
    [categories],
  );

  const [active, setActive] = useState(null);

  useEffect(() => {
    if (parents.length > 0 && active === null) {
      setActive(parents[0]._id ?? parents[0].name);
    }
  }, [parents, active]);

  const activeCategory = useMemo(
    () => parents.find((c) => (c._id ?? c.name) === active) ?? parents[0] ?? null,
    [parents, active],
  );

  const subcategories = activeCategory?.children ?? [];

  return (
    <View style={{ flexDirection: "row", minHeight: 320 }}>
      {/* Columna izquierda: categorías padre */}
      <ScrollView
        style={{ width: 210, borderRightWidth: 1, borderRightColor: colors.border }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => onSelect(null)}
          style={({ hovered }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: hovered ? colors.background : "transparent",
          })}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: `${colors.primary}18`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="grid-outline" size={16} color={colors.primary} />
          </View>
          <AppText
            weight="semiBold"
            numberOfLines={1}
            style={{ flex: 1, fontSize: 13, color: colors.primary }}
          >
            Todas las categorías
          </AppText>
        </Pressable>

        {parents.map((cat) => {
          const id = cat._id ?? cat.name;
          const isActive = id === (activeCategory?._id ?? activeCategory?.name);

          return (
            <Pressable
              key={id}
              onHoverIn={() => setActive(id)}
              onPress={() => onSelect(cat)}
              style={({ hovered }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor:
                  isActive || hovered ? colors.background : "transparent",
                borderLeftWidth: 3,
                borderLeftColor: isActive ? colors.primary : "transparent",
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: isActive
                    ? `${colors.primary}22`
                    : `${colors.primary}10`,
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ionicons
                  name={iconForCategory(cat)}
                  size={16}
                  color={isActive ? colors.primary : colors.muted}
                />
              </View>

              <AppText
                numberOfLines={2}
                weight={isActive ? "bold" : "regular"}
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: isActive ? colors.primary : colors.text,
                  lineHeight: 17,
                }}
              >
                {cat.name}
              </AppText>

              {cat.children?.length > 0 && (
                <Ionicons name="chevron-forward" size={13} color={colors.muted} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Panel derecho: subcategorías */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
        {activeCategory && (
          <>
            <Pressable
              onPress={() => onSelect(activeCategory)}
              style={({ hovered }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
                opacity: hovered ? 0.75 : 1,
              })}
            >
              <AppText
                weight="bold"
                style={{ fontSize: 15, color: colors.text }}
              >
                {activeCategory.name}
              </AppText>
              {subcategories.length > 0 && (
                <Ionicons name="arrow-forward" size={14} color={colors.muted} />
              )}
            </Pressable>

            {subcategories.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {subcategories.map((sub) => (
                  <Pressable
                    key={sub._id ?? sub.name}
                    onPress={() => onSelect(sub)}
                    style={({ hovered }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: hovered
                        ? colors.primary
                        : colors.background,
                      borderWidth: 1,
                      borderColor: hovered ? colors.primary : colors.border,
                    })}
                  >
                    {({ hovered }) => (
                      <AppText
                        numberOfLines={1}
                        style={{
                          fontSize: 13,
                          color: hovered ? "#fff" : colors.text,
                        }}
                      >
                        {sub.name}
                      </AppText>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
