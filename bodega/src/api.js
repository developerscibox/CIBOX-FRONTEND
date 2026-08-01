import { useEffect, useState } from "react";

// Cliente del backend Bodega 12. Sin VITE_API_URL, el panel corre en modo
// demostración con los datos de src/data.js (mismas formas que el backend real).
const BASE = import.meta.env.VITE_API_URL || "";

export const usingMock = !BASE;

// URL del stream SSE del relay (en vivo). null en modo demo (sin backend).
export const streamUrl = () => (BASE ? `${BASE}/orders/stream` : null);

// ── Sesión por usuario (reemplaza el VITE_API_TOKEN admin compartido) ─────────
const TOKEN_KEY = "b12_wms_token";
const USER_KEY = "b12_wms_user";
const REFRESH_KEY = "b12_wms_refresh";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};
const getRefresh = () => {
  try { return localStorage.getItem(REFRESH_KEY) || ""; } catch { return ""; }
};
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
};
// Cada argumento se actualiza solo si NO es undefined (así el refresh puede
// renovar el access token sin pisar el usuario).
export const setSession = (token, user, refresh) => {
  try {
    if (token !== undefined) token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
    if (user !== undefined) user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY);
    if (refresh !== undefined) refresh ? localStorage.setItem(REFRESH_KEY, refresh) : localStorage.removeItem(REFRESH_KEY);
  } catch { /* almacenamiento no disponible */ }
};
export const clearSession = () => setSession(null, null, null);

// ── Puente Reposición → Recepción (borrador one-shot en sessionStorage) ────────
// La pantalla de Reposición escribe el borrador; Recepción lo lee y lo borra al
// montar (siembra sus filas). Forma: [{ product_id, barcode, name, box_qty, cajas }].
const RECEPCION_DRAFT_KEY = "b12_recepcion_draft";
export const setRecepcionDraft = (items) => {
  try { sessionStorage.setItem(RECEPCION_DRAFT_KEY, JSON.stringify(items || [])); } catch { /* almacenamiento no disponible */ }
};
export const takeRecepcionDraft = () => {
  try {
    const raw = sessionStorage.getItem(RECEPCION_DRAFT_KEY);
    sessionStorage.removeItem(RECEPCION_DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

// Renueva el access token con el refresh token (rotación). Dedupe: varias
// llamadas que reciben 401 a la vez comparten un solo refresh en vuelo.
let refreshing = null;
const tryRefresh = () => {
  const rt = getRefresh();
  if (!rt) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const json = await res.json().catch(() => ({}));
        const d = json?.data ?? json;
        if (d?.accessToken) { setSession(d.accessToken, undefined, d.refreshToken); return true; }
        return false;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

async function req(path, { method = "GET", body, auth = true, _retry = false } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));

  // 401 en llamada autenticada → intentar refrescar el token UNA vez y reintentar;
  // si el refresh falla, recién ahí cerrar sesión (antes se caía a la 1ª hora).
  if (res.status === 401 && auth) {
    if (!_retry && (await tryRefresh())) {
      return req(path, { method, body, auth, _retry: true });
    }
    clearSession();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("b12-unauth"));
  }
  if (!res.ok) {
    // Propagar el HTTP status y el code del backend para ramificar por código
    // (ej. 409 de claim) en vez de hacer string-matching frágil sobre el mensaje.
    const err = new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = json?.code || null;
    throw err;
  }
  // El backend envuelve todo en { success, data }
  return json?.data ?? json;
}

// Variante de req() para multipart/form-data (subida de archivos): NO se fija
// Content-Type a mano — el browser pone el boundary correcto. Mismo manejo de
// Bearer + refresh en 401 que req().
async function reqForm(path, formData, { _retry = false } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (!_retry && (await tryRefresh())) {
      return reqForm(path, formData, { _retry: true });
    }
    clearSession();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("b12-unauth"));
  }
  if (!res.ok) {
    const err = new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = json?.code || null;
    throw err;
  }
  return json?.data ?? json;
}

// ── Autenticación ────────────────────────────────────────────────────────────
export const authApi = {
  // POST /auth/login → { user, accessToken, refreshToken }
  login: async (email, password) => {
    const data = await req("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setSession(data.accessToken, data.user, data.refreshToken);
    return data.user;
  },
  logout: () => clearSession(),
};

// Endpoints reales (ver backend src/routes/inventoryRoutes.js y orderRoutes.js)
export const api = {
  // GET /inventory/low-stock?threshold=&limit=  → { items, count }
  lowStock: (threshold = 10, limit) =>
    req(`/inventory/low-stock?threshold=${threshold}${limit != null ? `&limit=${limit}` : ""}`),
  // GET /inventory/expiring-soon?days=  → { items:[{_id,name,stock,expiry_date,days_left}], count }
  expiringSoon: (days = 30) => req(`/inventory/expiring-soon?days=${days}`),
  // GET /inventory/reorder  → { count, items:[{_id,name,sku,barcode,stock,min_stock,target_stock,
  //   suggested_qty,box_qty,suggested_boxes,urgency,vendor:{id,name},location}] }
  // Lista de reposición: productos bajo su mínimo, ordenados por urgencia.
  reorderList: () => req(`/inventory/reorder`),
  // GET /inventory/movements  → { items, pagination }
  movements: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/inventory/movements${qs ? `?${qs}` : ""}`);
  },
  // POST /inventory/adjust  { product_id, delta, reason }  → { product_id, name, stock }
  adjust: ({ product_id, delta, reason }) =>
    req(`/inventory/adjust`, { method: "POST", body: { product_id, delta, reason } }),
  // GET /inventory/by-barcode/:code  → product { _id, name, barcode, stock, location, box_qty, ... }
  // box_qty = unidades por caja (para traducir cajas→unidades en la recepción).
  byBarcode: (code) => req(`/inventory/by-barcode/${encodeURIComponent(code)}`),
  // GET /inventory/stock-summary?threshold=  → { totals, by_category, top_products }
  stockSummary: (threshold = 10) => req(`/inventory/stock-summary?threshold=${threshold}`),
  // GET /orders/admin?status=preparing  → { orders, pagination }
  ordersToPrepare: (status = "preparing") => req(`/orders/admin?status=${status}&limit=50`),
  // Pendientes de preparar = paid (recién vendidos, por TOMAR) + preparing (en proceso).
  // Dos consultas en paralelo; tolerante a fallo parcial.
  // FIFO (pedido del CEO): la cola queda de la MÁS ANTIGUA a la más nueva
  // (created_at ascendente). Este es el ÚNICO criterio de orden — Picking.jsx
  // consume la lista tal cual, sin re-ordenar.
  pendingToPrepare: async () => {
    const [paid, prep] = await Promise.all([
      req(`/orders/admin?status=paid&limit=50`).catch(() => ({ orders: [] })),
      req(`/orders/admin?status=preparing&limit=50`).catch(() => ({ orders: [] })),
    ]);
    // Dedup por _id: si un pedido transiciona paid→preparing entre ambas queries
    // podría salir en las dos. Preferimos el estado más avanzado (preparing).
    const map = new Map();
    for (const o of [...(paid.orders || []), ...(prep.orders || [])]) {
      const id = String(o._id);
      if (!map.has(id) || o.status === "preparing") map.set(id, o);
    }
    const orders = [...map.values()].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    );
    return { orders };
  },
  // GET /orders/board (PÚBLICO, sin login) → { paid, preparing, ready } para la pantalla de clientes
  board: () => req(`/orders/board`, { auth: false }),
  // GET /orders/zone-board?sector=X (PÚBLICO) → { sector, pedidos:[{folio,status,created_at,
  //   tomado_por,zona_lista,items:[{name,cantidad,cajas}]}] } para el monitor de zona (sin PII)
  zoneBoard: (sector) => req(`/orders/zone-board?sector=${encodeURIComponent(sector)}`, { auth: false }),
  // POST /orders/zone/:id/lista (PÚBLICO) { sector } → marca la zona lista (idempotente).
  // :id acepta el _id completo o el folio corto de 6 hex. → { ok, sector, zona_lista }
  zonaLista: (id, sector) =>
    req(`/orders/zone/${encodeURIComponent(id)}/lista`, { method: "POST", body: { sector }, auth: false }),
  // GET /orders/admin?status=&delivery_method=&committed_date=&from=&to=&search=&page=&limit=
  orders: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/orders/admin${qs ? `?${qs}` : ""}`);
  },
  // GET /orders/admin/pickup-summary?date=YYYY-MM-DD
  pickupSummary: (date) => req(`/orders/admin/pickup-summary${date ? `?date=${date}` : ""}`),
  // GET /orders/admin/pickup-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD → { days:[{date,count}] }
  pickupCalendar: (from, to) => req(`/orders/admin/pickup-calendar?from=${from}&to=${to}`),
  // PATCH /orders/admin/:id/status  { status, note? }
  setOrderStatus: (id, status, note) =>
    req(`/orders/admin/${id}/status`, { method: "PATCH", body: note ? { status, note } : { status } }),
  // DELETE /orders/admin/:id  → elimina el pedido (libera stock si no es terminal)
  deleteOrder: (id) => req(`/orders/admin/${id}`, { method: "DELETE" }),
  // POST /orders/admin/manual  { items:[{product_id,cajas}], customer:{fullName,rut?}, payment_method, status, notes?, discountAmount? }
  // → order (venta presencial: descuenta stock + escribe kardex en una transacción)
  createManualOrder: (payload) =>
    req(`/orders/admin/manual`, { method: "POST", body: payload }),

  // ── Relay de sala (relayOrderController) ─────────────────────────────────────
  // POST /orders/admin/take  { items:[{product_id,cajas}], customer?:{name}, turno_id? }
  // → order en POR_PAGAR (pending) con codigo_escaneo + sector por ítem. Gate orders.take (vendedor).
  takeOrder: (payload) =>
    req(`/orders/admin/take`, { method: "POST", body: payload }),
  // GET /orders/admin/by-scan/:codigo → order. La cajera escanea la boleta. Gate orders.pay.
  findByScan: (codigo) =>
    req(`/orders/admin/by-scan/${encodeURIComponent(codigo)}`),
  // Perfil del vendedor (gate orders.take): SUS métricas e historial.
  // mis-metricas → { hoy, semana, mes:{ventas,pedidos,unidades,clientes}, incentivos:{puntos,meta,progresoPct,faltaParaMeta} }
  misMetricas: () => req(`/orders/admin/mis-metricas`),
  // mis-pedidos → [ { _id, cliente, rut, total, status, fecha, items } ]
  misPedidos: (limit = 30) => req(`/orders/admin/mis-pedidos?limit=${limit}`),
  // GET /sectores → { sectores:[{nombre, orden, activo}] } (orden de recorrido para agrupar impresión)
  sectores: () => req(`/sectores`),
  // PUT /sectores (products.manage) { sectores:[{nombre,orden,activo}] } → { sectores }
  // Upsert por nombre: reconfigura el recorrido del picking (no borra sectores).
  putSectores: (items) => req(`/sectores`, { method: "PUT", body: { sectores: items } }),
  // POST /orders/admin/:id/cobrar → order PAGADO (gate orders.pay).
  // body { metodo, amount_received? } — y para venta a crédito:
  // { metodo:"credito", cliente_rut, override?:boolean } (override solo admin/manager;
  // 409 con mensaje claro si el crédito no alcanza / cliente bloqueado / mora).
  cobrar: (id, payload) => req(`/orders/admin/${id}/cobrar`, { method: "POST", body: payload }),
  // POST /orders/admin/:id/aceptar → claim atómico paid→preparing (gate orders.prepare).
  // 409 si ya fue tomado, si no es el más antiguo del segmento (FIFO) o si está
  // asignado a otra persona.
  aceptar: (id) => req(`/orders/admin/${id}/aceptar`, { method: "POST" }),
  // GET /orders/admin/pickers (users.manage) → bodegueros activos rol operator|admin
  // [{_id,name,email}] para el selector de asignación manual.
  pickers: () => req(`/orders/admin/pickers`),
  // Fija nivel (nuevo/experto) y PIN del tótem de un picker (gerente).
  pickerConfig: (id, cfg) => req(`/orders/admin/pickers/${id}/config`, { method: "POST", body: cfg }),
  // Registra/actualiza el rostro de un picker (users.manage). descriptors = array
  // de arrays de 128 números; [] borra el rostro registrado.
  pickerFace: (id, descriptors) => req(`/orders/admin/pickers/${id}/face`, { method: "POST", body: { descriptors } }),
  // ── Tótem de picking (kiosko público, identificación por PIN) ──
  totemIdentificar: (pin) => req(`/orders/totem/identificar`, { method: "POST", body: { pin }, auth: false }),
  // Identificación por ROSTRO: manda el descriptor (128 números) del rostro en vivo;
  // el backend lo compara con los pickers registrados y devuelve el picker + su pin.
  totemIdentificarFacial: (descriptor) => req(`/orders/totem/identificar-facial`, { method: "POST", body: { descriptor }, auth: false }),
  totemTablero: (pin) => req(`/orders/totem/tablero`, { method: "POST", body: { pin }, auth: false }),
  totemTomar: (pin, order_id) => req(`/orders/totem/tomar`, { method: "POST", body: { pin, order_id }, auth: false }),
  totemFinalizar: (pin, order_id, bultos) => req(`/orders/totem/finalizar`, { method: "POST", body: { pin, order_id, bultos }, auth: false }),
  // POST /orders/admin/:id/asignar (users.manage) { user_id|null } → asigna el
  // pedido a una persona específica (o null = quitar asignación). Solo paid/preparing.
  asignarPedido: (id, user_id) => req(`/orders/admin/${id}/asignar`, { method: "POST", body: { user_id } }),
  // Picking (gate orders.prepare): avance persistido, faltante/dañado, y cierre de empaque (→ready).
  patchPick: (id, payload) => req(`/orders/admin/${id}/pick`, { method: "PATCH", body: payload }),
  faltante: (id, payload) => req(`/orders/admin/${id}/faltante`, { method: "POST", body: payload }),
  marcarListo: (id, payload) => req(`/orders/admin/${id}/listo`, { method: "POST", body: payload }),
  // Sesión de caja (cajera): abrir / ver actual / cerrar con cuadre.
  cajaActual: () => req(`/caja/sesion/actual`),
  // GET /caja/mi-dia → { hoy:{total,count}, mes:{total,count}, porMetodo } de la cajera
  cajaMiDia: () => req(`/caja/mi-dia`),
  abrirCaja: (monto_inicial) => req(`/caja/sesion/abrir`, { method: "POST", body: { monto_inicial } }),
  cerrarCaja: (monto_contado) => req(`/caja/sesion/cerrar`, { method: "PATCH", body: { monto_contado } }),

  // ── Capa de reportes (adminController) — gate reports.read (admin + manager) ──
  // GET /admin/dashboard  → { total_sales, paid_orders, active_users, active_products, total_vendors, pending_vendors }
  salesDashboard: () => req(`/admin/dashboard`),
  // GET /admin/sales-summary?from&to&group_by=day|month  → { totals, series }
  salesSummary: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/sales-summary${qs ? `?${qs}` : ""}`);
  },
  // GET /admin/gerencia?from&to → centro de mando (ventas, operación, equipo, productos, caja, inventario)
  gerencia: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/gerencia${qs ? `?${qs}` : ""}`);
  },
  // GET /admin/gerencia/dashboard360 → Dashboard Gerencial 360° (kpisDia, alertas,
  // ventasMes, inventario, abastecimiento, logistica, productividad, rentabilidad).
  // Montos crudos (números); % con 1 decimal; campos pueden venir null.
  dashboard360: () => req(`/admin/gerencia/dashboard360`),
  // GET /admin/audit?limit → bitácora de acciones sensibles
  audit: (limit = 50) => req(`/admin/audit?limit=${limit}`),
  // GET /admin/actividad → tablero de actividad en vivo del equipo (presencia, tarea, tiempo muerto)
  actividad: () => req(`/admin/actividad`),
  // GET /admin/desempeno → desempeño por área (metas + cumplimiento del día + miembros)
  desempeno: () => req(`/admin/desempeno`),
  // POST /admin/demo/reseed → regenera pedidos demo del relay (gate users.manage)
  reseedDemo: () => req(`/admin/demo/reseed`, { method: "POST" }),
  // GET /admin/relay-metrics?from&to → { cola, entregados, tiempos, cuello, personas } (relay de sala)
  relayMetrics: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/relay-metrics${qs ? `?${qs}` : ""}`);
  },
  // GET /admin/top-products?from&to&limit  → [ { _id, name, total_quantity, total_revenue } ]
  topProducts: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/top-products${qs ? `?${qs}` : ""}`);
  },
  // GET /admin/bottom-products?from&to&limit → menos vendidos (rotación baja)
  bottomProducts: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/bottom-products${qs ? `?${qs}` : ""}`);
  },
  // GET /admin/orders/export?from&to&status → CSV (blob). Descarga el detalle de pedidos.
  exportOrders: async (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    const res = await fetch(`${BASE}/admin/orders/export${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`Export ${res.status}`);
    return res.blob();
  },

  // ── Biblioteca de informes (/reports) — gate reports.read ─────────────────────
  // GET /reports/kardex-valorizado?from&to&product_id&limit
  // → { items:[{fecha,producto,tipo,cantidad,stock_after,costo_unit,valor}], totales, meta }
  rKardexValorizado: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/reports/kardex-valorizado${qs ? `?${qs}` : ""}`);
  },
  // GET /reports/valorizacion → { por_categoria:[], por_sector:[], totales:{valor_costo,valor_venta,skus,sin_costo} }
  rValorizacion: () => req(`/reports/valorizacion`),
  // GET /reports/rotacion?days → { items:[{producto,vendidas,venta_prom_dia,stock,cobertura_dias,sobre_stock,inmovil,quiebre}] }
  rRotacion: (days = 30) => req(`/reports/rotacion?days=${days}`),
  // GET /reports/ranking?by=vendedor|producto|cliente&from&to&limit
  // → { items:[{nombre,total,unidades,pedidos,ticket_prom}] }
  rRanking: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/reports/ranking${qs ? `?${qs}` : ""}`);
  },
  // GET /reports/margen?from&to → { items:[{producto,venta,costo,margen,margen_pct}], totales, meta }
  rMargen: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/reports/margen${qs ? `?${qs}` : ""}`);
  },
  // GET /reports/libro-ventas?month=YYYY-MM → { items:[{fecha,folio,cliente,metodo,neto,iva,total}], totales }
  rLibroVentas: (month) => req(`/reports/libro-ventas${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  // GET /reports/cuadres?limit → { items:[{fecha,cajera,monto_inicial,esperado,contado,diferencia,estado}] }
  rCuadres: (limit = 30) => req(`/reports/cuadres?limit=${limit}`),

  // ── Gestión de usuarios (adminController) — gate users.manage ─────────────────
  // GET /admin/users?page&limit&search&role&is_active  → { users, pagination }
  adminUsers: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  // PATCH /admin/users/:id/role  { role }  → user
  setUserRole: (id, role) =>
    req(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
  // PATCH /admin/users/:id/active  { is_active }  → user
  setUserActive: (id, is_active) =>
    req(`/admin/users/${id}/active`, { method: "PATCH", body: { is_active } }),

  // ── Gestión de productos (productController) — gate products.manage ───────────
  // GET /products?include_inactive&in_stock&brand&search&page&limit → { items, pagination }
  products: (params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    );
    const qs = new URLSearchParams(clean).toString();
    return req(`/products${qs ? `?${qs}` : ""}`);
  },
  // POST /products  → producto creado
  createProduct: (payload) =>
    req(`/products`, { method: "POST", body: payload }),
  // PATCH /products/:id  → producto actualizado
  updateProduct: (id, payload) =>
    req(`/products/${id}`, { method: "PATCH", body: payload }),
  // GET /categories?limit=100 → { items, pagination }
  categories: (params = { limit: 100 }) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    );
    const qs = new URLSearchParams(clean).toString();
    return req(`/categories${qs ? `?${qs}` : ""}`);
  },
  // GET /products/:id/ficha (products.manage) → { producto, ventas, bodega, meta }
  // Ficha 360° del producto: datos + ventas 30d + stock/lotes/cobertura.
  ficha: (id) => req(`/products/${id}/ficha`),
  // POST /products/import-bulk (products.manage) { rows:[...], dry_run? } → resumen
  // { total, creados, actualizados, errores, dry_run, resultados:[{fila,accion,...}] }.
  // Máx 500 filas. dry_run=true simula sin escribir (para previsualizar).
  importProducts: (rows, dryRun = false) =>
    req(`/products/import-bulk`, { method: "POST", body: { rows, dry_run: dryRun } }),

  // ── Contenido de la tienda (contentController) ────────────────────────────────
  // GET /content/home (público) → { slots|null, specs, updated_at }
  // specs por slot: { nombre, descripcion, tamano, ratio_web, ratio_movil, max_items?, campos }
  contentHome: () => req(`/content/home`, { auth: false }),
  // PUT /content/home (products.manage) { slots } → guarda TODO el objeto (PUT completo, no merge)
  saveContentHome: (slots) => req(`/content/home`, { method: "PUT", body: { slots } }),
  // GET /config/modules (público) → { enabled:["web","bodega","sala","gerencia"] }
  configModules: () => req(`/config/modules`, { auth: false }),
  // POST /uploads/image (products.manage) multipart campo "image"
  // → { url, key, publicId, size, mime } (url = Cloudinary secure_url)
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return reqForm(`/uploads/image`, fd);
  },

  // ── Recepción de mercadería (inventoryController) — gate inventory.adjust ─────
  // POST /inventory/receive  { supplier?, doc_ref?, items:[{product_id, qty, expiry_date?, location?}] }
  // qty = CAJAS recibidas (el backend traduce a unidades con box_qty).
  // → { received:[{product_id,name,cajas,box_qty,units,stock_after}], total_items }
  receiveStock: (payload) =>
    req(`/inventory/receive`, { method: "POST", body: payload }),

  // ── Conteo físico / cycle count (capa aditiva Fase C) ────────────────────────
  // El conteo es AUTORITATIVO: al cerrar, stock := contado (delta vs stock actual).
  // POST /inventory/counts  { scope:{type:"sector"|"category"|"all", value, label} }
  // → CycleCount open con líneas (theoretical_qty = snapshot). Gate inventory.adjust.
  startCount: (scope) =>
    req(`/inventory/counts`, { method: "POST", body: { scope } }),
  // GET /inventory/counts?status=&limit=  → { items } (sesiones). Gate inventory.read.
  counts: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/inventory/counts${qs ? `?${qs}` : ""}`);
  },
  // GET /inventory/counts/:id  → CycleCount con sus líneas. Gate inventory.read.
  count: (id) => req(`/inventory/counts/${id}`),
  // PATCH /inventory/counts/:id  { counts:[{ product_id, counted_qty }] } → CycleCount.
  // Guardado progresivo de las cantidades contadas. Gate inventory.adjust.
  saveCounts: (id, counts) =>
    req(`/inventory/counts/${id}`, { method: "PATCH", body: { counts } }),
  // POST /inventory/counts/:id/close → aplica ajustes (adjustStock por línea) y devuelve
  // el CycleCount cerrado con applied:{lines_adjusted,units_delta}. Gate inventory.adjust.
  closeCount: (id) => req(`/inventory/counts/${id}/close`, { method: "POST" }),
  // POST /inventory/counts/:id/cancel → marca cancelled sin ajustar. Gate inventory.adjust.
  cancelCount: (id) => req(`/inventory/counts/${id}/cancel`, { method: "POST" }),

  // ── Lotes / trazabilidad (capa aditiva Fase B) — gate inventory.read ─────────
  // GET /inventory/lotes?product_id&status&q&page  → { items, count }
  // Ledger paralelo de lotes (Batch): costo por compra, vencimiento por lote, ubicación.
  lotes: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/inventory/lotes${qs ? `?${qs}` : ""}`);
  },
  // GET /inventory/lotes/expiring?days=N → { items:[{batch_id,lot_code,product_name,qty_remaining,
  //   expiry_date,days_left,location}], count } (FEFO por lote)
  lotesExpiring: (days = 30) => req(`/inventory/lotes/expiring?days=${days}`),

  // ── Caja: cobro en efectivo + cuadre (orderController) ───────────────────────
  // POST /orders/admin/:id/pay-cash  { amount_received }  → order (con vuelto)
  markPaidCash: (id, payload) =>
    req(`/orders/admin/${id}/pay-cash`, { method: "POST", body: payload }),
  // GET /orders/admin/cash-summary?date=YYYY-MM-DD → { date, total_cobrado, count, by_cashier }
  cashSummary: (date) =>
    req(`/orders/admin/cash-summary${date ? `?date=${date}` : ""}`),
  // PATCH /orders/admin/:id/printed → { printed_at } (Impresión central; idempotente)
  marcarImpresa: (id) => req(`/orders/admin/${id}/printed`, { method: "PATCH" }),

  // ── Autorizaciones anti-robo (anulación / excepción de precio) ────────────────
  // La cajera SOLICITA, el jefe APRUEBA/RECHAZA desde el celular. Registro inmutable.
  // POST /autorizaciones/solicitar (orders.pay) { order_id, tipo, detalle, cambios? }
  // tipo "precio" exige cambios: [{ product_id, precio_propuesto }] (precio UNITARIO).
  // → { autorizacion } · 409 si ya hay una pendiente del mismo pedido+tipo.
  solicitarAutorizacion: (orderId, tipo, detalle, cambios) =>
    req(`/autorizaciones/solicitar`, {
      method: "POST",
      body: { order_id: orderId, tipo, detalle, ...(cambios?.length ? { cambios } : {}) },
    }),
  // GET /autorizaciones?estado=pendiente|todas (users.manage — jefe)
  // → { items (desc por created_at, máx 50), pendientes: count }
  autorizaciones: (estado = "pendiente") =>
    req(`/autorizaciones?estado=${encodeURIComponent(estado)}`),
  // GET /autorizaciones/pedido/:orderId (orders.pay — la cajera consulta SU solicitud)
  // → { autorizacion: la más reciente del pedido | null }
  autorizacionDePedido: (orderId) =>
    req(`/autorizaciones/pedido/${encodeURIComponent(orderId)}`),
  // POST /autorizaciones/:id/resolver (users.manage) { aprobar:boolean, nota? }
  // → { autorizacion } · 409 si ya no está pendiente. Si tipo=anulación y se
  // aprueba, el backend cancela el pedido en el mismo flujo (libera stock).
  resolverAutorizacion: (id, aprobar, nota) =>
    req(`/autorizaciones/${id}/resolver`, { method: "POST", body: nota ? { aprobar, nota } : { aprobar } }),

  // ── Aprobación de cambios de precio por Telegram (priceApprovalController) ─────
  // El cambio NO se aplica hasta que un aprobador toque "Aceptar" en el grupo.
  // POST /price-approvals (products.manage) { items:[{product_id, tiers_propuestos}], motivo? }
  // → { approval } · 409 si Telegram no está configurado o un producto ya tiene solicitud pendiente.
  solicitarCambioPrecio: (items, motivo) =>
    req(`/price-approvals`, { method: "POST", body: { items, ...(motivo ? { motivo } : {}) } }),
  // GET /price-approvals?estado=pendiente|todas (products.manage) → { items, pendientes }
  priceApprovals: (estado = "pendiente") =>
    req(`/price-approvals?estado=${encodeURIComponent(estado)}`),
  // PATCH /price-approvals/:id/cancel (solicitante o gerente) → { approval }
  cancelPriceApproval: (id) => req(`/price-approvals/${id}/cancel`, { method: "PATCH" }),

  // ── Devoluciones / reembolsos (refundController) — admin (requireAdmin) ────────
  // GET /refunds/admin?status&page&limit  → { items, total, page, limit }
  refundsAdmin: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/refunds/admin${qs ? `?${qs}` : ""}`);
  },
  // POST /refunds/admin/approve { refund_id }  → { refund } (repone stock + devuelve dinero)
  approveRefund: (refundId) =>
    req(`/refunds/admin/approve`, { method: "POST", body: { refund_id: refundId } }),
  // POST /refunds/admin/reject { refund_id, reason }  → { refund }
  rejectRefund: (refundId, reason) =>
    req(`/refunds/admin/reject`, { method: "POST", body: { refund_id: refundId, reason } }),

  // ── Documentos tributarios (taxDocumentController) — admin/gerente, read-only ──
  // GET /tax-documents/admin?status&type&order_id&page&limit  → { items, total }
  taxDocsAdmin: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    const qs = new URLSearchParams(clean).toString();
    return req(`/tax-documents/admin${qs ? `?${qs}` : ""}`);
  },

  // ── Cobranza / aging (cobranzaController) — gate reports.read ─────────────────
  // GET /cobranza/resumen → { hoy, aging:{total,buckets}, llamarHoy:[...], chequesPorVencer:[...] }
  cobranzaResumen: () => req(`/cobranza/resumen`),

  // ── Clientes con crédito (clienteController) ──────────────────────────────────
  // GET /clientes (reports.read) → { items:[{_id,razon_social,rut,credito,estado}], count }
  // estado = estadoCredito: { saldo, disponible, uso_pct, max_mora_dias, semaforo,
  // puede_comprar, motivo_rechazo }.
  clientes: () => req(`/clientes`),
  // POST /clientes (users.manage) { razon_social, rut, contacto?, credito? } → cliente
  // (409 si el RUT ya existe).
  crearCliente: (p) => req(`/clientes`, { method: "POST", body: p }),
  // PATCH /clientes/:id (users.manage) — datos + crédito (cambios de línea/bloqueo
  // quedan auditados en el backend).
  patchCliente: (id, p) => req(`/clientes/${id}`, { method: "PATCH", body: p }),
  // GET /clientes/:id/estado-cuenta (reports.read) → { cliente, estado,
  // documentos:[...antiguo→nuevo], abonos_recientes:[...últimos 15] }
  estadoCuenta: (id) => req(`/clientes/${id}/estado-cuenta`),
  // POST /clientes/:id/abono (reports.read) { monto>0, medio?, referencia? } →
  // aplica FIFO al documento más antiguo → { aplicaciones:[{deuda_id,documento,
  // aplicado}], sobrante, total_aplicado }.
  abonoCliente: (id, p) => req(`/clientes/${id}/abono`, { method: "POST", body: p }),
  // GET /clientes/buscar-rut/:rut (orders.pay — lo usa la cajera) →
  // { cliente:{_id,razon_social,rut}, estado } (404 si no existe, 422 rut inválido).
  buscarClienteRut: (rut) => req(`/clientes/buscar-rut/${encodeURIComponent(rut)}`),

  // ── Cierre Z de caja (cajaController) — gate reports.read ────────────────────
  // GET /caja/cierre-z?date=YYYY-MM-DD → { date, total, count, byMethod, byCajero }
  cierreZ: (date) => req(`/caja/cierre-z${date ? `?date=${date}` : ""}`),

  // ── Turnos de atención presencial (turnoController) ──────────────────────────
  // PÚBLICO (cliente vía QR): sacar número, ver tablero, seguir el propio turno
  // Acepta string (compat: solo nombre) u objeto { name?, tipo?: "compra"|"retiro", rut? }.
  // RUT inválido → 400 del backend.
  crearTurno: (arg) =>
    req(`/turnos`, {
      method: "POST",
      body: typeof arg === "string" || arg == null ? { name: arg || undefined } : arg,
      auth: false,
    }),
  // GET /turnos/pedidos-por-rut/:rut (público) → { pedidos:[{folio,estado,estado_label,total,metodo,pagado,committed_date}] } máx 5
  pedidosPorRut: (rut) => req(`/turnos/pedidos-por-rut/${encodeURIComponent(rut)}`, { auth: false }),
  turnoBoard: () => req(`/turnos/board`, { auth: false }),
  turnoStatus: (id) => req(`/turnos/${id}`, { auth: false }),
  // Vendedor (orders.prepare): lista, llamar siguiente (con módulo), atender, listo, cancelar
  turnosAdmin: () => req(`/turnos/admin`),
  callNextTurno: (module) =>
    req(`/turnos/admin/call-next`, { method: "POST", body: module ? { module } : {} }),
  attendTurno: (id) => req(`/turnos/admin/${id}/attend`, { method: "POST" }),
  doneTurno: (id) => req(`/turnos/admin/${id}/done`, { method: "POST" }),
  cancelTurno: (id) => req(`/turnos/admin/${id}/cancel`, { method: "POST" }),

  // Módulos de atención (config). Listar: cualquier rol WMS. Gestionar: admin/gerente.
  modules: (activeOnly = false) => req(`/turnos/modules${activeOnly ? "?active=1" : ""}`),
  createModule: (name) => req(`/turnos/modules`, { method: "POST", body: { name } }),
  updateModule: (id, patch) => req(`/turnos/modules/${id}`, { method: "PATCH", body: patch }),
  deleteModule: (id) => req(`/turnos/modules/${id}`, { method: "DELETE" }),
};

// Hook de carga: fetcher real, o el valor mock cuando no hay backend configurado.
export function useLoad(fetcher, mockValue, deps = []) {
  const [state, setState] = useState({
    data: usingMock ? mockValue : null,
    loading: !usingMock,
    error: null,
  });

  useEffect(() => {
    if (usingMock) {
      setState({ data: mockValue, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      // Mantener los últimos datos en pantalla ante un error transitorio (cold
      // start de Render, hipo de red) en vez de dejar la vista en blanco.
      .catch((e) => alive && setState((s) => ({ data: s.data, loading: false, error: e.message })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
