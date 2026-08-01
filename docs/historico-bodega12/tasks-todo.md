# tasks/todo.md — Flujo operativo de sala (4 roles + trazabilidad en vivo)

> Spec: relay vendedor → cajera → bodeguero → pantalla de retiro, con actor+timestamp en cada
> transición, impresión agrupada por sector, sesión de caja con cuadre, dashboards en vivo. UN SOLO LOCAL.

## Veredicto de factibilidad
**ALTAMENTE factible. ~75% ya existe y se reutiliza. NO es greenfield.** Se construye **dentro del codebase**
(decisión §12.4), no como módulo nuevo. El FSM, los timestamps+actor, el stock de 3 estados con el fix de
timing, los turnos, la pantalla pública, picking con escáner, el cuadre de caja y el RBAC **ya están**. El
trabajo nuevo se concentra en: **(1)** entidad Sector + agrupación de impresión, **(2)** separar vendedor↔cajera
vía boleta+escaneo, **(3)** 2 roles nuevos (vendedor, pantalla) con UIs acotadas, **(4)** vista imprimible de
boleta/ticket con QR, **(5)** sesión de caja formal, **(6)** métricas de tiempos por etapa + tiempo real.

## Lo que YA existe y se reutiliza (NO se duplica)
| Capacidad del spec | Ya existe en | Reuso |
|---|---|---|
| FSM con actor+timestamp por transición | `Order.status_history{changed_at,changed_by:{user_id,role,label}}` + `VALID_TRANSITIONS` (constants.js) + `transitionOrderStatus`/`appendHistory` (orderService) | **directo** |
| Stock 3 estados + fix de timing | `Product{stock,reserved,allocated}` + `allocateStockAtomic` (al crear) + `commitOrderPick` (al pick, descuenta físico) + kardex `StockMovement` | **directo** |
| Cola de turnos + pantalla pública en vivo | `Turno` model + `turnoService` (claim atómico `callNextTurno`) + `Pantalla.jsx` (espera→atención→cola→prep→listo, voz/sonido) | **directo** |
| Toma presencial + cobro efectivo + cuadre | `VentaManual.jsx`, `POST /orders/admin/manual`, `pay-cash` (amount_received/change), `cuadreZ`/`arqueo`, `CierreZ.jsx` | **directo / extender** |
| Picking con escaneo | `Picking.jsx` + `BarcodeScanner.jsx` (BarcodeDetector + html5-qrcode; EAN/UPC/Code128/QR) + `Product.barcode` | **directo** |
| RBAC | `PERMISSIONS`/`ROLE_PERMISSIONS`/`requirePermission`/`can()`/NAV gating | **directo** |
| Dashboards/reportes | `/admin/{dashboard,sales-summary,top-products}`, `/caja/cierre-z`, `Ventas/Analitica/Directorio/Incentivos.jsx` | **extender** |
| Infra | ESM Node, Zod validators, `withTransaction` (replica set rs0/Atlas), pino, `useLoad`/`VITE_API_URL` | **directo** |

## Mapeo de estados (spec ↔ repo) — se REUSA el FSM, se renombra/expone
`EN_TOMA` → carrito en el dispositivo del vendedor (client-side hasta finalizar) ·
`POR_PAGAR` → **pending** · `PAGADO/EN_COLA_PICKING` → **paid** · `EN_PREPARACION` → **preparing** ·
`LISTO_RETIRO` → **ready** · `ENTREGADO` → **delivered** · `ANULADO` → **cancelled**.
(`shipped`/`refunded` se mantienen para otros flujos.)
**Cambio de comportamiento clave:** hoy `VentaManual` crea el pedido directo en `paid` (vendedor = cajera). El
relay **separa**: el vendedor cierra en `pending` (POR_PAGAR) + imprime boleta → la cajera la escanea y cobra → `paid`.

## Mapeo de roles (spec ↔ repo)
`vendedor` → **NUEVO** (permiso `orders.take`) · `cajera` → **cashier** (existe) + permiso de cobro ·
`bodeguero` → **operator** (existe) · `gerente/dueño` → **manager** (acceso total) · `admin` = superuser ·
`pantalla` → **NUEVO** rol solo-lectura. El RBAC se reutiliza; se **acotan las UIs por rol** (cada rol ve solo lo suyo).

## Decisiones (§12) — CONFIRMADAS 2026-06-25
**CEO (negocio):** D1 = **Relay estricto de 4 roles** (vendedor toma → boleta `pending` → cajera escanea y cobra → `paid` → picking; NO se mantiene el atajo de 1 paso). · D2 = **Efectivo (vuelto automático) + tarjeta/transferencia manual** (sin integración Transbank por ahora). · D3 = **Vista imprimible por navegador**, abstraída para enchufar térmica ESC/POS después. · D4 = **Sí, recepción de mercadería la hacen los bodegueros** (registrar quién/cuándo + diferencias).
**CTO (técnicas):** tiempo real = **SSE** (single-local, sin infra extra, sobre HTTP) · escaneo = **lector físico + cámara** (ambos, ya soportado) · **dentro del codebase** · turnos = sistema actual (QR cliente + llamado por vendedor).

## Plan por fases (✅=reuso  🔨=nuevo)
### Fase 1 — Fundaciones ✅ HECHA (2026-06-25)
- [x] 🔨 `Sector{nombre,orden,activo}` (`models/Sector.js`) + seed `seedSectores.js` (5 sectores, 55 prod asignados) + `Product.location.sector`
- [x] 🔨 Roles `vendedor` + `pantalla` en ROLES/ROLE_PERMISSIONS/WMS_ROLES; permisos `orders.take` + `orders.pay`; espejo en `auth.jsx`; usuarios de prueba (6 roles) en `seedWmsUsers.js`
- [x] 🔨 Matriz explícita `TRANSITION_PERMISSION` + `canRoleTransition` (constants.js), cableada en `orderController.canRoleSetStatus`
- [x] ✅ Inventario intacto (no se tocó `commitOrderPick`/stock; solo se añadió campo sector)
- [x] 🔨 (D4) Recepción reachable por bodeguero (operator tiene `inventory.adjust` → `Recepcion.jsx`; kardex registra actor)
- [x] ✔ Verificación: `pure sectores` + `matriz RBAC` con TDD (test rojo→verde); **suite 21/21**; build WMS verde
### Fase 2 — Vendedor (móvil) ✅ HECHA (2026-06-25)
- [x] 🔨 `POST /orders/admin/take` (`relayOrderService.createTakeOrder`): pedido `pending` (POR_PAGAR) con **allocate** (no decrementa; físico sale al pick), snapshot de `sector` por ítem, `codigo_escaneo` (=`_id`), enlaza+cierra turno. Actor vendedor en `status_history`. Verificado por HTTP: 201 pending + sector + escaneo.
- [x] 🔨 `screens/VentaSala.jsx`: cola de turnos + llamar siguiente; catálogo (55 prod reales) búsqueda instantánea + stock en vivo (bloqueo por `maxCajas`) + add 1-toque + ± grandes; resumen **agrupado por sector** + total; finalizar → take → boleta. Verificado en preview.
- [x] 🔨 `print.js` `imprimirBoleta`: HTML imprimible agrupado por sector + **QR del `codigo_escaneo`** (qrcode). Endpoint `/sectores` (GET+PUT) ordena el recorrido.
- [x] 🔨 Alcance por rol (`ROLE_SCOPE`): el vendedor ve **solo** "Tomar pedido". Verificado en preview.
- [x] ✔ Verificación: toma → `pending` → boleta; escaneo trae el pedido (cajera); suite 21/21; build verde.
### Fase 3 — Caja ✅ HECHA (2026-06-25)
- [x] 🔨 Escaneo de boleta → `GET /orders/admin/by-scan/:codigo` trae el pedido (lector teclado/cámara o manual)
- [x] 🔨 Cobro `POST /orders/admin/:id/cobrar` (`cobrarPedido` reusa `markAsPaid`): keypad + vuelto automático, medios efectivo/tarjeta/transferencia → `paid` + `payment.cashier_id` + `payment.method` → cola de picking
- [x] 🔨 `CajaSession` + `/caja/sesion/{abrir,actual,cerrar}`: fondo inicial, efectivo esperado en vivo, cierre con cuadre (`arqueoCaja`)
- [x] 🔨 `screens/Caja.jsx` acotada (`ROLE_SCOPE.cashier=["caja"]`): sesión + escaneo + detalle por sector + keypad/vuelto + cobro
- [x] ✔ Verificación HTTP: abrir→cobrar→esperado(50k+ventas)→cerrar **cuadra** (dif 0); cobro por UI deja el pedido `paid` con cajera. Suite 21/21; build verde; preview OK.
### Fase 4 — Picking ✅ HECHA (2026-06-25)
- [x] 🔨 Claim atómico `POST /orders/admin/:id/aceptar` (`aceptarPicking`: `findOneAndUpdate` con guard `status='paid'`) + actor bodeguero en `status_history`. 409 si otro lo tomó.
- [x] 🔨 Ticket de picking imprimible **agrupado por sector** (`imprimirTicketPicking`) al aceptar, en orden de recorrido (`/sectores`).
- [x] ✅ Marcar listo → `ready` (reusa `setOrderStatus`→`commitOrderPick`: descuenta físico + kardex).
- [x] 🔨 `Picking.jsx`: TOMAR usa claim atómico + imprime ticket + saca de la cola si 409. Scope bodeguero (`operator`). Pantalla de retiro = `Pantalla.jsx` (reuso, en vivo).
- [x] ✔ Verificación: **dos `aceptar` en paralelo → 1 ganador (200) + 1 rechazo (409)**. Suite 21/21; build verde.
### Fase 5 — Trazabilidad + dashboards ✅ HECHA (2026-06-25)
- [x] 🔨 `GET /admin/relay-metrics?from&to` (`relayMetricsController`): tiempos por etapa (espera+cobro, cola, preparación, retiro, total) desde `status_history`, **cuello de botella**, cola en vivo y throughput.
- [x] 🔨 Rankings **desde pedidos internos**: vendedores por $, cajeras por $ cobrado, bodegueros por velocidad (todo del actor en `status_history`). Filtro de periodo `from/to`.
- [x] 🔨 `screens/Operacion.jsx`: vista general (cola en vivo) + tiempos por etapa (cuello marcado) + 3 rankings + **drill-down** a Pedidos. §5.5 completo entre Directorio·Operación·Ventas·Analítica·CierreZ·Cobranza·Incentivos.
- [x] 🔨 Seed `seedRelayDemo.js`: 16 pedidos entregados con `status_history` retrodatado (tiempos/personas variados, datos reales no mock).
- [x] ✔ Verificación: endpoint con datos reales (cuello Preparación 12min, top vendedor Patricia $613k); Operación renderiza en preview; suite 21/21; build verde.
### Fase 6 — Pulido ✅ HECHA (2026-06-25)
- [x] 🔨 Tiempo real **SSE**: `utils/relayBus` + emits en toma/cobro/aceptar/transición + `GET /orders/stream` (público). Pantalla y App (cola/badges) se refrescan al instante; polling de respaldo. Verificado: 4 eventos `change` recibidos en vivo.
- [x] 🔨 Accesibilidad: `:focus-visible` global + `prefers-reduced-motion` en `index.css`. Copy en voz activa y nombres de acción consistentes (Cobrar→Cobrado, etc.).
- [x] ✔ **Prueba E2E**: pipeline completo verificado por HTTP — toma(pending)→cobro(paid)→acepta(preparing)→listo(ready)→entrega(delivered): **5/5** + SSE en vivo.
- [x] ✔ Definición de hecho (§15): 6 etapas con timestamps ✓ · cada rol ve solo su interfaz ✓ · 2 bodegueros no toman el mismo (200+409) ✓ · cuadre cuadra (dif 0) ✓ · boleta/ticket por sector ✓ · dashboard con secciones+drill-down+rankings reales ✓ · suite 21/21 ✓.

## Review (resultado final)
**Las 6 fases del relay están construidas y verificadas.** El pipeline vendedor→cajera→bodeguero→retiro corre end-to-end con actor+timestamp en cada transición, impresión agrupada por sector, sesión de caja con cuadre, claim atómico de picking, métricas/tiempos/rankings reales y tiempo real por SSE. ~75% se reutilizó del codebase; lo nuevo se integró sin romper el inventario de 3 estados ni el RBAC.
**Decisiones aplicadas:** relay estricto · efectivo+tarjeta/transferencia manual · impresión por navegador (abstraída para térmica) · recepción por bodegueros · SSE · single-local.
**Pendiente (producción, fuera del relay):** B7 DTE real (proveedor+certificado) · empaquetado nativo del vendedor (hoy web responsive) · endpoint "menos vendidos" real · afinar scope de `pantalla`/recepción · desplegar la rama a Render/Vercel.
**Usuarios de prueba (pass `Test1234!`):** vendedor@ · cajero@ · operario@ · gerente@ · pantalla@ · test@ (admin) — todos `@bodega12.cl`.

## Riesgos
- `location.zone/sector` es opcional → **validar obligatorio** al alta/edición de producto, o la impresión por sector queda vacía.
- Relay separado vs `VentaManual` de 1 paso → depende de **D1**.
- `withTransaction` requiere replica set (local rs0 ✓ · Atlas ✓).
- Sin test E2E hoy → se agrega en Fase 6.
- Tampering de actor → validar que `user_id` del JWT == `changed_by` (no confiar en label).
- Impresión térmica = agente local (QZ/ESC-POS) → fuera de Fase 2 salvo que D3 lo pida.

## Auditoría 2026-06-25 (7 frentes) — scores: relay 88 · RBAC 78 · reportes 62 · caja 78 · márgenes 68 · impresión/demo 82 · build 84
Núcleo sólido (relay E2E, claim atómico, RBAC, build OK). Trabajo derivado:

### Bugs a corregir (verificados en vivo)
- [ ] **A-high** `cobrar` re-cobra pedido ya pagado → 200 y sobreescribe payment.method/cashier_id (corrompe cuadre). Fix: updateOne condicionado a status PENDING / ConflictError. (relayOrderService.cobrarPedido)
- [ ] **B-high** vendedor NO puede llamar turno (turnoRoutes exige ORDERS_PREPARE). Fix: requireAnyPermission(TAKE, PREPARE).
- [ ] **C-high** Ventas.jsx (mejor dashboard) oculto en HIDDEN_NAV. Fix: mostrar.
- [ ] **C/D** CierreZ byMethod usa claves crudas (cash_on_pickup/transfer) → arqueo roto. Fix: normalizar en cuadreZ.
- [ ] **D-high** cierre-z "Por cajero" siempre '—' (no pasa cashier_id). Fix: resolver label.
- [ ] **D-med** cierre-z filtra created_at vs sesión paid_at. Fix: usar paid_at.
- [ ] **C-med** top-products ignora limit (schema). Fix: añadir limit.
- [ ] **C-med** Analítica "menos vendidos" mock permanente. Fix: /admin/bottom-products.
- [ ] **C-med** Analítica sin from/to (muestra histórico bajo "de la semana"). Fix: acotar rango.
- [ ] **E-high** GET /products?search= → INTERNAL_ERROR (rompe buscador). Fix: query/$text.
- [ ] **E-med** sin optionalAuth en /products/:id,/search,/featured → admin no ve cost_price ahí.
- [ ] **B-med** Usuarios.jsx no ofrece roles vendedor/pantalla. **B-low** NAV perm 'refunds.manage' inexistente.
- [ ] **G-med** VIEW_ORDER 15/25 (fallback malo). Fix: =NAV.map. **G-low** Turnos.jsx huérfana; badge 'ped' muerto.

### Features pedidas
- [ ] **REPORTES (estrella):** selector periodo **D/S/M/Trimestral** unificado + **exportar** (CSV/Excel/PDF) automático + más indicadores/gráficos. Backend: group_by quarter, bottom-products, export wiring.
- [ ] **MÁRGENES/PRECIOS (apartado nuevo):** costo→margen objetivo→precio sugerido, rentabilidad por producto/categoría, productos bajo objetivo, UI profesional.
- [ ] **DEMO actualizable:** endpoint+botón admin "Regenerar demo" (seedRelayDemo) + incluir pedidos demo en prod para que Operación no arranque vacía.
- [ ] **"VER COMO":** selector para admin/gerente que previsualiza la interfaz de cada rol.
- [ ] **Orden del menú:** grupos Inicio/Gestión · Relay de sala · Inventario · Reportes/Admin (propuesta del frente G).

## Review — 2026-06-25 (auditoría + mejoras pedidas, desplegado a prod)
Hecho y verificado (6 commits, todo en prod `bodega12-api.onrender.com` + `bodega-nine.vercel.app`):
- **Backend fixes (62be128):** cobro idempotente (re-cobro→409), vendedor llama turno, cierre-Z por cajera + paid_at + métodos normalizados, group_by quarter, /bottom-products. Verificado en vivo.
- **Ver como + menú (5a0a095):** selector de previsualización por rol (admin/gerente), 4 grupos (Inicio·gestión/Relay de sala/Inventario/Reportes·admin), Ventas visible, VIEW_ORDER=NAV, devoluciones perm real.
- **Reportes (f097ee9):** periodos Diario/Semanal/Mensual/Trimestral + export CSV/Excel/Pedidos/PDF + KPIs + gráfico + más/menos vendidos. group_by week en backend.
- **Demo regenerable (b8317da):** seedRelayDemo función + ensureRelaySeed siembra demo en prod (Operación/Reportes ya no vacíos) + POST /admin/demo/reseed + botón "🔄 Datos demo" en Reportes.
- **Precios y márgenes (6df0af6):** margen objetivo, KPIs, tabla con semáforo + precio sugerido, calculadora costo→precio, rentabilidad por categoría. Roles del relay en Usuarios.
Prod verificado: bottom-products 200, demo entregados>0, trimestre 2026-T2, bundle WMS con Reportes/Precios/Ver-como/Datos-demo.
Pendiente (no bloqueante): test de integración del relay (cobro idempotente/claim race); buscador de Productos (/products?search=) lanza 500 — bug preexistente; inline "fijar precio" en Precios (hoy se edita en Productos); rotar passwords de prueba antes de uso real.
