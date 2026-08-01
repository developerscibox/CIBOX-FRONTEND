import client from "../api/client";

const unwrap = (response) => response.data?.data ?? response.data;

export const getVendorDashboard = async () => {
  const [statsRes, ordersRes, topRes] = await Promise.all([
    client.get("/vendor/dashboard/stats"),
    client.get("/vendor/dashboard/orders", { params: { limit: 5 } }),
    client.get("/vendor/dashboard/top-products", { params: { limit: 10 } }),
  ]);

  const statsData = unwrap(statsRes);
  const ordersData = unwrap(ordersRes);
  const topData = unwrap(topRes);

  return {
    vendor: statsData?.vendor || {},
    stats: {
      ...(statsData?.sales || {}),
      ...(statsData?.products || {}),
    },
    recent_orders: ordersData?.items || [],
    top_products: Array.isArray(topData) ? topData : [],
  };
};

export const getVendorSalesSummary = async (params = {}) => {
  const response = await client.get("/vendor/dashboard/revenue", { params });
  const data = unwrap(response);

  return {
    summary: {
      total_revenue: data?.totals?.revenue || 0,
      total_units_sold: data?.totals?.units || 0,
      total_orders: 0,
      average_ticket: 0,
    },
    series: data?.series || [],
  };
};