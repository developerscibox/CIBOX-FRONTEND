import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { colors, radius, spacing } from "../constants/theme";
import {
  getVendorDashboard,
  getVendorSalesSummary,
} from "../services/vendorService";
import useAuthStore from "../store/authStore";
import { useNavigation } from "@react-navigation/native";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "../components/AppText";

export default function VendorDashboardScreen() {
  const [dashboard, setDashboard] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const { user, logout, setAuth, token } = useAuthStore();
  const navigation = useNavigation();

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const [dashboardData, summaryData] = await Promise.all([
        getVendorDashboard(),
        getVendorSalesSummary(),
      ]);

      setDashboard(dashboardData);
      setSalesSummary(summaryData?.summary || null);
    } catch (error) {
      console.log(
        "GET VENDOR DASHBOARD ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudo cargar el dashboard del vendor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <ScreenContainer maxWidth={900}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!dashboard) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AppText>No se pudo cargar el dashboard</AppText>
        </View>
      </ScreenContainer>
    );
  }

  const vendor = dashboard.vendor || {};
  const stats = dashboard.stats || {};
  const topProducts = Array.isArray(dashboard.top_products)
    ? dashboard.top_products
    : [];
  const recentOrders = Array.isArray(dashboard.recent_orders)
    ? dashboard.recent_orders
    : [];

  return (
    <ScreenContainer maxWidth={900}>
      <FlatList
        data={topProducts}
        keyExtractor={(item, index) =>
          String(item.product_id || item._id || index)
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <>
            <AppText
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              Panel de vendedor
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                marginBottom: spacing.md,
              }}
            >
              Resumen de tu tienda, ventas y productos.
            </AppText>

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                {vendor.store_name || "Mi tienda"}
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                ID de vendedor: {vendor.id || "—"}
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                Aprobado: {vendor.approved ? "Sí" : "No"}
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                Activo: {vendor.is_active ? "Sí" : "No"}
              </AppText>

              <AppText style={{ color: colors.muted }}>
                Puntuación: {vendor.rating ?? 0}
              </AppText>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ ...cardStyle, width: "48%" }}>
                <AppText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.muted,
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Productos
                </AppText>

                <AppButton
                  title="Gestionar productos"
                  onPress={() => navigation.navigate("VendorProducts")}
                />

                <AppText
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                    marginTop: 12,
                  }}
                >
                  {stats.total_products ?? 0}
                </AppText>

                <AppText style={{ color: colors.muted, marginTop: 6 }}>
                  {stats.active_products ?? 0} activos ·{" "}
                  {stats.inactive_products ?? 0} inactivos
                </AppText>
              </View>

              <Pressable
                onPress={() => navigation.navigate("OrdersTab")}
                style={({ pressed }) => [
                  {
                    ...cardStyle,
                    width: "48%",
                  },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <AppText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.muted,
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Órdenes
                </AppText>

                <AppText
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  {stats.total_orders ?? 0}
                </AppText>

                <AppText style={{ color: colors.muted, marginTop: 6 }}>
                  {stats.total_units_sold ?? 0} unidades vendidas
                </AppText>

                <AppText
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  Ver todas →
                </AppText>
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ ...cardStyle, width: "48%" }}>
                <AppText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.muted,
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Ingresos
                </AppText>

                <AppText
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  ${stats.total_revenue ?? 0}
                </AppText>
              </View>

              <View style={{ ...cardStyle, width: "48%" }}>
                <AppText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.muted,
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Ticket promedio
                </AppText>

                <AppText
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  ${salesSummary?.average_ticket ?? 0}
                </AppText>
              </View>
            </View>

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Resumen de ventas
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                Órdenes: {salesSummary?.total_orders ?? 0}
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                Unidades vendidas: {salesSummary?.total_units_sold ?? 0}
              </AppText>

              <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                Ingresos: ${salesSummary?.total_revenue ?? 0}
              </AppText>

              <AppText style={{ color: colors.muted }}>
                Ticket promedio: ${salesSummary?.average_ticket ?? 0}
              </AppText>
            </View>

            <View style={cardStyle}>
              <AppText
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Órdenes recientes
              </AppText>

              {!recentOrders.length ? (
                <AppText style={{ color: colors.muted }}>
                  No hay órdenes recientes.
                </AppText>
              ) : (
                recentOrders.map((order, index) => {
                  const normalizedStatus = String(
                    order.status || "",
                  ).toLowerCase();

                  const statusMeta =
                    normalizedStatus === "pending"
                      ? {
                          label: "Pendiente",
                          bg: "#FEF3C7",
                          color: "#92400E",
                        }
                      : normalizedStatus === "paid"
                        ? {
                            label: "Pagada",
                            bg: "#DCFCE7",
                            color: "#166534",
                          }
                        : normalizedStatus === "preparing" ||
                            normalizedStatus === "processing"
                          ? {
                              label: "Preparando",
                              bg: "#DBEAFE",
                              color: "#1D4ED8",
                            }
                          : normalizedStatus === "ready"
                            ? {
                                label: "Lista para retiro",
                                bg: "#E0F2FE",
                                color: "#0369A1",
                              }
                            : normalizedStatus === "delivered"
                              ? {
                                  label: "Retirada",
                                  bg: "#DCFCE7",
                                  color: "#166534",
                                }
                              : normalizedStatus === "cancelled"
                                ? {
                                    label: "Cancelada",
                                    bg: "#FEE2E2",
                                    color: "#B91C1C",
                                  }
                                : {
                                    label: order.status || "Sin estado",
                                    bg: "#F3F4F6",
                                    color: "#374151",
                                  };

                  return (
                    <View
                      key={String(order.order_id || order._id || index)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                        padding: spacing.md,
                        marginBottom: 12,
                        backgroundColor: colors.background,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 10,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <AppText
                            style={{
                              fontWeight: "800",
                              color: colors.text,
                              fontSize: 16,
                              marginBottom: 4,
                            }}
                          >
                            Orden #
                            {String(order.order_id || order._id || "").slice(
                              -6,
                            )}
                          </AppText>

                          <AppText
                            style={{
                              color: colors.muted,
                              fontSize: 13,
                            }}
                          >
                            {order.items_count ?? order.items?.length ?? 0}{" "}
                            ítem(s) · ${order.vendor_total ?? order.total ?? 0}
                          </AppText>
                        </View>

                        <View
                          style={{
                            backgroundColor: statusMeta.bg,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                          }}
                        >
                          <AppText
                            style={{
                              color: statusMeta.color,
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            {statusMeta.label}
                          </AppText>
                        </View>
                      </View>

                      <View
                        style={{
                          alignItems: "flex-end",
                        }}
                      >
                        <AppText
                          onPress={() =>
                            navigation.navigate("OrderDetail", {
                              orderId: order.order_id || order._id,
                            })
                          }
                          style={{
                            color: colors.text,
                            fontWeight: "700",
                            fontSize: 14,
                          }}
                        >
                          Ver detalle →
                        </AppText>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View
              style={{
                ...cardStyle,
                marginBottom: spacing.md,
              }}
            >
              <AppText
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                Top productos
              </AppText>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={cardStyle}>
            <AppText
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 6,
              }}
            >
              {item.name}
            </AppText>

            <AppText style={{ color: colors.muted, marginBottom: 4 }}>
              Unidades vendidas: {item.total_quantity ?? 0}
            </AppText>

            <AppText style={{ color: colors.muted }}>
              Ingresos: ${item.total_revenue ?? 0}
            </AppText>
          </View>
        )}
      />
    </ScreenContainer>
  );
}
