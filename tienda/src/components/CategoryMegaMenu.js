import { useMemo, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import AppText from "./AppText";
import { iconForCategory } from "../utils/categoryIcons";

// Chips en rosa claro con texto magenta (marca).
const CHIP_BG = `${colors.primary}14`;

function SubChip({ label, onPress, solid }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: solid ? colors.primary : CHIP_BG,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        maxWidth: 180,
      }}
    >
      <AppText
        numberOfLines={1}
        style={{ color: solid ? "#fff" : colors.primary, fontSize: 12, fontWeight: "700" }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

// Tarjeta = una categoría PADRE: ícono + nombre + contador (junto al nombre) +
// subcategorías como chips (3–4 + "+N" para expandir el resto).
function CategoryCard({ cat, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const children = Array.isArray(cat.children) ? cat.children : [];
  const shown = expanded ? children : children.slice(0, 4);
  const rest = children.length - shown.length;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 255,
        minWidth: 0,
        maxWidth: 440,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
      }}
    >
      {/* Cabecera: ícono + nombre + badge contador */}
      <Pressable
        onPress={() => onSelect(cat)}
        style={({ hovered }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: children.length ? 10 : 0,
          opacity: hovered ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            backgroundColor: CHIP_BG,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name={iconForCategory(cat)} size={20} color={colors.primary} />
        </View>

        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
          <AppText
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "800", color: colors.text, flexShrink: 1 }}
          >
            {cat.name}
          </AppText>
          {children.length > 0 ? (
            <View style={{ backgroundColor: CHIP_BG, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
              <AppText style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }}>
                {children.length}
              </AppText>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      {/* Subcategorías como chips (colapsadas por defecto) */}
      {children.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {shown.map((ch) => (
            <SubChip key={ch._id || ch.name} label={ch.name} onPress={() => onSelect(ch)} />
          ))}
          {rest > 0 ? <SubChip label={`+${rest}`} solid onPress={() => setExpanded(true)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Mega-menú de categorías como grilla de tarjetas (no lista full-width). Cada
 * tarjeta es una categoría padre con sus subcategorías en chips. Buscador,
 * "Todas las categorías" e íconos data-driven ([[categoryIcons]]).
 *
 * onSelect(category | null): null = "todas"; category con _id = filtra productos.
 */
export default function CategoryMegaMenu({ categories = [], onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => {
        const matchParent = String(c.name || "").toLowerCase().includes(q);
        const kids = (c.children || []).filter((k) =>
          String(k.name || "").toLowerCase().includes(q),
        );
        if (matchParent) return c;
        if (kids.length) return { ...c, children: kids };
        return null;
      })
      .filter(Boolean);
  }, [categories, query]);

  return (
    <View>
      {/* Buscador */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: "#f3f3f3",
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 40,
          marginBottom: 12,
        }}
      >
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar categoría..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, fontSize: 14, color: colors.text, outlineStyle: "none" }}
        />
      </View>

      {/* Todas las categorías */}
      <Pressable
        onPress={() => onSelect(null)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 4,
          marginBottom: 8,
        }}
      >
        <Ionicons name="grid-outline" size={16} color={colors.primary} />
        <AppText style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
          Todas las categorías
        </AppText>
      </Pressable>

      {/* Grilla de tarjetas (responsive: 1 col móvil, 2–3 col desktop) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {filtered.length ? (
          filtered.map((c) => (
            <CategoryCard key={c._id || c.name} cat={c} onSelect={onSelect} />
          ))
        ) : (
          <AppText style={{ color: colors.muted, padding: 8 }}>
            No encontramos categorías.
          </AppText>
        )}
      </View>
    </View>
  );
}
