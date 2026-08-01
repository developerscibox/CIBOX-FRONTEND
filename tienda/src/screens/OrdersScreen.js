import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { colors, radius, spacing, shadows } from "../constants/theme";
import { getMyOrders } from "../services/orderService";
import useAuthStore from "../store/authStore";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "../components/AppText";

// ── Estado → label + colores (copiado de getStatusMeta en OrderDetailScreen) ──
const getStatusMeta = (status) => {
  const map = {
    pending:   { label: "Pendiente",        bg: "#fef3c7", text: "#92400e" },
    paid:      { label: "Pagada",           bg: "#dbeafe", text: "#1d4ed8" },
    preparing: { label: "Preparando",       bg: "#ede9fe", text: "#6d28d9" },
    ready:     { label: "Lista p/ retiro",  bg: "#e0f2fe", text: "#0369a1" },
    shipped:   { label: "En camino",        bg: "#cffafe", text: "#0e7490" },
    delivered: { label: "Entregada",        bg: "#dcfce7", text: "#166534" },
    cancelled: { label: "Cancelada",        bg: "#fee2e2", text: "#b91c1c" },
    refunded:  { label: "Reembolsada",      bg: "#f3f4f6", text: "#374151" },
  };
  return map[status] || { label: status || "Sin estado", bg: "#f3f4f6", text: "#374151" };
};

// ── Mini-timeline: 4 puntos para retiro ──────────────────────────────────────
const TRACK_STEPS = [
  { key: "paid",      label: "Pago",          color: "#3b82f6" },
  { key: "preparing", label: "Preparación",   color: "#83BA42" },
  { key: "ready",     label: "Listo retiro",  color: "#0ea5e9" },
  { key: "delivered", label: "Entregado",     color: "#16a34a" },
];
// Orden de progreso: estados previos a "paid" aún no completan ningún punto.
const TRACK_ORDER = ["pending", "paid", "preparing", "ready", "shipped", "delivered"];

// Seguimiento (en curso) vs Historial (finalizados).
const ACTIVE_STATUSES = ["pending", "paid", "preparing", "ready", "shipped"];
const DONE_STATUSES = ["delivered", "cancelled", "refunded"];

const TAB_META = {
  tracking: {
    title: "Mi seguimiento",
    subtitle: "Sigue en vivo cada pedido en curso: pago → preparación → listo para retiro → entregado.",
    empty: "No tienes pedidos en curso ahora mismo.",
  },
  history: {
    title: "Mis compras",
    subtitle: "Tu historial de pedidos finalizados (entregados, cancelados o reembolsados).",
    empty: "Aún no tienes pedidos finalizados.",
  },
};

const formatPrice = (value) =>
  "$" + Number(value || 0).toLocaleString("es-CL");

// created_at ISO → "15 jun, 14:30"
const formatCreated = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
  })
    .format(d)
    .replace(/\./g, "");
  const pad = (n) => String(n).padStart(2, "0");
  return `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "YYYY-MM-DD" → "Lun 15 jun" (es-CL)
const formatPickupShort = (ymd) => {
  if (!ymd) return null;
  const parts = String(ymd).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return null;
  const label = new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(d)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Unidades por caja: infiere de tier_label ("Caja 20 un"), luego box_qty, luego 1
const boxSizeOf = (item) => {
  const m = String(item?.tier_label || "").match(/Caja\s*(\d+)/i);
  if (m) return Number(m[1]);
  return Number(item?.box_qty) || 1;
};

// Resumen de cantidad: "N cajas" si se infiere caja, si no "N un"
const qtyLabelOf = (item) => {
  const qty = Math.max(0, Number(item?.quantity) || 0);
  const boxSize = boxSizeOf(item);
  if (boxSize > 1) {
    const boxes = Math.max(1, Math.round(qty / boxSize));
    return `${boxes} caja${boxes === 1 ? "" : "s"}`;
  }
  return `${qty} un`;
};

export default function OrdersScreen({ navigation, route }) {
  const { token } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pestaña: "tracking" (en curso) | "history" (finalizados). El botón de origen
  // (Mi seguimiento / Mis compras) la preselecciona vía route.params.mode.
  const [tab, setTab] = useState(
    route?.params?.mode === "history" ? "history" : "tracking",
  );
  useEffect(() => {
    const m = route?.params?.mode;
    if (m === "history" || m === "tracking") setTab(m);
  }, [route?.params?.mode]);

  const fetchOrders = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getMyOrders();
      const items = data?.orders || data?.data?.orders || data?.data || data || [];
      setOrders(Array.isArray(items) ? items : []);
    } catch (error) {
      console.log("GET ORDERS ERROR:", error?.response?.data || error.message);
      showAppAlert("Error", "No se pudieron cargar las órdenes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  };

  // ── Mini-línea de seguimiento ───────────────────────────────────────────────
  const renderTracker = (status) => {
    const norm = String(status || "").toLowerCase();

    if (norm === "cancelled" || norm === "refunded") {
      const isCanc = norm === "cancelled";
      return (
        <View style={styles.trackerCancelled}>
          <View style={[styles.dot, styles.dotDone, { backgroundColor: isCanc ? "#ef4444" : "#9ca3af" }]} />
          <AppText style={[styles.trackerCancelText, { color: isCanc ? "#b91c1c" : colors.muted }]}>
            {isCanc ? "Cancelada" : "Reembolsada"}
          </AppText>
        </View>
      );
    }

    const currentIdx = TRACK_ORDER.indexOf(norm);

    return (
      <View style={styles.tracker}>
        {TRACK_STEPS.map((step, i) => {
          const stepIdx = TRACK_ORDER.indexOf(step.key);
          const done = currentIdx >= stepIdx;
          const isLast = i === TRACK_STEPS.length - 1;
          const nextDone = !isLast && currentIdx >= TRACK_ORDER.indexOf(TRACK_STEPS[i + 1].key);
          return (
            <View key={step.key} style={styles.trackStep}>
              <View style={styles.trackTop}>
                <View
                  style={[
                    styles.dot,
                    done
                      ? { backgroundColor: step.color, borderColor: step.color }
                      : styles.dotPending,
                  ]}
                />
                {!isLast && (
                  <View
                    style={[
                      styles.line,
                      { backgroundColor: nextDone ? step.color : "#e5e7eb" },
                    ]}
                  />
                )}
              </View>
              <AppText
                style={[
                  styles.trackLabel,
                  { color: done ? colors.text : colors.muted, fontWeight: done ? "700" : "500" },
                ]}
                numberOfLines={1}
              >
                {step.label}
              </AppText>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Preview de ítems ─────────────────────────────────────────────────────────
  const renderItemsPreview = (items) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return null;
    const shown = list.slice(0, 3);
    const rest = list.length - shown.length;
    return (
      <View style={styles.itemsPreview}>
        {shown.map((it, i) => (
          <View key={String(it.product_id || i)} style={styles.itemRow}>
            <Ionicons name="cube-outline" size={13} color={colors.muted} />
            <AppText style={styles.itemText} numberOfLines={1}>
              {qtyLabelOf(it)} × {it.name || "Producto"}
            </AppText>
          </View>
        ))}
        {rest > 0 ? (
          <AppText style={styles.itemMore}>y {rest} más…</AppText>
        ) : null}
      </View>
    );
  };

  if (!token) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.lg,
              ...shadows.card,
            }}
          >
            <AppText
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text,
                textAlign: "center",
                marginBottom: spacing.sm,
              }}
            >
              Inicia sesión para ver tus órdenes
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: spacing.lg,
              }}
            >
              Desde aquí podrás revisar el estado y detalle de tus compras
              asociadas a tu cuenta.
            </AppText>

            <Pressable
              onPress={() => navigation.navigate("Auth")}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
                marginBottom: spacing.sm,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                Iniciar sesión
              </AppText>
            </Pressable>

            <Pressable
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "Inicio" })
              }
              style={{
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  color: colors.primary,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                Volver al catálogo
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (loading) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: spacing.sm, color: colors.muted }}>
            Cargando órdenes...
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  if (!orders.length) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.lg,
              ...shadows.card,
            }}
          >
            <AppText
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: colors.text,
                marginBottom: spacing.sm,
                textAlign: "center",
              }}
            >
              Aún no tienes órdenes
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: spacing.lg,
              }}
            >
              Cuando completes una compra asociada a tu cuenta, aparecerá aquí.
            </AppText>

            <Pressable
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "Inicio" })
              }
              style={{
                backgroundColor: colors.primary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                Ir al catálogo
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const meta = TAB_META[tab];
  const visible = orders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return tab === "history"
      ? DONE_STATUSES.includes(s)
      : ACTIVE_STATUSES.includes(s);
  });

  return (
    <ScreenContainer maxWidth={720}>
      <FlatList
        data={visible}
        keyExtractor={(item, index) => String(item._id || item.id || index)}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
            <Ionicons name="cube-outline" size={40} color={colors.muted} />
            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                marginTop: spacing.sm,
              }}
            >
              {meta.empty}
            </AppText>
          </View>
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <AppText
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              {meta.title}
            </AppText>

            <AppText style={{ color: colors.muted, marginBottom: spacing.md }}>
              {meta.subtitle}
            </AppText>

            {/* Segmento: En curso / Historial */}
            <View style={styles.segment}>
              <Pressable
                onPress={() => setTab("tracking")}
                style={[styles.segmentBtn, tab === "tracking" && styles.segmentBtnActive]}
              >
                <AppText
                  style={[styles.segmentText, tab === "tracking" && styles.segmentTextActive]}
                >
                  En curso
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => setTab("history")}
                style={[styles.segmentBtn, tab === "history" && styles.segmentBtnActive]}
              >
                <AppText
                  style={[styles.segmentText, tab === "history" && styles.segmentTextActive]}
                >
                  Historial
                </AppText>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const statusMeta = getStatusMeta(item.status);
          const isPickup = item.delivery_method === "pickup";
          const pickupDate = isPickup
            ? formatPickupShort(item.pickup?.committed_date)
            : null;
          const created = formatCreated(item.created_at);

          // Transferencia impaga: falta subir el comprobante o está en revisión.
          const isTransferPending =
            item.payment?.method === "transfer" &&
            item.payment?.status !== "approved" &&
            String(item.status).toLowerCase() === "pending";
          const hasReceipt = !!item.payment?.transfer_receipt_url;

          return (
            <Pressable
              onPress={() => navigation.navigate("OrderDetail", { orderId: item._id })}
              style={cardStyle}
            >
              {/* Encabezado: número + badge de estado */}
              <View style={styles.headerRow}>
                <AppText style={styles.orderNumber}>
                  Orden #{String(item._id || "").slice(-6).toUpperCase()}
                </AppText>
                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                  <AppText style={[styles.statusText, { color: statusMeta.text }]}>
                    {statusMeta.label}
                  </AppText>
                </View>
              </View>

              {/* Fecha de creación + retiro */}
              {created ? (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                  <AppText style={styles.metaText}>{created}</AppText>
                </View>
              ) : null}

              {isPickup && pickupDate ? (
                <View style={styles.metaRow}>
                  <Ionicons name="storefront-outline" size={13} color={colors.primary} />
                  <AppText style={[styles.metaText, { color: colors.primary, fontWeight: "700" }]}>
                    Retiro: {pickupDate}
                  </AppText>
                </View>
              ) : null}

              {/* Transferencia: falta comprobante / en revisión (subir en detalle) */}
              {isTransferPending ? (
                <View
                  style={[
                    styles.receiptBadge,
                    { backgroundColor: hasReceipt ? "#dbeafe" : "#fef3c7" },
                  ]}
                >
                  <Ionicons
                    name={hasReceipt ? "time-outline" : "alert-circle-outline"}
                    size={12}
                    color={hasReceipt ? "#1d4ed8" : "#92400e"}
                  />
                  <AppText
                    style={[
                      styles.receiptBadgeText,
                      { color: hasReceipt ? "#1d4ed8" : "#92400e" },
                    ]}
                  >
                    {hasReceipt
                      ? "Comprobante en revisión"
                      : "Falta comprobante — toca para subirlo"}
                  </AppText>
                </View>
              ) : null}

              {/* Mini-línea de seguimiento */}
              {renderTracker(item.status)}

              {/* Preview de ítems */}
              {renderItemsPreview(item.items)}

              {/* Total + Ver detalle */}
              <View style={styles.footerRow}>
                <View>
                  <AppText style={styles.totalLabel}>Total</AppText>
                  <AppText style={styles.totalValue}>{formatPrice(item.total)}</AppText>
                </View>
                <View style={styles.detailBtn}>
                  <AppText style={styles.detailBtnText}>Ver detalle</AppText>
                  <Ionicons name="chevron-forward" size={15} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Encabezado
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    flexShrink: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Meta (fecha / retiro)
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  metaText: { fontSize: 12, color: colors.muted },

  // Transferencia: falta comprobante / en revisión
  receiptBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  receiptBadgeText: { fontSize: 11, fontWeight: "700" },

  // Mini-tracker
  tracker: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 4,
  },
  trackStep: { flex: 1 },
  trackTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  dotDone: { borderColor: "transparent" },
  dotPending: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
  },
  trackLabel: {
    fontSize: 10,
    marginTop: 5,
  },
  trackerCancelled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    marginBottom: 4,
  },
  trackerCancelText: { fontSize: 13, fontWeight: "700" },

  // Preview de ítems
  itemsPreview: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemText: { fontSize: 13, color: colors.text, flexShrink: 1 },
  itemMore: { fontSize: 12, color: colors.muted, fontStyle: "italic" },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 11, color: colors.muted, marginBottom: 1 },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: `${colors.primary}12`,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },

  // Segmento En curso / Historial
  segment: {
    flexDirection: "row",
    backgroundColor: `${colors.primary}10`,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: colors.primaryText },
});
