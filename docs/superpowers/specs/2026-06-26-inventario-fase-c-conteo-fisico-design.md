# Fase C — Conteo físico (cycle count) — módulo Inventario

- **Fecha:** 2026-06-26
- **Estado:** Aprobado para ejecución autónoma (CEO: "sigue con todo hasta finalizar")
- **Rama:** feat/wms-blueprint
- **Depende de:** Fase A (db58400) y Fase B (3e35c9c)

## 1. Objetivo

Permitir el **conteo físico cíclico** de inventario: el operador inicia un conteo por sector/categoría, registra las cantidades reales (con escaneo), ve las diferencias contra el teórico, y al cerrar el conteo el sistema **aplica los ajustes** dejando el stock igual a lo contado. Reusa `adjustStock` (atómico, kardex, consumo FEFO de lotes en negativos) — sin tocar el núcleo.

**Principio:** el conteo físico es AUTORITATIVO. Al cerrar, `stock := contado`. El "teórico" capturado al iniciar es solo informativo (mostrar la diferencia mientras se cuenta).

## 2. Modelo nuevo: `backend/src/models/CycleCount.js`

```js
{
  scope: { type: "sector"|"category"|"all", value: String, label: String },
  status: "open" | "closed" | "cancelled",   // default open
  lines: [{                                   // _id:false
    product_id, product_name, sku, barcode,
    theoretical_qty: Number,   // snapshot de Product.stock al iniciar
    counted_qty: Number|null,  // ingresado por el operador (null = sin contar)
    counted: Boolean,          // true cuando se ingresó una cantidad
  }],
  created_by: { user_id, role, label },
  closed_by: { user_id, role, label } | null,
  applied: { lines_adjusted: Number, units_delta: Number } | null,  // resumen al cerrar
  created_at, updated_at, closed_at
}
```
Índice: `{ status: 1, created_at: -1 }`.

`diff` por línea = `counted_qty - theoretical_qty` se calcula en el front/servicio (no se persiste; es derivado).

## 3. Servicio nuevo: `backend/src/services/cycleCountService.js`

- `startCount({ scope, by })` — resuelve los productos del scope (sector → `location.sector`; category → `category.id`/`category_ids`; all → todos los `is_active`), snapshotea `theoretical_qty = stock`, crea la sesión `open` con líneas (counted_qty=null). Rechaza si ya hay un conteo `open` con el mismo scope (un conteo activo por scope).
- `listCounts({ status, limit })` — sesiones (open + recientes cerradas).
- `getCount(id)` — una sesión con sus líneas.
- `updateCountLines({ id, counts, by })` — `counts` = `[{ product_id, counted_qty }]`; setea counted_qty/counted en las líneas correspondientes. Solo sobre conteos `open`.
- `closeCount({ id, by })` — para cada línea `counted` con `counted_qty != stock_actual`: `adjustStock({ productId, delta: counted_qty - stock_actual_al_cerrar, reason: "Conteo físico #<id>", by })`. Acumula `lines_adjusted`/`units_delta`. Marca `closed`, setea `closed_by`/`closed_at`/`applied`. Líneas sin contar se ignoran. **El delta se calcula contra el stock ACTUAL al cerrar** (no el snapshot) para que el conteo sea autoritativo aunque haya habido movimiento. Cada `adjustStock` es atómico e independiente; si uno falla (p. ej. concurrencia), se loguea y se sigue con los demás (best-effort por línea), y el resumen refleja lo aplicado.
- `cancelCount({ id, by })` — marca `cancelled` sin ajustar.

## 4. Endpoints (`inventoryRoutes.js` + `inventoryController.js`)

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/inventory/counts` | inventory.adjust |
| GET | `/inventory/counts` | inventory.read |
| GET | `/inventory/counts/:id` | inventory.read |
| PATCH | `/inventory/counts/:id` | inventory.adjust |
| POST | `/inventory/counts/:id/close` | inventory.adjust |
| POST | `/inventory/counts/:id/cancel` | inventory.adjust |

Respuestas estilo existente `{ success:true, data:{...} }`.

## 5. Frontend: `bodega/src/screens/Conteo.jsx` (Inventario · Movimiento)

- **Sin conteo abierto:** tarjeta "Iniciar conteo" con selector de scope (Sector / Categoría / Todo el inventario) — sector y categoría se eligen de listas (sectores desde productos, categorías desde `api.categories`). Botón "Iniciar".
- **Con conteo abierto:** 
  - Cabecera: scope, progreso `contados/total`, suma de diferencias.
  - Buscador/escaneo para saltar a un producto y registrar su cantidad rápido.
  - Tabla de líneas: producto, teórico, **input contado**, diff (color: 0 gris, + verde, − rojo), estado. Guardado progresivo (PATCH al salir del input / con debounce).
  - Acciones: "Cerrar y aplicar ajustes" (confirma: "Se ajustarán N productos, Δ M unidades") → `close` → muestra resumen. "Cancelar conteo".
- **Historial:** lista de conteos cerrados recientes (scope, fecha, líneas ajustadas, Δ unidades).
- `api.js`: `startCount(scope)`, `counts(params)`, `count(id)`, `saveCounts(id, counts)`, `closeCount(id)`, `cancelCount(id)`.
- NAV (`ui.jsx`): `{ key:"conteo", ic:"📋", label:"Conteo físico", perm:"inventory.adjust", group:"Inventario · Movimiento" }` (junto a recepción/reposición/ajustes). ROLE_SCOPE operator + manager. App.jsx import + TITLES + render.

## 6. Componentes y responsabilidades

| Unidad | Responsabilidad |
|---|---|
| `CycleCount` (modelo) | Sesión de conteo: scope, líneas (teórico/contado), estado |
| `startCount` | Snapshot de productos del scope como líneas |
| `updateCountLines` | Registrar cantidades contadas |
| `closeCount` | Aplicar ajustes (count autoritativo) vía adjustStock, best-effort por línea |
| `Conteo.jsx` | UI de conteo: iniciar, contar (scan), ver diffs, cerrar, historial |

## 7. Manejo de errores

- Iniciar con scope vacío / sin productos → conteo con 0 líneas (UI avisa "sin productos en el scope").
- Un conteo `open` por scope a la vez (rechaza duplicado).
- PATCH/close sobre conteo no-open → 409.
- `closeCount`: cada `adjustStock` independiente; fallo de uno (concurrencia / stock insuficiente para llevar a negativo imposible — no aplica, el delta lleva a `counted_qty>=0`) se loguea y no aborta el resto.
- counted_qty negativo → rechazo de validación (>=0).

## 8. Verificación

E2E contra backend real: iniciar conteo (scope sector) → snapshot correcto; registrar cantidades con diff; cerrar → `adjustStock` aplicado, `stock == counted`, kardex con "Conteo físico", lotes consumidos en negativos; historial muestra el cerrado. UI: iniciar/contar/cerrar/cancelar, progreso y diffs. Build + lint OK.

## 9. Fuera de alcance (Fase C)

- Conteo a ciegas (sin mostrar teórico) / doble conteo / aprobación.
- Conteo por lote individual (se cuenta a nivel producto; el ajuste negativo consume lotes FEFO vía adjustStock de Fase B).
- Programación recurrente automática de conteos.

## 10. Riesgos

- **Drift por movimiento durante el conteo:** mitigado porque el delta se calcula contra el stock ACTUAL al cerrar (no el snapshot).
- **Conteo de "todo" con catálogo grande:** Bodega12 ~60 productos; trivial. Para catálogos grandes, paginar la UI (futuro).
