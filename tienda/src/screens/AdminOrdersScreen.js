import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import { colors, radius, spacing } from "../constants/theme";
import { adminGetOrders, adminUpdateOrderStatus } from "../services/orderService";
import { showAppAlert } from "../utils/appAlerts";

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: null,        label: "Todas" },
  { key: "pending",   label: "Pendientes" },
  { key: "paid",      label: "Pagadas" },
  { key: "preparing", label: "Preparando" },
  { key: "ready",     label: "Listas para retiro" },
  { key: "delivered", label: "Retiradas" },
  { key: "cancelled", label: "Canceladas" },
];

const NEXT_STATUS = {
  pending:   [{ value: "paid",      label: "✅ Marcar pagada" }],
  paid:      [{ value: "preparing", label: "📦 Comenzar preparación" }],
  preparing: [{ value: "ready",     label: "🧺 Marcar lista para retiro" }],
  ready:     [{ value: "delivered", label: "🛍️ Marcar retirada" }],
  delivered: [],
  cancelled: [],
  refunded:  [],
};

const STATUS_META = {
  pending:   { label: "Pendiente",        bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  paid:      { label: "Pagada",           bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  preparing: { label: "Preparando",       bg: "#ede9fe", text: "#6d28d9", dot: "#83BA42" },
  ready:     { label: "Lista para retiro", bg: "#e0f2fe", text: "#0369a1", dot: "#0ea5e9" },
  delivered: { label: "Retirada",         bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  cancelled: { label: "Cancelada",        bg: "#fee2e2", text: "#b91c1c", dot: "#ef4444" },
  refunded:  { label: "Reembolsada",      bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
};

// Etapas del mini indicador de avance: pago → preparación → listo → retiro
const PROGRESS_STEPS = [
  { key: "paid",      icon: "card-outline",         reached: ["paid", "preparing", "ready", "delivered"] },
  { key: "preparing", icon: "cube-outline",         reached: ["preparing", "ready", "delivered"] },
  { key: "ready",     icon: "checkmark-done-outline", reached: ["ready", "delivered"] },
  { key: "delivered", icon: "bag-handle-outline",   reached: ["delivered"] },
];

// Tamaño de caja inferido del tier_label ("Caja 20 un") o del pricing.tiers de mayor min_qty.
// Devuelve null si no se puede inferir (se muestra en unidades).
const boxSizeOf = (it) => {
  const m = /Caja\s*(\d+)/i.exec(String(it?.tier_label || ""));
  if (m) return Number(m[1]) || null;
  const tiers = it?.pricing?.tiers;
  if (Array.isArray(tiers) && tiers.length) {
    const top = tiers.reduce(
      (best, t) => (Number(t?.min_qty) > Number(best?.min_qty) ? t : best),
      tiers[0]
    );
    const size = Number(top?.min_qty);
    if (size > 0) return size;
  }
  return null;
};

// Cantidad de cajas (round(quantity / boxSize)); si no se infiere caja, 0.
const boxesOf = (it) => {
  const qty = Number(it?.quantity) || 0;
  const size = boxSizeOf(it);
  if (!size) return 0;
  return Math.max(1, Math.round(qty / size));
};

// Etiqueta del pill: "N caja(s)" si se infiere caja, si no "N unidad(es)".
const qtyLabelOf = (it) => {
  const boxes = boxesOf(it);
  if (boxes > 0) return `${boxes} caja${boxes === 1 ? "" : "s"}`;
  const qty = Number(it?.quantity) || 0;
  return `${qty} unidad${qty === 1 ? "" : "es"}`;
};

const formatDate = (d) => {
  if (!d) return "—";
  const dt  = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const formatPrice = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

// ── Componente ────────────────────────────────────────────────────────────────
export default function AdminOrdersScreen({ navigation }) {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal de cambio de estado
  const [modalOrder, setModalOrder]     = useState(null);
  const [newStatus, setNewStatus]       = useState("");
  const [noteInput, setNoteInput]       = useState("");
  const [updating, setUpdating]         = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async ({ pageNum = 1, status = filterStatus, replace = true } = {}) => {
    try {
      if (replace) setLoading(true);
      else setLoadingMore(true);

      const data = await adminGetOrders({ page: pageNum, limit: 20, status });
      const list = Array.isArray(data?.orders) ? data.orders : [];
      const totalPages = data?.pagination?.pages || 1;

      setOrders((prev) => (replace ? list : [...prev, ...list]));
      setPage(pageNum);
      setHasMore(pageNum < totalPages);
    } catch (err) {
      console.log("ADMIN ORDERS ERROR:", err?.response?.data || err.message);
      showAppAlert("Error", "No se pudieron cargar las órdenes");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchOrders({ pageNum: 1, replace: true });
  }, [filterStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders({ pageNum: 1, replace: true });
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchOrders({ pageNum: page + 1, replace: false });
  };

  // ── Modal: abrir ──────────────────────────────────────────────────────────
  const openModal = (order) => {
    setModalOrder(order);
    setNewStatus(NEXT_STATUS[order.status]?.[0]?.value || "");
    setNoteInput("");
  };

  const closeModal = () => {
    setModalOrder(null);
    setNewStatus("");
    setNoteInput("");
  };

  // ── Actualizar estado ─────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!newStatus || !modalOrder) return;
    setUpdating(true);
    try {
      await adminUpdateOrderStatus(modalOrder._id, {
        status: newStatus,
        note: noteInput.trim() || null,
      });

      // Actualizar en la lista local sin refetch
      setOrders((prev) =>
        prev.map((o) =>
          o._id === modalOrder._id ? { ...o, status: newStatus } : o
        )
      );

      showAppAlert("¡Listo!", `Orden actualizada a "${STATUS_META[newStatus]?.label || newStatus}"`);
      closeModal();
    } catch (err) {
      const msg = err?.response?.data?.message || "No se pudo actualizar";
      showAppAlert("Error", msg);
    } finally {
      setUpdating(false);
    }
  };

  // ── Render item ───────────────────────────────────────────────────────────
  const renderOrder = ({ item }) => {
    const meta      = STATUS_META[item.status] || STATUS_META.pending;
    const nextSteps = NEXT_STATUS[item.status] || [];
    const canUpdate = nextSteps.length > 0;

    const allItems   = Array.isArray(item.items) ? item.items : [];
    const totalBoxes = allItems.reduce((acc, it) => acc + boxesOf(it), 0);
    const preview    = allItems.slice(0, 3);
    const extra      = allItems.length - preview.length;
    const isClosed   = item.status === "cancelled" || item.status === "refunded";

    return (
      <View style={[styles.orderCard, { borderLeftWidth: 4, borderLeftColor: meta.dot }]}>
        {/* Header: Nº orden + badge de estado */}
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.orderId}>
              #{String(item._id).slice(-6).toUpperCase()}
            </AppText>
            <View style={styles.dateRow}>
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <AppText style={styles.orderDate}>{formatDate(item.created_at)}</AppText>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
            <AppText style={[styles.statusText, { color: meta.text }]}>
              {meta.label}
            </AppText>
          </View>
        </View>

        {/* Cliente + total destacado */}
        <View style={styles.midRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {item.customer?.fullName ? (
              <View style={styles.customerLine}>
                <Ionicons name="person-circle-outline" size={15} color={colors.primary} />
                <AppText style={styles.customerName} numberOfLines={1}>
                  {item.customer.fullName}
                </AppText>
              </View>
            ) : null}
            {item.customer?.email ? (
              <AppText style={styles.customerEmail} numberOfLines={1}>
                {item.customer.email}
              </AppText>
            ) : null}
          </View>
          <View style={styles.totalBox}>
            <AppText style={styles.totalLabel}>Total</AppText>
            <AppText style={styles.orderTotal}>{formatPrice(item.total)}</AppText>
          </View>
        </View>

        {/* Preview de ítems (por caja) */}
        {preview.length > 0 && (
          <View style={styles.itemsPreview}>
            {preview.map((it, idx) => (
              <View key={String(it.product_id || idx)} style={styles.itemLine}>
                <View style={styles.itemQtyPill}>
                  <AppText style={styles.itemQtyText}>{qtyLabelOf(it)}</AppText>
                </View>
                <AppText style={styles.itemName} numberOfLines={1}>
                  {it.name || "Producto"}
                </AppText>
              </View>
            ))}
            {extra > 0 && (
              <AppText style={styles.itemMore}>y {extra} más…</AppText>
            )}
            <AppText style={styles.itemsTotalNote}>
              {totalBoxes} caja{totalBoxes === 1 ? "" : "s"} en total
            </AppText>
          </View>
        )}

        {/* Mini indicador de avance: pago → preparación → listo → entregado */}
        {!isClosed && (
          <View style={styles.progressRow}>
            {PROGRESS_STEPS.map((step, idx) => {
              const reached = step.reached.includes(item.status);
              const isCurrent = step.key === item.status;
              return (
                <View key={step.key} style={styles.progressItem}>
                  <View
                    style={[
                      styles.progressDot,
                      reached && { backgroundColor: meta.dot, borderColor: meta.dot },
                      isCurrent && styles.progressDotCurrent,
                    ]}
                  >
                    <Ionicons
                      name={step.icon}
                      size={11}
                      color={reached ? "#fff" : "#c4c4c4"}
                    />
                  </View>
                  {idx < PROGRESS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        reached && PROGRESS_STEPS[idx + 1].reached.includes(item.status) && { backgroundColor: meta.dot },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Acciones */}
        <View style={styles.orderActions}>
          <Pressable
            onPress={() => navigation.navigate("OrderDetail", { orderId: item._id })}
            style={styles.viewBtn}
          >
            <Ionicons name="eye-outline" size={14} color={colors.primary} />
            <AppText style={styles.viewBtnText}>Ver detalle</AppText>
          </Pressable>

          {canUpdate && (
            <Pressable onPress={() => openModal(item)} style={styles.updateBtn}>
              <Ionicons name="arrow-forward-circle-outline" size={14} color="#fff" />
              <AppText style={styles.updateBtnText}>Cambiar estado</AppText>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer maxWidth={760} padded>

      {/* Título */}
      <View style={styles.pageHeader}>
        <AppText style={styles.pageTitle}>Panel de órdenes</AppText>
        <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Filtros de estado */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 14, flexGrow: 0, maxHeight: 50 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 2, alignItems: "center" }}
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={String(f.key)}
            onPress={() => setFilterStatus(f.key)}
            style={[
              styles.filterChip,
              filterStatus === f.key && styles.filterChipActive,
            ]}
          >
            <AppText style={[
              styles.filterText,
              filterStatus === f.key && styles.filterTextActive,
            ]}>
              {f.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderOrder}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <AppText style={{ color: colors.muted, textAlign: "center" }}>
                No hay órdenes {filterStatus ? `con estado "${STATUS_META[filterStatus]?.label}"` : ""}.
              </AppText>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
            ) : null
          }
        />
      )}

      {/* ── Modal cambio de estado ── */}
      <Modal visible={!!modalOrder} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>
                Orden #{String(modalOrder?._id || "").slice(-6).toUpperCase()}
              </AppText>
              <Pressable onPress={closeModal}>
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </Pressable>
            </View>

            <AppText style={styles.modalSub}>
              Estado actual:{" "}
              <AppText style={{ fontWeight: "800", color: STATUS_META[modalOrder?.status]?.text }}>
                {STATUS_META[modalOrder?.status]?.label}
              </AppText>
            </AppText>

            {/* Selector de nuevo estado */}
            <AppText style={styles.inputLabel}>Nuevo estado</AppText>
            <View style={styles.statusOptions}>
              {(NEXT_STATUS[modalOrder?.status] || []).map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setNewStatus(opt.value)}
                  style={[
                    styles.statusOption,
                    newStatus === opt.value && styles.statusOptionActive,
                  ]}
                >
                  <AppText style={[
                    styles.statusOptionText,
                    newStatus === opt.value && { color: "#fff" },
                  ]}>
                    {opt.label}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {/* Nota */}
            <AppText style={styles.inputLabel}>Nota interna (opcional)</AppText>
            <TextInput
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="Ej: Sale hoy en la tarde"
              placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 60 }]}
              multiline
            />

            {/* Botón confirmar */}
            <Pressable
              onPress={handleUpdate}
              disabled={!newStatus || updating}
              style={[styles.confirmBtn, (!newStatus || updating) && { opacity: 0.5 }]}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <AppText style={styles.confirmBtnText}>Confirmar cambio</AppText>
                </>
              )}
            </Pressable>

            <Pressable onPress={closeModal} style={styles.cancelBtn}>
              <AppText style={styles.cancelBtnText}>Cancelar</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  pageTitle: { fontSize: 22, fontWeight: "900", color: colors.text },
  refreshBtn: {
    padding: 8, borderRadius: 10,
    backgroundColor: `${colors.primary}12`,
  },

  // Filtros
  filterChip: {
    height: 38,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  // Card de orden
  orderCard: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: spacing.md, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  orderId:     { fontSize: 16, fontWeight: "900", color: colors.text, letterSpacing: 0.3 },
  dateRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  orderDate:   { fontSize: 12, color: colors.muted },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 11, fontWeight: "800" },

  // Fila cliente + total
  midRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  customerLine:  { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 1 },
  customerName:  { fontSize: 13, color: colors.text, fontWeight: "700", flexShrink: 1 },
  customerEmail: { fontSize: 12, color: colors.muted, marginLeft: 19 },
  totalBox:      { alignItems: "flex-end" },
  totalLabel:    { fontSize: 10, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  orderTotal:    { fontSize: 19, fontWeight: "900", color: colors.primary },

  // Preview de ítems
  itemsPreview: {
    backgroundColor: colors.background, borderRadius: 10,
    padding: 10, marginBottom: 10, gap: 6,
  },
  itemLine:    { flexDirection: "row", alignItems: "center", gap: 8 },
  itemQtyPill: {
    backgroundColor: `${colors.primary}15`, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 56, alignItems: "center",
  },
  itemQtyText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  itemName:    { fontSize: 13, color: colors.text, fontWeight: "600", flex: 1 },
  itemMore:    { fontSize: 12, color: colors.muted, fontStyle: "italic", marginLeft: 2 },
  itemsTotalNote: {
    fontSize: 11, fontWeight: "700", color: colors.muted,
    marginTop: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6,
  },

  // Mini indicador de avance
  progressRow:  { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingHorizontal: 2 },
  progressItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  progressDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: "#e0e0e0", backgroundColor: "#f3f4f6",
    justifyContent: "center", alignItems: "center",
  },
  progressDotCurrent: {
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
    transform: [{ scale: 1.12 }],
  },
  progressLine: { flex: 1, height: 2, backgroundColor: "#e5e7eb", marginHorizontal: 3 },

  orderActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  viewBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1,
    borderColor: `${colors.primary}30`, backgroundColor: `${colors.primary}08`,
  },
  viewBtnText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  updateBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 5,
    paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.primary,
  },
  updateBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  emptyBox: {
    padding: spacing.xl, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, backgroundColor: colors.surface,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, width: "100%", maxWidth: 420,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  modalSub:   { fontSize: 13, color: colors.muted, marginBottom: 16 },

  inputLabel: {
    fontSize: 12, fontWeight: "700",
    color: colors.text, marginBottom: 6, marginTop: 12,
  },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 10,
    fontSize: 14, color: colors.text,
    backgroundColor: colors.background,
  },

  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusOption: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.background,
  },
  statusOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusOptionText:   { fontSize: 13, fontWeight: "700", color: colors.text },

  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: 13,
    marginTop: 20,
  },
  confirmBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  cancelBtn: {
    alignItems: "center", paddingVertical: 11, marginTop: 8,
  },
  cancelBtnText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
});
