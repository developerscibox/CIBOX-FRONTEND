// Datos de demostración para correr el panel sin backend conectado.
// Reemplazados automáticamente por las llamadas reales cuando se configura VITE_API_URL.

export const LOW_STOCK = [
  { _id: "p2",  name: "Arroz Grado 2 — saco 25 kg",   stock: 4,  threshold: 10, barcode: "7801234500021", location: { code: "A-03-2" } },
  { _id: "p8",  name: "Papel higiénico — fardo 48r",  stock: 6,  threshold: 12, barcode: "7801234500088", location: { code: "C-01-4" } },
  { _id: "p5",  name: "Bebida cola 1.5L — pack 6",    stock: 9,  threshold: 15, barcode: "7801234500055", location: { code: "B-02-1" } },
  { _id: "p10", name: "Cloro 5L — bidón",             stock: 3,  threshold: 10, barcode: "7801234500102", location: { code: "C-04-3" } },
];

export const MOVEMENTS = [
  { _id: "m1", type: "venta",     product_name: "Arroz Grado 2 — saco 25 kg",  quantity: -6, stock_after: 4,  reason: null,                  by: { label: "Webpay" },           created_at: "2026-06-12T14:05:00Z" },
  { _id: "m2", type: "ajuste",    product_name: "Cloro 5L — bidón",            quantity: -2, stock_after: 3,  reason: "Merma por rotura",     by: { label: "Claudia V. (admin)" }, created_at: "2026-06-12T13:40:00Z" },
  { _id: "m3", type: "recepcion", product_name: "Papel higiénico — fardo 48r", quantity: 20, stock_after: 6,  reason: "Recepción proveedor",  by: { label: "Bodega" },           created_at: "2026-06-12T11:10:00Z" },
  { _id: "m4", type: "anulacion", product_name: "Aceite vegetal 1L — caja 12", quantity: 3,  stock_after: 41, reason: "Cancelación pedido",   by: { label: "sistema:expiracion" }, created_at: "2026-06-12T10:02:00Z" },
  { _id: "m5", type: "venta",     product_name: "Bebida cola 1.5L — pack 6",   quantity: -4, stock_after: 9,  reason: null,                  by: { label: "Webpay" },           created_at: "2026-06-12T09:25:00Z" },
];

export const ORDERS_TO_PREPARE = [
  {
    _id: "o1", number: "B12-10432", status: "preparing", customer: "Minimarket Don Pedro", total: 53970, created_at: "2026-06-12T12:02:00Z",
    items: [
      { product_id: "p2", name: "Arroz Grado 2 — saco 25 kg",  qty: 1, barcode: "7801234500021", location: { code: "A-03-2" }, picked: false },
      { product_id: "p1", name: "Aceite vegetal 1L — caja 12", qty: 1, barcode: "7801234500011", location: { code: "A-01-1" }, picked: false },
      { product_id: "p8", name: "Papel higiénico — fardo 48r", qty: 1, barcode: "7801234500088", location: { code: "C-01-4" }, picked: false },
    ],
  },
  {
    _id: "o2", number: "B12-10433", status: "preparing", customer: "Almacén La Esquina", total: 31940, created_at: "2026-06-12T12:18:00Z",
    items: [
      { product_id: "p5", name: "Bebida cola 1.5L — pack 6", qty: 3, barcode: "7801234500055", location: { code: "B-02-1" }, picked: false },
      { product_id: "p11", name: "Galletas surtidas — display 24", qty: 2, barcode: "7801234500111", location: { code: "D-01-2" }, picked: false },
    ],
  },
  {
    _id: "o3", number: "B12-10435", status: "ready", customer: "Cliente final — despacho", total: 18990, created_at: "2026-06-12T11:50:00Z",
    items: [
      { product_id: "p4", name: "Harina sin polvos — saco 25 kg", qty: 1, barcode: "7801234500044", location: { code: "A-05-1" }, picked: true },
    ],
  },
];

// Pedidos con retiro en tienda — shape del contrato nuevo de /orders/admin.
const HOY = "2026-06-12";
const MANANA = "2026-06-13";

export const ORDERS_ADMIN = [
  {
    _id: "664f1a2b3c4d5e6f10432a",
    status: "preparing",
    delivery_method: "pickup",
    pickup: { committed_date: HOY, location: "Bodega 12 Lo Espejo", picked_up_at: null },
    customer: { fullName: "Pedro Soto — Minimarket Don Pedro", email: "donpedro@gmail.com", phone: "+56 9 8765 4321" },
    payment: { method: "webpay" },
    total: 53970,
    created_at: "2026-06-11T18:02:00Z",
    items: [
      { product_id: "p2", name: "Arroz Grado 2 — saco 25 kg", qty: 1, price: 18990 },
      { product_id: "p1", name: "Aceite vegetal 1L — caja 12", qty: 1, price: 21990 },
      { product_id: "p8", name: "Papel higiénico — fardo 48r", qty: 1, price: 12990 },
    ],
    status_history: [
      { status: "pending", changed_at: "2026-06-11T18:02:00Z", note: "Pedido creado", changed_by: { role: "system", label: "Tienda online" } },
      { status: "paid", changed_at: "2026-06-11T18:04:00Z", note: "Pago Webpay aprobado", changed_by: { role: "system", label: "Webpay" } },
      { status: "preparing", changed_at: "2026-06-12T09:10:00Z", note: null, changed_by: { role: "admin", label: "Claudia V." } },
    ],
  },
  {
    _id: "664f1a2b3c4d5e6f10433b",
    status: "ready",
    delivery_method: "pickup",
    pickup: { committed_date: HOY, location: "Bodega 12 Lo Espejo", picked_up_at: null },
    customer: { fullName: "Marcela Ríos — Almacén La Esquina", email: "laesquina@gmail.com", phone: "+56 9 5555 1212" },
    payment: { method: "transfer" },
    total: 31940,
    created_at: "2026-06-11T15:30:00Z",
    items: [
      { product_id: "p5", name: "Bebida cola 1.5L — pack 6", qty: 3, price: 7990 },
      { product_id: "p11", name: "Galletas surtidas — display 24", qty: 2, price: 3985 },
    ],
    status_history: [
      { status: "pending", changed_at: "2026-06-11T15:30:00Z", note: "Pedido creado", changed_by: { role: "system", label: "Tienda online" } },
      { status: "paid", changed_at: "2026-06-11T17:12:00Z", note: "Transferencia verificada", changed_by: { role: "admin", label: "Claudia V." } },
      { status: "preparing", changed_at: "2026-06-12T08:40:00Z", note: null, changed_by: { role: "bodega", label: "Equipo bodega" } },
      { status: "ready", changed_at: "2026-06-12T10:05:00Z", note: "Lista en zona de retiro", changed_by: { role: "bodega", label: "Equipo bodega" } },
    ],
  },
  {
    _id: "664f1a2b3c4d5e6f10434c",
    status: "pending",
    delivery_method: "pickup",
    pickup: { committed_date: MANANA, location: "Bodega 12 Lo Espejo", picked_up_at: null },
    customer: { fullName: "Jorge Fuentes", email: "jfuentes@correo.cl", phone: "+56 9 4444 9090" },
    payment: { method: "cash_on_pickup" },
    total: 18990,
    created_at: "2026-06-12T11:50:00Z",
    items: [{ product_id: "p4", name: "Harina sin polvos — saco 25 kg", qty: 1, price: 18990 }],
    status_history: [
      { status: "pending", changed_at: "2026-06-12T11:50:00Z", note: "Pedido creado — paga al retirar", changed_by: { role: "system", label: "Tienda online" } },
    ],
  },
  {
    _id: "664f1a2b3c4d5e6f10430d",
    status: "paid",
    delivery_method: "pickup",
    pickup: { committed_date: "2026-06-10", location: "Bodega 12 Lo Espejo", picked_up_at: null },
    customer: { fullName: "Rosa Carvajal — Bazar Rosita", email: "bazarrosita@gmail.com", phone: "+56 9 3333 7878" },
    payment: { method: "transfer" },
    total: 64980,
    created_at: "2026-06-09T10:15:00Z",
    items: [
      { product_id: "p10", name: "Cloro 5L — bidón", qty: 4, price: 4990 },
      { product_id: "p2", name: "Arroz Grado 2 — saco 25 kg", qty: 2, price: 18990 },
      { product_id: "p11", name: "Galletas surtidas — display 24", qty: 1, price: 7040 },
    ],
    status_history: [
      { status: "pending", changed_at: "2026-06-09T10:15:00Z", note: "Pedido creado", changed_by: { role: "system", label: "Tienda online" } },
      { status: "paid", changed_at: "2026-06-09T13:20:00Z", note: "Transferencia verificada", changed_by: { role: "admin", label: "Claudia V." } },
    ],
  },
];

export const PICKUP_SUMMARY = {
  date: HOY,
  total_committed: 2,
  by_status: { pending: 0, paid: 0, preparing: 1, ready: 1, delivered: 0, cancelled: 0 },
  upcoming: [
    { date: HOY, count: 2 },
    { date: MANANA, count: 1 },
    { date: "2026-06-15", count: 3 },
    { date: "2026-06-17", count: 1 },
  ],
  orders: ORDERS_ADMIN.filter((o) => o.pickup?.committed_date === HOY).map((o) => ({
    _id: o._id,
    customer: o.customer,
    total: o.total,
    status: o.status,
    created_at: o.created_at,
    committed_date: o.pickup.committed_date,
  })),
};

// Versiones envueltas en el mismo shape que devuelve el backend ({items}, {orders}…),
// para que el modo demo y el modo conectado consuman datos idénticos.
export const LOW_STOCK_RES = { items: LOW_STOCK, count: LOW_STOCK.length };
export const MOVEMENTS_RES = { items: MOVEMENTS, pagination: { page: 1, pages: 1, total: MOVEMENTS.length, limit: 50 } };
export const ORDERS_RES = { orders: ORDERS_TO_PREPARE, pagination: { page: 1, pages: 1, total: ORDERS_TO_PREPARE.length, limit: 50 } };
export const ORDERS_ADMIN_RES = { orders: ORDERS_ADMIN, pagination: { page: 1, pages: 1, total: ORDERS_ADMIN.length, limit: 50 } };
export const PICKUP_SUMMARY_RES = PICKUP_SUMMARY;

// ── Capa de reportes (adminController) — para el dashboard de negocio (Ventas.jsx) ──
export const ADMIN_DASHBOARD_RES = {
  total_sales: 4856200,
  paid_orders: 318,
  active_users: 142,
  active_products: 96,
  total_vendors: 12,
  pending_vendors: 2,
};

export const SALES_SUMMARY_RES = {
  totals: { total_orders: 47, total_sales: 1284900, average_ticket: 27338 },
  series: [
    { period: "2026-06-07", total_orders: 5, total_sales: 128900, average_ticket: 25780 },
    { period: "2026-06-08", total_orders: 8, total_sales: 214300, average_ticket: 26788 },
    { period: "2026-06-09", total_orders: 6, total_sales: 162400, average_ticket: 27067 },
    { period: "2026-06-10", total_orders: 9, total_sales: 251700, average_ticket: 27967 },
    { period: "2026-06-11", total_orders: 7, total_sales: 198600, average_ticket: 28371 },
    { period: "2026-06-12", total_orders: 6, total_sales: 173400, average_ticket: 28900 },
    { period: "2026-06-13", total_orders: 6, total_sales: 155600, average_ticket: 25933 },
  ],
};

export const TOP_PRODUCTS_RES = [
  { _id: "p2",  name: "Arroz Grado 2 — saco 25 kg",       total_quantity: 38, total_revenue: 721620 },
  { _id: "p1",  name: "Aceite vegetal 1L — caja 12",      total_quantity: 31, total_revenue: 681690 },
  { _id: "p8",  name: "Papel higiénico — fardo 48r",      total_quantity: 27, total_revenue: 350730 },
  { _id: "p5",  name: "Bebida cola 1.5L — pack 6",        total_quantity: 24, total_revenue: 191760 },
  { _id: "p11", name: "Galletas surtidas — display 24",   total_quantity: 19, total_revenue: 133760 },
  { _id: "p10", name: "Cloro 5L — bidón",                 total_quantity: 16, total_revenue: 79840 },
];
