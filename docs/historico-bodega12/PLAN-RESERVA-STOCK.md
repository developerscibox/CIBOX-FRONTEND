# Plan — Reserva de stock del carrito con liberación por tiempo

> Diseño (no implementado aún). Objetivo del CEO: "descontar lo que está en el carrito, pero pasado X tiempo desbloquear esas unidades."

## Decisión central
**No se toca `Product.stock`** (es el inventario físico real, fuente de verdad del WMS, kardex y venta presencial). Se introduce el concepto:

```
DISPONIBLE para vender = stock − reserved
```

- `Product.reserved` (nuevo, contador desnormalizado para leer rápido).
- Colección nueva **`Reservation`** (1 doc por línea de carrito) con `expires_at`.
- Liberación por **job transaccional** (no por índice TTL puro de Mongo, porque al expirar hay que decrementar `reserved` de forma atómica).
- **TTL recomendado: 20 minutos** (configurable `CART_RESERVATION_TTL_MINUTES`).

## Modelo de datos
| Entidad | Cambio |
|---|---|
| **Reservation** (nueva) | `cart_id, product_id, user_id/guest_id, quantity (unidades), box_qty, status [active/released/confirmed], expires_at`. Índices: `{product_id,status}`, único parcial `{cart_id,product_id}` sobre `active`, `{status,expires_at}` (barrido), `{user_id}/{guest_id}`. |
| **Product** | `+ reserved: Number (default 0)`. `stock` intacto. Virtual `available = stock − reserved`. |
| **Cart** | opcional `reservation_expires_at` (cache para el countdown en la UI). |
| **env** | `CART_RESERVATION_TTL_MINUTES=20`, `CART_RESERVATION_SWEEP_MINUTES=1-2`. |
| **Kardex** | NO registra reserva/liberación (no es movimiento físico). El movimiento SALE se registra al confirmar, como hoy. |

## Endpoints (modificar los del carrito + 1 nuevo)
- `POST /cart/items` → reserva el delta: valida `stock − reserved ≥ qty` y `$inc reserved` **atómico** (mismo patrón que `decrementStockAtomic`), crea/extiende la Reservation. Si no alcanza → `409 ConflictError "Quedan N disponibles"`.
- `PATCH /cart/items/:id` → ajusta reserva (sube=reserva delta, baja=libera) y renueva `expires_at`.
- `DELETE /cart/items/:id` y `DELETE /cart` → liberan (status=released, `$inc reserved −qty`).
- `POST /cart/heartbeat` (nuevo, opcional) → renovación deslizante del TTL mientras el cliente está activo.
- `GET /cart` → devuelve `reservation_expires_at` + disponibilidad; **lazy release** (trata como liberada cualquier reserva ya vencida aunque el job no haya pasado).
- `GET /products` → expone `available`; el filtro `in_stock` pasa de `stock>0` a `available>0`.

## Flujos
1. **Agregar → reservar:** POST /cart/items → transacción: normaliza por caja → `findOneAndUpdate` atómico con guard `stock−reserved ≥ delta` → upsert Reservation `expires_at = now+TTL` → guarda carrito. Si no hay disponible → 409.
2. **Quitar → liberar:** libera la reserva de la línea (`reserved −= qty`).
3. **Expiración → liberar:** el job barre `Reservation{active, expires_at<now}` y libera en transacción.
4. **Checkout/pago → confirmar:** al crear la orden, en la **misma transacción**: `decrementStockAtomic` (descuenta el físico) **y** libera la reserva (`reserved −= qty`), para que el ítem no cuente doble.
5. **Renovación:** heartbeat o implícita en cada acción del carrito.

## Jobs
- **`releaseExpiredReservations`** — `setInterval` cada 1-2 min (+ pasada al arranque, `timer.unref()`), copiando `startPendingOrderExpiryJob`. Libera vencidas (limit ~200/pasada).
- **`reconcileReservedCounter`** — diario: recalcula `Product.reserved` desde la suma real de reservas activas (corrige deriva por crash/bug).

## Cambios en el WMS
- **Inventario.jsx**: mostrar **Disponible** (stock−reserved) junto a **Físico** y **Reservado**.
- `getStockSummary`: incluir `reserved` y calcular `available`.
- Ficha de producto WMS: "X reservadas por carritos" (para que el operario entienda por qué Disponible < Físico).
- Opcional: panel "Reservas activas".

## Casos borde (todos contemplados)
- **Concurrencia** (dos clientes, última caja): reserva atómica con guard `$expr`.
- **Venta presencial compite por el físico**: a propósito, el físico manda; `decrementStockAtomic` valida `stock ≥ qty` al confirmar y revierte si no alcanza.
- **Multi-pestaña**: la reserva es por línea de carrito (no por pestaña).
- **Reserva zombi** (vencida, job no pasó): lazy release en lecturas.
- **Crash a mitad**: `withTransaction` + job de reconciliación.
- **Producto desactivado**: se revalida `is_active` al confirmar.

## Riesgos a tener en cuenta
1. **Render plan FREE duerme**: el job de liberación NO corre mientras el server está dormido → reservas pueden vivir de más. Mitigación: lazy release en lecturas + keep-warm.
2. **Doble verdad stock/reserved**: si `reserved` deriva, distorsiona disponible → job de reconciliación.
3. **TTL agresivo**: muy corto frustra; muy largo bloquea ventas. 20 min es un balance; ajustable.
4. **Atlas M0**: transacciones OK (replica set) pero recursos limitados; el sweep frecuente añade carga.

## Archivos a tocar
`backend/src/models/Reservation.js` (nuevo), `Product.js`, `Cart.js`, `services/stockService.js` (reserveStockAtomic/releaseReservedStock/confirmReservation), `controllers/cartController.js`, `services/cartService` (backend), `jobs/releaseExpiredReservations.js` (nuevo) + bootstrap, `config/env.js`, `controllers/inventoryController.js` (available), `productController.js` (filtro in_stock → available); tienda: `cartService.js` + UI countdown; WMS: `Inventario.jsx`.

## Implementación sugerida por fases
- **Fase 1 (núcleo):** modelo Reservation + `reserved` + reservar/liberar en cart + job de expiración + lazy release. (Lo mínimo funcional.)
- **Fase 2 (UX):** countdown en el carrito de la tienda + heartbeat + mensaje "quedan N disponibles".
- **Fase 3 (WMS):** Disponible vs Físico vs Reservado en Inventario + reconciliación.
