import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../constants/theme";
import AppText from "./AppText";

const SORT_OPTIONS = [
  { label: "Más recientes",   value: "newest",     icon: "time-outline" },
  { label: "Precio menor",    value: "price_asc",  icon: "arrow-up-outline" },
  { label: "Precio mayor",    value: "price_desc", icon: "arrow-down-outline" },
  { label: "Mejor valorados", value: "rating",     icon: "star-outline" },
  { label: "Más populares",   value: "popular",    icon: "flame-outline" },
];

export default function FilterBar({
  categories = [],
  selectedCategory = "",
  onSelectCategory,
  sort = "",
  onChangeSort,
  minPrice = "",
  maxPrice = "",
  onChangeMinPrice,
  onChangeMaxPrice,
  inStock = false,
  onChangeInStock,
  brand = "",
  onChangeBrand,
  onClear,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Filtros dentro del panel: precio + orden + marca (categoría y disponibles
  // tienen su propio control visible en la fila principal).
  const activeCount =
    (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (sort ? 1 : 0) + (brand ? 1 : 0);

  // Total para "Limpiar todo" incluye categoría y disponibles
  const totalActive = activeCount + (selectedCategory ? 1 : 0) + (inStock ? 1 : 0);

  const selectedCategoryName = categories.find(
    (c) => (c._id || c.id) === selectedCategory,
  )?.name;

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;

  const filteredCategories =
    categorySearch.trim()
      ? categories.filter((c) =>
          String(c?.name || "")
            .toLowerCase()
            .includes(categorySearch.toLowerCase()),
        )
      : categories;

  const closeModal = () => {
    setCategoryModalOpen(false);
    setCategorySearch("");
  };

  // ── Helpers de estilo ───────────────────────────────────────────────────────
  const sortChip = (active) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: active ? colors.primary : colors.border,
    backgroundColor: active ? `${colors.primary}15` : colors.background,
    marginRight: 8,
  });

  return (
    <View>
      {/* ── Fila principal: Categoría + Filtros ─────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Botón Categoría → abre modal */}
        <Pressable
          onPress={() => setCategoryModalOpen(true)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: selectedCategory ? colors.primary : colors.border,
            backgroundColor: selectedCategory
              ? `${colors.primary}12`
              : colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <Ionicons
              name="grid-outline"
              size={15}
              color={selectedCategory ? colors.primary : colors.muted}
            />
            <AppText
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: selectedCategory ? colors.primary : colors.text,
                flex: 1,
              }}
            >
              {selectedCategoryName || "Categoría"}
            </AppText>
          </View>
          <Ionicons
            name="chevron-down"
            size={14}
            color={selectedCategory ? colors.primary : colors.muted}
          />
        </Pressable>

        {/* Botón Filtros con badge */}
        <Pressable
          onPress={() => setPanelOpen((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: activeCount > 0 ? colors.primary : colors.border,
            backgroundColor:
              activeCount > 0 ? `${colors.primary}12` : colors.surface,
            flexShrink: 0,
          }}
        >
          <Ionicons
            name={panelOpen ? "options" : "options-outline"}
            size={16}
            color={activeCount > 0 ? colors.primary : colors.text}
          />
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: activeCount > 0 ? colors.primary : colors.text,
            }}
          >
            Filtros
          </AppText>
          {activeCount > 0 && (
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                {activeCount}
              </AppText>
            </View>
          )}
        </Pressable>

        {/* Toggle "Solo disponibles" — visible siempre, escritorio y móvil */}
        <Pressable
          onPress={() => onChangeInStock?.(!inStock)}
          accessibilityRole="switch"
          accessibilityState={{ checked: inStock }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: inStock ? colors.primary : colors.border,
            backgroundColor: inStock ? `${colors.primary}12` : colors.surface,
            flexShrink: 0,
          }}
        >
          <Ionicons
            name={inStock ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={inStock ? colors.primary : colors.muted}
          />
          <AppText
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: inStock ? colors.primary : colors.text,
            }}
          >
            Solo disponibles
          </AppText>
        </Pressable>
      </View>

      {/* ── Panel expandible: Precio + Orden ────────────────────────────────── */}
      {panelOpen && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: 10,
            gap: 14,
          }}
        >
          {/* Rango de precio */}
          <View>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Rango de precio
            </AppText>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <AppText
                  style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}
                >
                  Mínimo
                </AppText>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: minPrice ? colors.primary : colors.border,
                    borderRadius: radius.md,
                    backgroundColor: colors.background,
                    paddingHorizontal: 10,
                    height: 44,
                  }}
                >
                  <AppText style={{ color: colors.muted, marginRight: 4 }}>
                    $
                  </AppText>
                  <TextInput
                    value={minPrice}
                    onChangeText={onChangeMinPrice}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={{ flex: 1, color: colors.text, fontSize: 14 }}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <AppText
                  style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}
                >
                  Máximo
                </AppText>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: maxPrice ? colors.primary : colors.border,
                    borderRadius: radius.md,
                    backgroundColor: colors.background,
                    paddingHorizontal: 10,
                    height: 44,
                  }}
                >
                  <AppText style={{ color: colors.muted, marginRight: 4 }}>
                    $
                  </AppText>
                  <TextInput
                    value={maxPrice}
                    onChangeText={onChangeMaxPrice}
                    placeholder="Sin límite"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={{ flex: 1, color: colors.text, fontSize: 14 }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Ordenar por */}
          <View>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Ordenar por
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChangeSort(active ? "" : opt.value)}
                    style={sortChip(active)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={active ? colors.primary : colors.muted}
                    />
                    <AppText
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: active ? colors.primary : colors.text,
                      }}
                    >
                      {opt.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Marca */}
          <View>
            <AppText
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Marca
            </AppText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: brand ? colors.primary : colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.background,
                paddingHorizontal: 10,
                height: 44,
              }}
            >
              <Ionicons
                name="pricetag-outline"
                size={15}
                color={brand ? colors.primary : colors.muted}
                style={{ marginRight: 6 }}
              />
              <TextInput
                value={brand}
                onChangeText={onChangeBrand}
                placeholder="Ej: Soprole, Carozzi..."
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                style={{ flex: 1, color: colors.text, fontSize: 14 }}
              />
              {brand ? (
                <Pressable onPress={() => onChangeBrand?.("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Limpiar filtros */}
          {totalActive > 0 && (
            <Pressable
              onPress={() => {
                onClear();
                setPanelOpen(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: "#ef4444",
                backgroundColor: "#fef2f2",
              }}
            >
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
              <AppText
                style={{ fontSize: 13, fontWeight: "700", color: "#ef4444" }}
              >
                Limpiar todos los filtros
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Chips de filtros activos ─────────────────────────────────────────── */}
      {totalActive > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
          contentContainerStyle={{ gap: 6, alignItems: "center" }}
        >
          {selectedCategoryName && (
            <ActiveChip
              label={selectedCategoryName}
              icon="grid-outline"
              onRemove={() => onSelectCategory("")}
            />
          )}
          {inStock ? (
            <ActiveChip
              label="Solo disponibles"
              icon="checkmark-circle-outline"
              onRemove={() => onChangeInStock?.(false)}
            />
          ) : null}
          {selectedSortLabel && (
            <ActiveChip
              label={selectedSortLabel}
              icon="swap-vertical-outline"
              onRemove={() => onChangeSort("")}
            />
          )}
          {brand ? (
            <ActiveChip
              label={brand}
              icon="pricetag-outline"
              onRemove={() => onChangeBrand?.("")}
            />
          ) : null}
          {minPrice ? (
            <ActiveChip
              label={`Desde $${Number(minPrice).toLocaleString("es-CL")}`}
              icon="arrow-up-circle-outline"
              onRemove={() => onChangeMinPrice("")}
            />
          ) : null}
          {maxPrice ? (
            <ActiveChip
              label={`Hasta $${Number(maxPrice).toLocaleString("es-CL")}`}
              icon="arrow-down-circle-outline"
              onRemove={() => onChangeMaxPrice("")}
            />
          ) : null}

          {/* Limpiar todo */}
          <Pressable
            onPress={() => {
              onClear();
              setPanelOpen(false);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={13} color={colors.muted} />
            <AppText
              style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}
            >
              Limpiar todo
            </AppText>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Modal de categorías ──────────────────────────────────────────────── */}
      <Modal
        visible={categoryModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        {/* Overlay — toca fuera para cerrar */}
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
          onPress={closeModal}
        >
          {/* Sheet — evita que el tap se propague al overlay */}
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: spacing.md,
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.lg,
              maxHeight: "80%",
            }}
            onPress={() => {}}
          >
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 14,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <AppText
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: colors.text,
                }}
              >
                Categorías
              </AppText>
              <Pressable onPress={closeModal} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            {/* Buscador (solo si hay más de 8 categorías) */}
            {categories.length > 8 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  height: 42,
                  marginBottom: 12,
                }}
              >
                <Ionicons name="search-outline" size={16} color={colors.muted} />
                <TextInput
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder="Buscar categoría..."
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, color: colors.text, fontSize: 14 }}
                  autoCorrect={false}
                />
                {categorySearch.length > 0 && (
                  <Pressable onPress={() => setCategorySearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Opción "Todas" */}
            {!categorySearch && (
              <Pressable
                onPress={() => {
                  onSelectCategory("");
                  closeModal();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor:
                    selectedCategory === "" ? colors.primary : colors.border,
                  backgroundColor:
                    selectedCategory === ""
                      ? `${colors.primary}12`
                      : colors.background,
                  marginBottom: 10,
                }}
              >
                <Ionicons
                  name="apps-outline"
                  size={18}
                  color={
                    selectedCategory === "" ? colors.primary : colors.muted
                  }
                />
                <AppText
                  style={{
                    flex: 1,
                    fontWeight: "700",
                    fontSize: 14,
                    color:
                      selectedCategory === "" ? colors.primary : colors.text,
                  }}
                >
                  Todas las categorías
                </AppText>
                {selectedCategory === "" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.primary}
                  />
                )}
              </Pressable>
            )}

            {/* Lista de categorías — plana si hay búsqueda, jerárquica si no */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {categorySearch.trim() ? (
                // ── Búsqueda activa: lista plana ──────────────────────────────
                filteredCategories.length === 0 ? (
                  <AppText style={{ color: colors.muted, textAlign: "center", paddingVertical: spacing.md }}>
                    Sin resultados
                  </AppText>
                ) : (
                  filteredCategories.map((item) => {
                    const id = item._id || item.id || "";
                    const active = selectedCategory === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => { onSelectCategory(id); closeModal(); }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}10` : colors.background,
                          marginBottom: 8,
                        }}
                      >
                        <AppText numberOfLines={1} style={{
                          flex: 1, fontSize: 14,
                          fontWeight: active ? "700" : "500",
                          color: active ? colors.primary : colors.text,
                        }}>
                          {item.name}
                        </AppText>
                        {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      </Pressable>
                    );
                  })
                )
              ) : (
                // ── Sin búsqueda: vista jerárquica ────────────────────────────
                (() => {
                  const parents  = categories.filter((c) => !c.parent_id);
                  const childMap = categories.reduce((acc, c) => {
                    if (!c.parent_id) return acc;
                    const key = String(c.parent_id);
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(c);
                    return acc;
                  }, {});
                  const parentIds = new Set(parents.map((p) => String(p._id || p.id)));
                  const orphans   = categories.filter(
                    (c) => c.parent_id && !parentIds.has(String(c.parent_id))
                  );

                  const rows = [];

                  // Padres con sus hijos
                  for (const parent of parents) {
                    const pid    = String(parent._id || parent.id || "");
                    const kids   = childMap[pid] || [];
                    const active = selectedCategory === pid;

                    rows.push(
                      // Fila padre
                      <Pressable
                        key={`parent-${pid}`}
                        onPress={() => { onSelectCategory(pid); closeModal(); }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 13,
                          borderBottomWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: active ? `${colors.primary}08` : colors.surface,
                        }}
                      >
                        <AppText numberOfLines={1} style={{
                          flex: 1, fontSize: 14, fontWeight: "800",
                          color: active ? colors.primary : colors.text,
                        }}>
                          {parent.name}
                        </AppText>
                        {kids.length > 0 && (
                          <AppText style={{ fontSize: 11, color: colors.muted, marginRight: 4 }}>
                            {kids.length}
                          </AppText>
                        )}
                        {active
                          ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                          : <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                        }
                      </Pressable>
                    );

                    // Filas hijos con sangría
                    for (const child of kids) {
                      const cid    = String(child._id || child.id || "");
                      const cActive = selectedCategory === cid;
                      rows.push(
                        <Pressable
                          key={`child-${cid}`}
                          onPress={() => { onSelectCategory(cid); closeModal(); }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingLeft: 36,
                            paddingRight: 14,
                            paddingVertical: 11,
                            borderBottomWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: cActive ? `${colors.primary}08` : "#FAFAFA",
                          }}
                        >
                          {/* Línea de sangría */}
                          <View style={{
                            position: "absolute", left: 20, top: 0, bottom: 0,
                            width: 1, backgroundColor: colors.border,
                          }} />
                          <AppText numberOfLines={1} style={{
                            flex: 1, fontSize: 13,
                            fontWeight: cActive ? "700" : "400",
                            color: cActive ? colors.primary : colors.text,
                          }}>
                            {child.name}
                          </AppText>
                          {cActive && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                        </Pressable>
                      );
                    }
                  }

                  // Huérfanas al final
                  for (const cat of orphans) {
                    const id     = String(cat._id || cat.id || "");
                    const active = selectedCategory === id;
                    rows.push(
                      <Pressable
                        key={`orphan-${id}`}
                        onPress={() => { onSelectCategory(id); closeModal(); }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 13,
                          borderBottomWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: active ? `${colors.primary}08` : colors.surface,
                        }}
                      >
                        <AppText numberOfLines={1} style={{
                          flex: 1, fontSize: 14, fontWeight: "500",
                          color: active ? colors.primary : colors.text,
                        }}>
                          {cat.name}
                        </AppText>
                        {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      </Pressable>
                    );
                  }

                  return rows;
                })()
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Chip de filtro activo con X ──────────────────────────────────────────────
function ActiveChip({ label, icon, onRemove }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: `${colors.primary}15`,
        borderWidth: 1,
        borderColor: `${colors.primary}40`,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.primary} />
      <AppText
        style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}
      >
        {label}
      </AppText>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Ionicons name="close-circle" size={15} color={colors.primary} />
      </Pressable>
    </View>
  );
}
