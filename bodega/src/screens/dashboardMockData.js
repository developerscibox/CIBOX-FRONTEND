// ============================================================
// dashboardMockData.js — Dashboard Gerencial 360° · Bodega 12
// Valores idénticos a la maqueta (20 de mayo 2025).
// Fase 2: reemplazar por fetch a /api/dashboard/* manteniendo
// estas mismas estructuras (ver contrato de endpoints en el prompt).
// ============================================================

export const BRAND = {
  primary: "#E0127A",
  primaryDark: "#B00F63",
  violet: "#8B5CF6",
};

// Helpers de formato chileno (para cuando lleguen datos numéricos reales)
export const fmtCLP = (n) => "$ " + Math.round(n).toLocaleString("es-CL");
export const fmtDec = (n, d = 1) =>
  n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });

export const HEADER = {
  titulo: "Dashboard Gerencial 360°",
  subtitulo: "Resumen ejecutivo de la operación",
  fecha: "Hoy, 20 de mayo 2025",
  notificaciones: 8,
  usuario: { nombre: "Carlos Muñoz", cargo: "Gerente General", iniciales: "CM" },
  ultimaActualizacion: "Última actualización: 20/05/2025 10:30 AM",
  nota: "Todos los valores incluyen IVA",
  version: "Versión 1.0.0",
};

// ---------- Fila de 6 KPIs superiores ----------
export const KPIS = [
  { label: "VENTAS DEL DÍA", valor: "$ 18.750.000", delta: "12,5%", arrow: "up", tone: "good", sub: "vs ayer", icono: "dollar", color: "#E0127A", meta: { pct: 94, valor: "$ 20.000.000" }, spark: [12, 14, 11, 15, 13, 16, 13.5, 17, 15, 18, 16, 19] },
  { label: "MARGEN BRUTO", valor: "28,6%", delta: "2,3%", arrow: "up", tone: "good", sub: "vs ayer", icono: "tag", color: "#E0127A", spark: [26, 27, 25.5, 27.2, 26.4, 28, 27.1, 26.6, 28.2, 27.4, 29, 28.6] },
  { label: "PEDIDOS INGRESADOS", valor: "256", delta: "15,8%", arrow: "up", tone: "good", sub: "vs ayer", icono: "clipboard", color: "#8B5CF6", spark: [180, 205, 190, 222, 208, 232, 215, 242, 226, 250, 238, 256] },
  { label: "PEDIDOS EN PREPARACIÓN", valor: "78", delta: null, sub: "En picking ahora", icono: "package", color: "#E0127A", spark: [60, 71, 64, 76, 68, 80, 71, 83, 74, 85, 79, 78] },
  { label: "PEDIDOS LISTOS", valor: "32", delta: null, sub: "Listos para retiro", icono: "check", color: "#E0127A", spark: [20, 27, 22, 30, 24, 33, 26, 34, 29, 36, 30, 32] },
  { label: "PEDIDOS ENTREGADOS", valor: "186", delta: "18,3%", arrow: "up", tone: "good", sub: "vs ayer", icono: "truck", color: "#E0127A", spark: [120, 141, 129, 152, 140, 161, 149, 170, 158, 178, 167, 186] },
];

// ---------- Barra de alertas críticas ----------
export const ALERTAS = [
  { valor: "23", texto: "Productos en stock crítico", icono: "tag" },
  { valor: "8", texto: "Productos sin stock", icono: "packagex" },
  { valor: "12", texto: "Pedidos atrasados en preparación", icono: "clock" },
  { valor: "3", texto: "Proveedores con retraso", icono: "truck" },
  { valor: "15", texto: "Productos próximos a vencer", icono: "calendar" },
  { valor: "$ 1.250.000", texto: "Merma del mes (mayo)", icono: "merma" },
];

// ---------- Ventas (este mes) ----------
const serieMayo = [12.5, 9.8, 14.2, 11.5, 15.8, 13.2, 10.5, 16.4, 14.8, 18.2, 12.9, 17.5, 15.2, 19.8, 16.5, 13.8, 20.5, 17.2, 21.8, 18.5, 15.2, 22.4, 19.8, 24.5, 20.2, 17.5, 25.8, 22.2, 26.5, 23.8, 29.4];

export const VENTAS = {
  total: "$ 562.450.000",
  delta: "14,6%",
  deltaSub: "vs mes anterior",
  serie: serieMayo.map((m, i) => ({ dia: `${i + 1} May`, monto: m * 1e6 })),
  ticks: ["1 May", "6 May", "11 May", "16 May", "20 May", "31 May"],
  topProductos: [
    { nombre: "Bebida Cola 350ml", monto: "$ 45.200.000" },
    { nombre: "Leche Entera 1L", monto: "$ 32.400.000" },
    { nombre: "Galleta Soda 6un", monto: "$ 28.750.000" },
    { nombre: "Arroz 1kg", monto: "$ 24.300.000" },
    { nombre: "Detergente 1kg", monto: "$ 22.800.000" },
  ],
};

// ---------- Inventario (stock valorizado) ----------
export const INVENTARIO = {
  stockTotal: "$ 1.245.700.000",
  delta: "6,8%",
  deltaSub: "vs mes anterior",
  categorias: [
    { nombre: "Abarrotes", pct: 38, monto: "$ 472.566.000", color: "#E0127A" },
    { nombre: "Lácteos", pct: 18, monto: "$ 223.123.000", color: "#F472B6" },
    { nombre: "Bebidas", pct: 15, monto: "$ 186.987.000", color: "#A855F7" },
    { nombre: "Congelados", pct: 12, monto: "$ 149.629.000", color: "#C084FC" },
    { nombre: "Snacks y Galletas", pct: 9, monto: "$ 109.598.000", color: "#F9A8D4" },
    { nombre: "Aseo", pct: 8, monto: "$ 103.797.000", color: "#E9D5FF" },
  ],
  tiles: [
    { label: "Stock crítico", valor: "23", sub: "productos", tone: "pink" },
    { label: "Sin stock", valor: "8", sub: "productos", tone: "pink" },
    { label: "Días de cobertura promedio", valor: "15", sub: "días", tone: "violet" },
    { label: "Rotación inventario (mes)", valor: "2,8x", sub: "", tone: "violet" },
  ],
};

// ---------- Abastecimiento (últimos 30 días) ----------
export const ABASTECIMIENTO = {
  comprasTotales: "$ 385.650.000",
  delta: "9,4%",
  deltaSub: "vs 30 días anteriores",
  segmentos: [
    { nombre: "Abarrotes", pct: 35 },
    { nombre: "Lácteos", pct: 20 },
    { nombre: "Bebidas", pct: 17 },
    { nombre: "Congelados", pct: 12 },
    { nombre: "Snacks y Galletas", pct: 9 },
    { nombre: "Aseo", pct: 7 },
  ],
  topProveedores: [
    { nombre: "Distribuciones del Sur", monto: "$ 98.450.000" },
    { nombre: "Alimentos y Más", monto: "$ 76.800.000" },
    { nombre: "Lácteos Andinos", monto: "$ 58.750.000" },
    { nombre: "Bebidas Premium", monto: "$ 47.300.000" },
    { nombre: "Grupo Hogar", monto: "$ 38.900.000" },
  ],
  cumplimiento: [
    { nombre: "Cumplido", pct: 72, color: "#D8127D" },
    { nombre: "Parcial", pct: 18, color: "#F5A9CE" },
    { nombre: "Atrasado", pct: 10, color: "#8B5CF6" },
  ],
};

// ---------- Logística operativa ----------
export const LOGISTICA = {
  leyenda:
    "Ingresados y Entregados: acumulado del día · etapas intermedias: pedidos en esa etapa ahora (incluye ingresos de días previos).",
  pipeline: [
    { etapa: "Ingresados", n: 256, color: "#E0127A", icono: "send" },
    { etapa: "Asignados", n: 198, color: "#EC4899", icono: "package" },
    { etapa: "En Picking", n: 78, color: "#A855F7", icono: "cart" },
    { etapa: "En Packing", n: 45, color: "#8B5CF6", icono: "packing" },
    { etapa: "Listos", n: 32, color: "#EC4899", icono: "check" },
    { etapa: "Entregados", n: 186, color: "#E0127A", icono: "truck" },
  ],
  metricas: [
    { label: "Tiempo prom. picking", valor: "24 min", delta: "-5 min vs ayer", arrow: "down", tone: "good" },
    { label: "Tiempo prom. packing", valor: "15 min", delta: "-3 min vs ayer", arrow: "down", tone: "good" },
    { label: "Tiempo total prom.", valor: "39 min", delta: "-6 min vs ayer", arrow: "down", tone: "good" },
    { label: "Pedidos atrasados", valor: "12", delta: "+3 vs ayer", arrow: "up", tone: "bad" },
    { label: "Nivel de servicio (SLA)", valor: "92,5%", delta: "+4,2% vs ayer", arrow: "up", tone: "good" },
  ],
};

// ---------- Productividad del equipo (hoy) ----------
// Nota: la maqueta solo muestra Pickers; Packers y Cajeras son
// datos placeholder para que los tabs funcionen en la demo.
export const PRODUCTIVIDAD = {
  pickers: {
    label: "Pickers",
    filas: [
      { nombre: "Juan Pérez", pedidos: 28, productos: 156, tiempo: "21 min", prod: 7.4 },
      { nombre: "María González", pedidos: 25, productos: 142, tiempo: "24 min", prod: 6.2 },
      { nombre: "Luis Martínez", pedidos: 22, productos: 118, tiempo: "25 min", prod: 5.3 },
      { nombre: "Ana Torres", pedidos: 18, productos: 95, tiempo: "26 min", prod: 4.3 },
      { nombre: "Pedro Silva", pedidos: 15, productos: 80, tiempo: "28 min", prod: 3.6 },
    ],
  },
  packers: {
    label: "Packers",
    filas: [
      { nombre: "Diego Rojas", pedidos: 30, productos: 168, tiempo: "13 min", prod: 8.1 },
      { nombre: "Camila Soto", pedidos: 27, productos: 149, tiempo: "15 min", prod: 7.2 },
      { nombre: "Felipe Muñoz", pedidos: 23, productos: 121, tiempo: "16 min", prod: 6.0 },
      { nombre: "Valentina Díaz", pedidos: 19, productos: 102, tiempo: "18 min", prod: 4.9 },
    ],
  },
  cajeras: {
    label: "Cajeras",
    filas: [
      { nombre: "Carla Fuentes", pedidos: 41, productos: 230, tiempo: "6 min", prod: 9.8 },
      { nombre: "Javiera Pino", pedidos: 36, productos: 199, tiempo: "7 min", prod: 8.6 },
      { nombre: "Marcela Vega", pedidos: 31, productos: 164, tiempo: "8 min", prod: 7.4 },
    ],
  },
};

// ---------- Rentabilidad (este mes) ----------
export const RENTABILIDAD = {
  stats: [
    { label: "Margen bruto", valor: "$ 160.745.000", sub: "28,6%", subTone: "good" },
    { label: "Merma del mes", valor: "$ 1.250.000", sub: "0,22% de ventas", subTone: "bad", labelTone: "bad" },
    { label: "Capital inmovilizado", valor: "$ 1.245.700.000", sub: "Stock valorizado", subTone: "muted", labelTone: "bad" },
    { label: "Ticket promedio", valor: "$ 76.250", sub: "+6,3% vs mes anterior", subTone: "good" },
  ],
  margenSegmento: [
    { nombre: "Bebidas", pct: 32.1 },
    { nombre: "Snacks/Galletas", pct: 30.8 },
    { nombre: "Aseo", pct: 28.4 },
    { nombre: "Abarrotes", pct: 27.6 },
    { nombre: "Lácteos", pct: 25.3 },
    { nombre: "Congelados", pct: 22.1 },
  ],
  margenProducto: [
    { nombre: "Bebida Cola 350ml", pct: "36,2%" },
    { nombre: "Galleta Soda 6un", pct: "33,8%" },
    { nombre: "Detergente 1kg", pct: "32,1%" },
    { nombre: "Leche Entera 1L", pct: "29,7%" },
    { nombre: "Papel Higiénico 4un", pct: "28,9%" },
  ],
};
