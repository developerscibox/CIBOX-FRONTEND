import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import TransferPaymentCard from "../components/TransferPaymentCard";
import { colors, radius, spacing } from "../constants/theme";
import { getOrderById, cancelOrder } from "../services/orderService";
import { addItemToCart } from "../services/cartService";
import useAuthStore from "../store/authStore";
import useCartStore from "../store/cartStore";
import { showAppAlert } from "../utils/appAlerts";
import { showToast } from "../store/toastStore";

// ── Configuración del timeline ────────────────────────────────────────────────
const STEPS = [
  { key: "pending",   label: "Pedido recibido",  icon: "receipt-outline",          color: "#f59e0b" },
  { key: "paid",      label: "Pago confirmado",   icon: "checkmark-circle-outline", color: "#3b82f6" },
  { key: "preparing", label: "Preparando",        icon: "cube-outline",             color: "#8b5cf6" },
  { key: "ready",     label: "Listo p/ despacho", icon: "checkbox-outline",         color: "#0ea5e9" },
  { key: "shipped",   label: "En camino",         icon: "car-outline",              color: "#06b6d4" },
  { key: "delivered", label: "Entregado",         icon: "home-outline",             color: "#16a34a" },
];

// Pasos para órdenes de retiro en bodega (sin "En camino").
const PICKUP_STEPS = [
  { key: "pending",   label: "Pedido recibido (esperando confirmación de pago)", icon: "receipt-outline",          color: "#f59e0b" },
  { key: "paid",      label: "Pago confirmado",                                  icon: "checkmark-circle-outline", color: "#3b82f6" },
  { key: "preparing", label: "Preparando tu pedido",                            icon: "cube-outline",             color: "#8b5cf6" },
  { key: "ready",     label: "✅ Listo para retiro en bodega",                  icon: "checkbox-outline",         color: "#0ea5e9" },
  { key: "delivered", label: "Retirado",                                        icon: "home-outline",             color: "#16a34a" },
];
const PICKUP_STATUS_ORDER = ["pending", "paid", "preparing", "ready", "delivered"];

const PICKUP_LOCATION = {
  address:
    "Av. Lo Espejo 01565, Patio 6, Bodega 826, Centro Logístico Mersan, Lo Espejo",
  hint: "2da entrada por Américo Vespucio",
  hours: "Lun a Vie 09:00–18:00 · Sáb 09:00–13:00",
};

const STATUS_ORDER    = ["pending", "paid", "preparing", "ready", "shipped", "delivered"];
const ACTIVE_STATUSES = ["pending", "paid", "preparing", "ready", "shipped"];
const FINAL_STATUSES  = ["cancelled", "delivered", "refunded"];

// Fecha larga es-CL: "lunes 15 de junio de 2026"
const formatLongDate = (ymd) => {
  if (!ymd) return null;
  // committed_date llega como "YYYY-MM-DD"; construir fecha local sin desfase UTC.
  const parts = String(ymd).slice(0, 10).split("-");
  if (parts.length !== 3) return ymd;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PICKUP_STEP_FALLBACK = {
  pending: "Pedido recibido (esperando confirmación de pago)",
  paid: "Pago confirmado",
  preparing: "Preparando tu pedido",
  ready: "✅ Listo para retiro en bodega",
  delivered: "Retirado",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const d   = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatPrice = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

// Unidades por caja del ítem: infiere de tier_label ("Caja 20 un") → box_qty → 1.
const boxSizeOf = (item) => {
  const m = String(item?.tier_label || "").match(/Caja\s*(\d+)/i);
  if (m) return Number(m[1]);
  return Number(item?.box_qty) || 1;
};

const getStatusMeta = (status) => {
  const map = {
    pending:   { label: "Pendiente",   bg: "#fef3c7", text: "#92400e" },
    paid:      { label: "Pagada",      bg: "#dbeafe", text: "#1d4ed8" },
    preparing: { label: "Preparando",  bg: "#ede9fe", text: "#6d28d9" },
    ready:     { label: "Lista p/ despacho", bg: "#e0f2fe", text: "#0369a1" },
    shipped:   { label: "En camino",   bg: "#cffafe", text: "#0e7490" },
    delivered: { label: "Entregada",   bg: "#dcfce7", text: "#166534" },
    cancelled: { label: "Cancelada",   bg: "#fee2e2", text: "#b91c1c" },
    refunded:  { label: "Reembolsada", bg: "#f3f4f6", text: "#374151" },
  };
  return map[status] || { label: status || "Sin estado", bg: "#f3f4f6", text: "#374151" };
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function OrderDetailScreen({ route, navigation }) {
  const { token }           = useAuthStore();
  const { loadCartSummary } = useCartStore();
  const orderId             = route?.params?.orderId;

  const [order, setOrder]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [addingAll, setAddingAll]   = useState(false);
  const [copied, setCopied]         = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const refreshTimer                = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    if (!orderId || !token) { setLoading(false); return; }
    try {
      const data = await getOrderById(orderId);
      const item = data?.order || data?.data?.order || data?.data || data;
      setOrder(item);
    } catch (err) {
      console.log("ORDER DETAIL ERROR:", err?.response?.data || err.message);
      showAppAlert("Error", "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // ── Cancelar orden ────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      "Cancelar orden",
      "¿Estás seguro que deseas cancelar esta orden? Esta acción no se puede deshacer.",
      [
        { text: "No, mantener", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              // Detener el auto-refresh para que el setInterval no vuelva a pisar
              // el estado mientras/después de cancelar (race).
              clearInterval(refreshTimer.current);
              await cancelOrder(orderId);
              showAppAlert("Orden cancelada", "Tu orden fue cancelada correctamente.");
              fetchOrder(); // refresca el estado
            } catch (err) {
              showAppAlert(
                "Error",
                err?.response?.data?.message || "No se pudo cancelar la orden.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  // Auto-refresh cada 30 s mientras la orden está activa
  useEffect(() => {
    clearInterval(refreshTimer.current);
    // No programar refresh si no hay orden, si está en estado final
    // (cancelled/delivered/refunded) o si no está activa.
    if (!order || FINAL_STATUSES.includes(order.status)) return;
    if (!ACTIVE_STATUSES.includes(order.status)) return;
    refreshTimer.current = setInterval(fetchOrder, 30_000);
    return () => clearInterval(refreshTimer.current);
  }, [order?.status, fetchOrder]);

  // ── Volver a pedir ────────────────────────────────────────────────────────
  const handleReorder = async () => {
    if (!token) { navigation.navigate("Auth"); return; }
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) return;
    setAddingAll(true);
    try {
      for (const item of items) {
        if (!item.product_id) continue;
        // Respetar el tier de caja original: re-agregar un múltiplo entero de la
        // caja (cajas × unidades_por_caja), nunca una cantidad suelta por unidad.
        const boxSize = boxSizeOf(item);
        const totalUnits = Math.max(0, Number(item.quantity) || 0);
        const boxes = Math.max(1, Math.round(totalUnits / boxSize));
        const quantity = boxes * boxSize;
        await addItemToCart({ productId: item.product_id, quantity });
      }
      await loadCartSummary();
      showToast("Productos añadidos al carrito");
      navigation.navigate("Cart");
    } catch {
      showAppAlert("Error", "No se pudieron agregar los productos");
    } finally {
      setAddingAll(false);
    }
  };

  // ── Copiar tracking ───────────────────────────────────────────────────────
  const handleCopyTracking = async () => {
    const tn = order?.shipping?.tracking_number;
    if (!tn) return;
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(tn);
      } else {
        await Clipboard.setStringAsync(tn);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: si el portapapeles falla, mostrar el número para que el
      // usuario lo pueda copiar/anotar manualmente (no quedar en silencio).
      showAppAlert("Número de seguimiento", tn);
    }
  };

  // ── Build timeline ────────────────────────────────────────────────────────
  const getStepTime = (stepKey) => {
    const history = Array.isArray(order?.status_history) ? order.status_history : [];
    const entry   = history.find((h) => h.status === stepKey);
    return entry?.changed_at ? formatDate(entry.changed_at) : null;
  };

  const isPickup = order?.delivery_method === "pickup";

  const buildSteps = () => {
    if (!order) return [];
    const norm = String(order.status || "").toLowerCase();
    const baseSteps = isPickup ? PICKUP_STEPS : STEPS;
    const baseOrder = isPickup ? PICKUP_STATUS_ORDER : STATUS_ORDER;

    if (norm === "cancelled") {
      return [
        { ...baseSteps[0], done: true, active: false, time: getStepTime("pending") },
        {
          key: "cancelled", label: "Cancelada", icon: "close-circle-outline",
          color: "#ef4444", done: true, active: true,
          time: getStepTime("cancelled") || formatDate(order.cancelled_at),
        },
      ];
    }
    let currentIdx = baseOrder.indexOf(norm);
    // 'shipped' es alcanzable desde 'ready' (VALID_TRANSITIONS) pero no está en
    // PICKUP_STATUS_ORDER → indexOf -1 dejaba el timeline en blanco. Lo mapeamos a 'ready'.
    if (currentIdx === -1 && norm === "shipped") currentIdx = baseOrder.indexOf("ready");
    return baseSteps.map((step, i) => ({
      ...step,
      done:   currentIdx >= i,
      active: currentIdx === i,
      time:   getStepTime(step.key),
    }));
  };

  // ── Estados vacíos ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!token || !order) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
          <AppText style={{ color: colors.text, fontWeight: "700", textAlign: "center" }}>
            {!token ? "Inicia sesión para ver el detalle" : "No se encontró la orden"}
          </AppText>
          {!token && (
            <AppButton title="Iniciar sesión" onPress={() => navigation.navigate("Auth")} />
          )}
        </View>
      </ScreenContainer>
    );
  }

  const statusMeta  = getStatusMeta(order.status);
  const steps       = buildSteps();
  const orderItems  = Array.isArray(order.items) ? order.items : [];
  const trackingNum = order.shipping?.tracking_number;
  const isCancelled = order.status === "cancelled";
  const isActive    = ACTIVE_STATUSES.includes(order.status);

  const committedDateLabel = formatLongDate(order.pickup?.committed_date);
  // order.pickup.location puede ser string (dirección por defecto) u objeto {address,hours}
  const pickupLoc = order.pickup?.location;
  const pickupAddress =
    (typeof pickupLoc === "string" ? pickupLoc : pickupLoc?.address) ||
    PICKUP_LOCATION.address;
  const pickupHours =
    (typeof pickupLoc === "string" ? null : pickupLoc?.hours) ||
    PICKUP_LOCATION.hours;
  const pickupHasCustomAddress = !!(typeof pickupLoc === "string"
    ? pickupLoc
    : pickupLoc?.address);
  const statusHistory = Array.isArray(order.status_history)
    ? order.status_history
    : [];

  // Transferencia pendiente de pago: falta subir/verificar el comprobante.
  const isTransferPending =
    order.payment?.method === "transfer" &&
    order.payment?.status !== "approved" &&
    order.status === "pending";
  const hasReceipt = !!order.payment?.transfer_receipt_url;

  return (
    <ScreenContainer maxWidth={720}>
      {/* Volver */}
      <Pressable
        onPress={() =>
          navigation.canGoBack()
            ? navigation.goBack()
            : navigation.navigate("MainTabs", { screen: "OrdersTab" })
        }
        style={styles.backBtn}
      >
        <Ionicons name="arrow-back-outline" size={18} color={colors.text} />
        <AppText style={styles.backText}>Volver</AppText>
      </Pressable>

      <FlatList
        data={orderItems}
        keyExtractor={(item, i) => String(item.product_id || item._id || i)}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}

        ListHeaderComponent={
          <>
            {/* ── Cabecera ── */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <AppText style={styles.orderNumber}>
                  Orden #{String(order._id || "").slice(-6).toUpperCase()}
                </AppText>
                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                  <AppText style={[styles.statusText, { color: statusMeta.text }]}>
                    {statusMeta.label}
                  </AppText>
                </View>
              </View>

              <AppText style={styles.mutedSm}>
                {formatDate(order.created_at) || "—"}
              </AppText>

              {isActive && (
                <View style={styles.refreshHint}>
                  <Ionicons name="refresh-outline" size={11} color={colors.primary} />
                  <AppText style={styles.refreshText}>
                    Se actualiza automáticamente cada 30 s
                  </AppText>
                </View>
              )}

              {order.cancellation_reason && (
                <View style={styles.cancelReason}>
                  <AppText style={styles.cancelReasonText}>
                    Motivo: {order.cancellation_reason}
                  </AppText>
                </View>
              )}

              {/* Transferencia sin comprobante / en revisión */}
              {isTransferPending && (
                <View
                  style={[
                    styles.receiptBadge,
                    { backgroundColor: hasReceipt ? "#dbeafe" : "#fef3c7" },
                  ]}
                >
                  <Ionicons
                    name={hasReceipt ? "time-outline" : "alert-circle-outline"}
                    size={13}
                    color={hasReceipt ? "#1d4ed8" : "#92400e"}
                  />
                  <AppText
                    style={[
                      styles.receiptBadgeText,
                      { color: hasReceipt ? "#1d4ed8" : "#92400e" },
                    ]}
                  >
                    {hasReceipt ? "Comprobante en revisión" : "Falta comprobante"}
                  </AppText>
                </View>
              )}
            </View>

            {/* ── Transferencia: datos bancarios + subir comprobante ── */}
            {isTransferPending && (
              <TransferPaymentCard
                orderId={order._id}
                receiptUploaded={hasReceipt}
                onUploaded={fetchOrder}
              />
            )}

            {/* ── Timeline ── */}
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Seguimiento del pedido</AppText>

              {steps.map((step, i) => {
                const isLast    = i === steps.length - 1;
                const isCancStep = step.key === "cancelled";
                const dotBg    = step.done
                  ? (isCancStep ? "#ef4444" : step.color)
                  : "#f3f4f6";
                const dotBorder = step.done
                  ? (isCancStep ? "#ef4444" : step.color)
                  : "#d1d5db";
                const lineColor = step.done && !isLast ? step.color : "#e5e7eb";

                return (
                  <View key={step.key}>
                    <View style={styles.stepRow}>
                      {/* Burbuja icono */}
                      <View style={styles.stepIconCol}>
                        <View style={[styles.stepDot, { backgroundColor: dotBg, borderColor: dotBorder }]}>
                          <Ionicons
                            name={step.icon}
                            size={13}
                            color={step.done ? "#fff" : "#9ca3af"}
                          />
                        </View>
                      </View>

                      {/* Texto */}
                      <View style={{ flex: 1, paddingVertical: 2 }}>
                        <AppText style={[
                          styles.stepLabel,
                          { color: step.done ? colors.text : colors.muted,
                            fontWeight: step.active ? "800" : step.done ? "700" : "500" },
                        ]}>
                          {step.label}
                          {step.active ? "  ●" : ""}
                        </AppText>
                        {step.time ? (
                          <AppText style={styles.stepTime}>{step.time}</AppText>
                        ) : step.done ? (
                          <AppText style={styles.stepTime}>En proceso</AppText>
                        ) : null}
                        {step.key === "shipped" && trackingNum && step.done && (
                          <AppText style={[styles.stepTime, { color: colors.primary }]}>
                            Seguimiento: {trackingNum}
                          </AppText>
                        )}
                      </View>
                    </View>

                    {!isLast && (
                      <View style={[styles.stepLine, { backgroundColor: lineColor }]} />
                    )}
                  </View>
                );
              })}
            </View>

            {/* ── Tracking number ── */}
            {trackingNum && (
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Número de seguimiento</AppText>
                <View style={styles.trackingRow}>
                  <AppText style={styles.trackingNumber} numberOfLines={1}>
                    {trackingNum}
                  </AppText>
                  <Pressable onPress={handleCopyTracking} style={styles.copyBtn}>
                    <Ionicons
                      name={copied ? "checkmark-outline" : "copy-outline"}
                      size={15}
                      color={copied ? "#16a34a" : colors.primary}
                    />
                    <AppText style={[styles.copyText, copied && { color: "#16a34a" }]}>
                      {copied ? "Copiado" : "Copiar"}
                    </AppText>
                  </Pressable>
                </View>
                {order.shipping?.carrier && (
                  <AppText style={styles.mutedSm}>
                    Transportista: {order.shipping.carrier}
                  </AppText>
                )}
              </View>
            )}

            {/* ── Entrega / Retiro ── */}
            {isPickup ? (
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Retiro en bodega</AppText>

                {committedDateLabel ? (
                  <View style={styles.pickupDateBox}>
                    <AppText style={styles.pickupDateLabel}>
                      Fecha comprometida de retiro
                    </AppText>
                    <AppText style={styles.pickupDateValue}>
                      {committedDateLabel}
                    </AppText>
                  </View>
                ) : null}

                <AppText style={styles.mutedLine}>
                  📍 {pickupAddress}
                </AppText>
                {pickupHasCustomAddress ? null : (
                  <AppText style={styles.mutedLine}>{PICKUP_LOCATION.hint}</AppText>
                )}
                <AppText style={[styles.mutedLine, { color: colors.primary, fontWeight: "700" }]}>
                  🕘 {pickupHours}
                </AppText>
              </View>
            ) : (
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Dirección de entrega</AppText>
                <AppText style={styles.mutedLine}>{order.shipping?.address || "—"}</AppText>
                {order.shipping?.addressLine2 ? (
                  <AppText style={styles.mutedLine}>{order.shipping.addressLine2}</AppText>
                ) : null}
                <AppText style={styles.mutedLine}>
                  {[order.shipping?.city, order.shipping?.region].filter(Boolean).join(", ")}
                </AppText>
                {order.shipping?.reference ? (
                  <AppText style={styles.mutedLine}>Ref: {order.shipping.reference}</AppText>
                ) : null}
              </View>
            )}

            {/* ── Historial ── */}
            {statusHistory.length > 0 && (
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Historial</AppText>
                {statusHistory.map((entry, i) => {
                  const label = isPickup
                    ? PICKUP_STEP_FALLBACK[entry?.status] || entry?.note || entry?.status
                    : entry?.note || entry?.status;
                  const when = formatDateTime(entry?.changed_at);
                  const by = entry?.changed_by?.label || entry?.changed_by?.role;
                  return (
                    <View
                      key={`${entry?.status || "h"}-${i}`}
                      style={{
                        paddingVertical: 8,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      <AppText style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                        {label}
                      </AppText>
                      <AppText style={styles.mutedSm}>
                        {[when, by].filter(Boolean).join(" · ") || "—"}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Resumen de pago ── */}
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Resumen</AppText>

              <View style={styles.summaryRow}>
                <AppText style={styles.mutedSm}>Subtotal</AppText>
                <AppText style={styles.mutedSm}>{formatPrice(order.subtotal)}</AppText>
              </View>

              {Number(order.discount_amount) > 0 && (
                <View style={styles.summaryRow}>
                  <AppText style={[styles.mutedSm, { color: "#16a34a" }]}>Descuento</AppText>
                  <AppText style={[styles.mutedSm, { color: "#16a34a" }]}>
                    -{formatPrice(order.discount_amount)}
                  </AppText>
                </View>
              )}

              <View style={styles.summaryRow}>
                <AppText style={styles.mutedSm}>
                  {isPickup ? "Retiro en bodega" : "Despacho"}
                </AppText>
                <AppText style={styles.mutedSm}>
                  {Number(order.shipping_amount) === 0 ? "Gratis" : formatPrice(order.shipping_amount)}
                </AppText>
              </View>

              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <AppText style={styles.totalLabel}>Total</AppText>
                <AppText style={styles.totalValue}>{formatPrice(order.total)}</AppText>
              </View>
            </View>

            {/* ── Título lista de productos ── */}
            <AppText style={[styles.cardTitle, { marginHorizontal: 2, marginBottom: 8 }]}>
              Productos ({orderItems.length})
            </AppText>
          </>
        }

        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <AppText style={styles.productName}>{item.name || "Producto"}</AppText>
              {item.tier_label ? (
                <View style={styles.tierBadge}>
                  <AppText style={styles.tierText}>{item.tier_label}</AppText>
                </View>
              ) : null}
              <AppText style={styles.mutedSm}>x{item.quantity}</AppText>
              {item.discount_applied ? (
                <AppText style={{ fontSize: 11, color: "#16a34a" }}>
                  Descuento {item.discount_source || ""}: -{item.discount_percent || 0}%
                </AppText>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {item.discount_applied && item.original_subtotal ? (
                <AppText style={styles.originalPrice}>{formatPrice(item.original_subtotal)}</AppText>
              ) : null}
              <AppText style={styles.productSubtotal}>{formatPrice(item.subtotal)}</AppText>
            </View>
          </View>
        )}

        ListEmptyComponent={
          <View style={styles.card}>
            <AppText style={{ color: colors.muted }}>Esta orden no tiene productos.</AppText>
          </View>
        }

        ListFooterComponent={
          <View style={{ gap: 10, marginBottom: spacing.lg }}>
            {/* Volver a pedir */}
            {!isCancelled && orderItems.length > 0 && (
              <Pressable
                onPress={handleReorder}
                disabled={addingAll}
                style={[styles.reorderBtn, addingAll && { opacity: 0.6 }]}
              >
                <Ionicons name="refresh-circle-outline" size={18} color="#fff" />
                <AppText style={styles.reorderText}>
                  {addingAll ? "Agregando..." : "Volver a pedir"}
                </AppText>
              </Pressable>
            )}

            {/* Cancelar orden — solo si está pendiente */}
            {order?.status === "pending" && (
              <Pressable
                onPress={handleCancel}
                disabled={cancelling}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 13,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: cancelling ? "#fca5a5" : "#ef4444",
                  backgroundColor: pressed ? "#fef2f2" : "#fff",
                  opacity: cancelling ? 0.6 : 1,
                })}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#ef4444" />
                  : <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                }
                <AppText style={{ fontSize: 14, fontWeight: "700", color: "#ef4444" }}>
                  {cancelling ? "Cancelando..." : "Cancelar orden"}
                </AppText>
              </Pressable>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 6, marginBottom: spacing.md,
  },
  backText: { fontSize: 14, fontWeight: "700", color: colors.text },

  card: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, backgroundColor: colors.surface,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16, fontWeight: "800",
    color: colors.text, marginBottom: 12,
  },

  rowBetween: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 4,
  },
  orderNumber: { fontSize: 20, fontWeight: "800", color: colors.text },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusText:  { fontSize: 12, fontWeight: "700" },

  refreshHint: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 10, backgroundColor: `${colors.primary}10`,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    alignSelf: "flex-start",
  },
  refreshText: { fontSize: 10, color: colors.primary, fontStyle: "italic" },

  cancelReason: {
    marginTop: 10, backgroundColor: "#fee2e2",
    borderRadius: 8, padding: 8,
  },
  cancelReasonText: { fontSize: 12, color: "#b91c1c" },

  // Transferencia: falta comprobante / en revisión
  receiptBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", marginTop: 10,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  receiptBadgeText: { fontSize: 12, fontWeight: "700" },

  // Timeline
  stepRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepIconCol: { width: 28, alignItems: "center" },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2,
  },
  stepLine:  { width: 2, height: 22, marginLeft: 13, marginVertical: 3 },
  stepLabel: { fontSize: 14 },
  stepTime:  { fontSize: 11, color: colors.muted, marginTop: 2 },

  // Tracking
  trackingRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 6,
  },
  trackingNumber: {
    fontSize: 17, fontWeight: "800",
    color: colors.text, letterSpacing: 1, flex: 1,
  },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: `${colors.primary}12`,
  },
  copyText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  mutedLine: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  mutedSm:   { color: colors.muted, fontSize: 13 },

  // Retiro en bodega
  pickupDateBox: {
    backgroundColor: "#F4F9EF",
    borderWidth: 1,
    borderColor: "#DDE7D7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pickupDateLabel: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  pickupDateValue: { fontSize: 15, fontWeight: "800", color: colors.primary },

  // Resumen
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 6,
  },
  summaryTotal: {
    borderTopWidth: 1, borderColor: colors.border,
    marginTop: 4, paddingTop: 10, marginBottom: 0,
  },
  totalLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
  totalValue: { fontSize: 15, fontWeight: "800", color: colors.text },

  // Productos
  productCard: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    padding: spacing.md, marginBottom: 10,
  },
  productName:    { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
  tierBadge:      { alignSelf: "flex-start", backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  tierText:       { fontSize: 10, fontWeight: "700", color: colors.surface },
  originalPrice:  { fontSize: 11, color: colors.muted, textDecorationLine: "line-through" },
  productSubtotal:{ fontSize: 15, fontWeight: "800", color: colors.text },

  // Volver a pedir
  reorderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 14, marginTop: 8,
  },
  reorderText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
