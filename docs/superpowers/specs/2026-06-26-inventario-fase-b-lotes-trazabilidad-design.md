# Fase B — Lotes y trazabilidad (módulo Inventario)

- **Fecha:** 2026-06-26
- **Estado:** Aprobado para ejecución autónoma (CEO: "sigue con todo hasta finalizar")
- **Rama:** feat/wms-blueprint
- **Depende de:** Fase A (commit db58400)

## 1. Principio rector: capa ADITIVA, nunca bloqueante

`Product.stock` sigue siendo la **única fuente de verdad de disponibilidad**. NO se toca el camino de carrito→checkout→pick (`reserved`/`allocated`, `commitPick`, `stock_committed`). Los lotes (`Batch`) son un **ledger paralelo** que aporta: multi-vencimiento por producto, FEFO por lote, costo por lote (histórico) y trazabilidad de qué lote salió en cada pedido.

**Invariante de seguridad:** el consumo de lotes en el pick/merma es *best-effort*. Si los lotes no cubren la cantidad (productos legacy con stock pero sin lotes), se consume lo que haya y se continúa — **jamás se lanza error ni se bloquea la salida**. `sum(batch.qty_remaining)` puede divergir de `Product.stock`; es tolerable porque stock es autoritativo.

## 2. Modelo nuevo: `backend/src/models/Batch.js`

```js
{
  product_id: ObjectId(ref Product),   // indexed
  product_name: String,                // snapshot
  lot_code: String,                    // proveedor o autogenerado (R{YYMMDD}-{seq})
  qty_received: Number,                // unidades al recibir
  qty_remaining: Number,               // unidades sin consumir (>=0)
  unit_cost: Number,                   // costo de compra de ESTE lote
  expiry_date: Date | null,
  location: { sector, zone, rack, level, code },  // snapshot
  supplier: String,
  doc_ref: String,
  status: "open" | "depleted",         // depleted cuando qty_remaining===0
  received_at: Date,
  received_by: { user_id, role, label },
  created_at / updated_at
}
```
Índices: `{ product_id:1, status:1, expiry_date:1 }` (FEFO por producto), `{ status:1, expiry_date:1 }` (FEFO global), `{ product_id:1, received_at:-1 }` (histórico de costos).

`lot_code`: si la recepción no lo provee, autogenerar `R{YYMMDD}-{n}` (n vía modelo `Counter` existente o índice de línea + doc_ref). Backend puede usar `Date` normalmente.

## 3. Cambios backend (aditivos)

### 3.1 `receiveStock` (`inventoryService.js:164-270`)
Dentro de la **misma transacción** que ya incrementa `Product.stock` y recalcula `cost_price`:
- Tras el `findOneAndUpdate` del producto (línea ~227), **crear un `Batch`** por línea recibida con `qty_received=qty_remaining=units`, `unit_cost=costo_nuevo` de la línea, `expiry_date`, `location`, `supplier`, `doc_ref`, `lot_code`, `received_by`, `status:"open"`.
- Recalcular `Product.expiry_date` = menor `expiry_date` entre los batches `open` del producto (helper `recomputeProductExpiry(productId, session)`), para que el FEFO-lite y los dashboards sigan coherentes.
- El kardex RECEIVING existente (línea ~236) no cambia; opcional: agregar `batch_id` al movimiento.

### 3.2 `commitOrderPick` (`orderService.js:1296-1348`)
Dentro de la transacción existente, tras `commitPick` de cada item (que ya baja `stock`/`allocated`):
- **Consumir lotes FEFO** (helper `consumeBatchesFEFO({ productId, quantity }, session)`): toma batches `open` del producto ordenados por `expiry_date` asc (nulls al final), descuenta `qty_remaining` hasta cubrir `quantity`; marca `depleted` los que llegan a 0; devuelve `[{ batch_id, lot_code, qty }]`.
- Guardar el resultado en `item.batches` (campo nuevo, ver 3.4) → trazabilidad pedido→lote.
- Recalcular `Product.expiry_date` tras el consumo.
- **Best-effort:** si `consumeBatchesFEFO` no cubre todo, registra lo consumido y sigue. Envolver en try/catch que loguea pero NO propaga (no romper el pick).

### 3.3 `adjustStock` (`inventoryService.js:103-156`)
- `delta < 0` (merma): tras decrementar stock, consumir lotes FEFO best-effort por `-delta` (la merma sale del lote más próximo a vencer).
- `delta > 0` (conteo a favor): NO crear lote (corrección de lote desconocido). Solo stock + kardex como hoy.

### 3.4 Item de orden (`Order.js:15-59`)
Agregar al `orderItemSchema` (aditivo, opcional):
```js
batches: [{ batch_id: ObjectId, lot_code: String, qty: Number }]  // _id:false
```

### 3.5 Endpoints nuevos (`inventoryRoutes.js` + controller + service)
- `GET /inventory/lotes` — lista batches con filtros `product_id`, `status` (default open), `q` (nombre/lote), paginado. Para la pantalla Lotes / histórico de costos. Perm `inventory.read`.
- `GET /inventory/lotes/expiring?days=N` — batches `open` con `expiry_date<=hoy+N`, orden expiry asc, con `days_left`, `qty_remaining`, producto, lote, ubicación. Perm `inventory.read`. (FEFO por lote.)
- Servicio: `listBatches({...})`, `listExpiringBatches({days})`, helpers `consumeBatchesFEFO`, `recomputeProductExpiry`.
- `listExpiringSoon` (producto-nivel) se mantiene para el widget del dashboard.

## 4. Cambios frontend (aditivos)

### 4.1 Pantalla nueva `bodega/src/screens/Lotes.jsx` (Inventario · Control)
- `api.lotes({...})`. Tabla: producto, lote, vencimiento (badge días), `qty_remaining/qty_received`, **costo unit.**, ubicación, recibido (fecha + por quién), proveedor/doc.
- Filtros: buscar (producto/lote), estado (open/depleted/todos), por producto.
- Doble función: **trazabilidad** (qué lotes hay y de dónde) e **histórico de costos** (costo por compra a lo largo del tiempo). KPIs: nº lotes abiertos, valor de inventario por costo (Σ qty_remaining×unit_cost), nº por vencer ≤30d.
- NAV: entrada `{ key:"lotes", ic:"🏷️"→"🧫"/"📦", label:"Lotes", perm:"inventory.read", group:"Inventario · Control" }`. Agregar a ROLE_SCOPE operator+manager. App.jsx import + TITLES + render.

### 4.2 `FEFO.jsx` → FEFO por lote
- Cambiar a `api.lotesExpiring(60)`: filas por LOTE (no por producto), con lote, vencimiento, `qty_remaining`, ubicación, colores de urgencia. Si un producto no tiene lotes (legacy), fallback a `api.expiringSoon` para no perder cobertura. Encabezado aclara "por lote".

### 4.3 `Recepcion.jsx` — campo lote opcional por línea
- Agregar input "Lote" opcional por fila (junto a costo/vencimiento/ubicación). Se manda en el payload de `receiveStock` por item. Si vacío, el backend autogenera el `lot_code`.

### 4.4 Trazabilidad en el detalle de pedido
- Donde se vea el detalle de una orden (Pedidos / Picking), mostrar por ítem los lotes consumidos (`item.batches`: "Lote R260626-3 · 12 u"). Si no hay (legacy), no mostrar nada. Aditivo, sin cambiar el layout existente.

## 5. Componentes y responsabilidades

| Unidad | Responsabilidad |
|---|---|
| `Batch` (modelo) | Ledger de lotes recibidos: cantidad, costo, vencimiento, ubicación, estado |
| `receiveStock` (+batch) | Crear lote por línea recibida en la misma txn; recomputar expiry del producto |
| `consumeBatchesFEFO` | Descontar lotes por vencimiento (best-effort), devolver consumo |
| `recomputeProductExpiry` | Mantener `Product.expiry_date` = menor expiry de lotes open |
| `commitOrderPick` (+batch) | Consumir lotes al pickear y anotar `item.batches` (trazabilidad) |
| `adjustStock` (merma) | Restar lotes FEFO en mermas; no crear lote en conteo a favor |
| `listBatches` / `listExpiringBatches` | Datos para Lotes y FEFO-por-lote |
| `Lotes.jsx` | Trazabilidad + histórico de costos + valor de inventario a costo |
| `FEFO.jsx` (lote) | Despacho FEFO preciso por lote |
| `Recepcion.jsx` (lote) | Capturar lote de proveedor opcional |

## 6. Manejo de errores

- `consumeBatchesFEFO` y la creación de batches en pick/merma van en try/catch que loguea y **no propaga** (la salida de stock nunca debe fallar por la capa de lotes).
- `receiveStock`: si la creación del batch falla dentro de la txn, la txn revierte (recepción atómica) — aquí SÍ es parte de la transacción porque es entrada, no salida.
- Productos legacy sin lotes: FEFO y Lotes los muestran vía fallback producto-nivel; el pick consume lo que haya y sigue.
- `Product.expiry_date` recomputado puede quedar null si no hay lotes con fecha — válido.

## 7. Verificación

Sin tests automatizados nuevos. Verificación por API + preview en vivo contra backend real:
- Recibir mercadería → se crea Batch, `Product.expiry_date` = menor lote, costo del lote guardado.
- Recibir el mismo producto 2 veces con vencimientos distintos → 2 lotes, FEFO los ordena.
- Pickear una orden → `consumeBatchesFEFO` baja el lote más próximo, `item.batches` registra el lote, lote llega a `depleted`.
- Merma vía Ajustes → baja del lote FEFO.
- Pantalla Lotes lista y suma valor a costo; FEFO por lote; Recepción captura lote.
- Build + lint OK.

## 8. Fuera de alcance (Fase B)

- Costeo COGS FIFO/FEFO estricto por lote en Finanzas (hoy `cost_price` promedio se mantiene; los lotes guardan costo para futuro). 
- Reconciliación automática `sum(batches)` vs `Product.stock` (se tolera drift; stock autoritativo).
- Serie/serial por unidad. Devolución que "reingresa" a un lote específico.
- Conteo físico (Fase C).

## 9. Riesgos

- **Drift lotes↔stock:** mitigado por diseño (stock autoritativo, lotes best-effort, indicador opcional en Lotes).
- **Performance del consumo FEFO en pick:** acotado (pocos lotes por producto); índice `{product_id,status,expiry_date}`.
- **Recepción atómica:** el batch entra en la txn de `receiveStock`; verificar que el fallback standalone (dev) no deje stock sin lote (best-effort en dev; ACID en prod replica set).
