# CODEBASE_MAP.md — Reconocimiento del repo KSA+ (brownfield)

> Generado en el recon del loop (2026-06-22). Verificado en código, no asumido.
> Fuente de verdad del producto: `docs/KSA-Plan-Producto-Completo-Bodega12.md`.

## Toolchain (verificado)
- **Backend**: Node ESM (`"type":"module"`), Express 5, Mongoose 9, Zod. `backend/`.
- **Tests**: runner nativo `node --test`. ⚠️ El script venía roto (`node --test test/` no resuelve el dir en Node 24) → **corregido a `node --test test/*.test.js`**. Correr: `cd backend && npm test`.
- **Lint**: `eslint src`. **Build**: no hay (Node directo). **Dev**: `npm run dev` (nodemon, :3001).
- **Tienda**: Expo/React, `npx expo start --web`. **WMS**: Vite/React (`bodega/`), `npm run dev`.
- **Deploy**: Render + MongoDB Atlas + Cloudinary.

## Modelos verificados (ruta real)
| Modelo | Realidad (≠ a veces lo que afirma el plan) |
|---|---|
| `Vendor` (models/Vendor.js) | **Seller del MARKETPLACE** (Bodega 12 como tienda), `user_id` único, `commission_rate`, `bank_info`. **NO es el vendedor en terreno.** |
| `Product` (Product.js) | `pricing.tiers[{min_qty,price,label}]` = 5 niveles **por cantidad** (≈ mapean a los 5 precios por tipo de cliente de LEQSIS). |
| `Order` (Order.js) | `items[]` = {product_id, quantity, price, subtotal, tier_label…} **SIN campo `vendor` en el ítem** (hay índice `items.vendor.id` pero el schema no lo declara → strict lo descarta). `payment.amount_received/change`, `status_history.changed_by` (cajero). |
| `UserMission` (UserMission.js) | **Solo tracker de misiones completadas** (user_id, mission_key, completed_at, reward). **NO es un motor de puntaje.** |
| Stock/`Reservation`/`StockMovement` | Reserva atómica anti-sobreventa + kardex inmutable. ✅ |
| `TaxDocument` + `siiService` | `siiService` es **stub** (no emite DTE real). ✅ esperado. |
| RBAC | permisos en `utils/constants.js` (PERMISSIONS/ROLE_PERMISSIONS). ✅ intacto. |

## ⚠️ Discrepancias clave (corrigen supuestos del plan)
1. **El "motor de gamificación" NO está construido.** `UserMission` es un flag de completado. El motor de puntaje/metas/comisión por período se construyó NUEVO en `backend/src/incentivos/`.
2. **No hay atribución de venta por vendedor a nivel de ítem.** El `orderItemSchema` no tiene `vendor`; el índice existe pero sin datos. `vendorDashboardController` agrega sobre `items.vendor.id` (marketplace), probablemente vacío.
3. **`Vendor` ≠ vendedor en terreno.** Los vendedores del incentivo (Susana, Matías…) viven en **LEQSIS**, no en nuestro `Vendor`. Por eso el motor de incentivos se construye sobre el **export de LEQSIS** como fuente de verdad, no sobre `Vendor.commission_rate`.

## Construido en este loop
- `backend/src/incentivos/leqsisImport.js` — parser CSV del export ventas-por-vendedor + agregación idempotente.
- `backend/src/incentivos/scoring.js` — puntaje, % meta, comisión, bono, ranking (lógica pura).
- `backend/src/incentivos/config.default.js` — reglas DEFAULT documentadas (las reales = NEEDS-INPUT).
- `backend/test/incentivos.test.js` + `test/fixtures/leqsis-ventas-vendedor.csv` — **6 tests verde**, incluido el gate de **reconciliación 1:1** con los montos reales de las fotos (Susana $17.040.681, Matías $10.741.950).
