# Fase A — Saneamiento + Reposición (módulo Inventario)

- **Fecha:** 2026-06-26
- **Estado:** Aprobado (diseño) — pendiente plan de implementación
- **Rama:** feat/wms-blueprint
- **Parte de:** roadmap de inventario A → B → C
  - **A (esta spec):** saneamiento + reposición / stock mínimo
  - **B (futuro):** lotes y trazabilidad + histórico de costos
  - **C (futuro):** conteo físico (cycle count)

## 1. Objetivo

Ordenar el módulo de Inventario y cerrar el gap de mayor ROI inmediato: la **reposición por stock mínimo**. El backend ya tiene `low-stock` pero no hay pantalla ni regla de reorden por producto. Esta fase:

1. Reorganiza el NAV de inventario en 3 subgrupos lógicos.
2. Agrega el modelo Min/Max y la pantalla de **Reposición**.
3. Sanea deuda técnica menor (selector de Ajustes, edición de stock no transaccional en Productos).

No toca arquitectura de datos profunda (lotes, costos históricos) — eso es Fase B.

## 2. Estado actual (resumen de la auditoría)

Módulo Inventario = 7 pantallas, todas funcionales: Productos, Precios, Recepción, Inventario (dashboard), FEFO, Ajustes, Kardex. El backend expone: `movements`, `adjust`, `receive`, `low-stock`, `expiring-soon`, `stock-summary`, `by-barcode`. Modelo `Product` ya tiene `stock/reserved/allocated`, `cost_price` (promedio ponderado), `expiry_date`, `location.sector`, `pricing.tiers`. Kardex (`StockMovement`) es inmutable y transaccional.

Deuda detectada que ataca esta fase:
- `Ajustes.jsx` usa `api.lowStock(99999, 500)` solo para poblar el selector de productos (abuso del endpoint).
- `Productos.jsx` edita `stock` como un ajuste *post-update* (no transaccional): si el ajuste falla, queda el producto editado sin movimiento en kardex.
- No existe regla de reorden por producto (`min_stock`) ni pantalla que use `low-stock`.

## 3. Diseño

### 3.1 Reorganización del NAV (`bodega/src/ui.jsx`)

El grupo plano `Inventario` se divide en 3 subgrupos (campo `group` de cada entrada de `NAV`). El `Sidebar` ya agrupa por el string `group` y respeta el orden del array, así que basta renombrar y reordenar:

| Subgrupo (`group`) | Ítems (`key`) en orden | Permiso |
|---|---|---|
| `Inventario · Catálogo` | productos, precios | products.manage |
| `Inventario · Movimiento` | recepcion, **reposicion** (nuevo), ajustes | inventory.adjust / inventory.read |
| `Inventario · Control` | inventario, fefo, kardex | inventory.read |

- Nueva entrada NAV: `{ key: "reposicion", ic: "🛟", label: "Reposición", perm: "inventory.read", group: "Inventario · Movimiento" }`, ubicada entre `recepcion` y `ajustes`.
- `ROLE_SCOPE.operator`: agregar `"reposicion"` (operador detecta faltantes).
- `ROLE_SCOPE.manager`: agregar `"reposicion"` (la decisión de comprar es gerencial).
- Decisión reversible: si los 3 headers saturan el sidebar, se revierte renombrando los 3 `group` de vuelta a `"Inventario"`.

### 3.2 Modelo Min/Max (`backend/src/models/Product.js`)

Dos campos nuevos, ambos en unidades, default 0, enteros ≥ 0:

```js
min_stock:    { type: Number, default: 0, min: 0 }, // punto de reorden
target_stock: { type: Number, default: 0, min: 0 }, // nivel objetivo al reponer
```

- **Bajo mínimo** ⇔ `min_stock > 0 && stock <= min_stock`.
- **Sugerido a comprar (unidades)** = `max(0, objetivo − stock)`, donde `objetivo = target_stock > 0 ? target_stock : 2 * min_stock`.
- `min_stock = 0` ⇒ el producto NO participa de reposición (opt-in explícito).

### 3.3 Endpoint de reposición (backend)

**Servicio** `inventoryService.listReorder({ limit })`:
- `Product.find({ is_active: true, min_stock: { $gt: 0 } })` con `.select("name sku barcode stock min_stock target_stock pricing.tiers vendor location").lean()`.
- Filtrar en JS `p.stock <= p.min_stock` (**no usar `$expr`** — rompe con `sanitizeFilter`, lección ya aprendida en `findByScan`).
- Por cada item calcular: `box_qty` (vía helper de tiers, igual que `getBoxQty`), `suggested_qty` (unidades), `suggested_boxes = ceil(suggested_qty / box_qty)`, `ratio = stock / min_stock`, `urgency` (`"critico"` si `stock<=0`, `"alto"` si `ratio<=0.5`, `"medio"` si no).
- Ordenar: `stock===0` primero, luego `ratio` ascendente.
- `limit` opcional (default 200, máx 500).

**Controller** `getReorderList` y **ruta** `GET /api/inventory/reorder` con `protect` + `requirePermission(INVENTORY_READ)`.

**Contrato de respuesta:**
```json
{
  "count": 12,
  "items": [
    {
      "_id": "...", "name": "Coca-Cola 1.5L", "sku": "CC15", "barcode": "7790...",
      "stock": 6, "min_stock": 24, "target_stock": 96,
      "suggested_qty": 90, "box_qty": 6, "suggested_boxes": 15,
      "urgency": "alto", "vendor": { "id": "...", "name": "Embonor" },
      "location": { "sector": "Bebidas", "code": "A-03-2" }
    }
  ]
}
```

### 3.4 Pantalla Reposición (`bodega/src/screens/Reposicion.jsx`, nueva)

- Carga `api.reorderList()`; fallback mock cuando `usingMock`.
- Estado vacío: "✅ Todo abastecido — ningún producto bajo su mínimo".
- Tabla ordenada por urgencia. Columnas: producto (+sector), stock actual, mínimo, **sugerido en `N cajas (M u)`**, proveedor, badge de urgencia con color (crítico rojo / alto naranja / medio amarillo).
- Por fila: checkbox de selección + input de cajas editable (default `suggested_boxes`).
- KPIs arriba: nº productos bajo mínimo, nº críticos (stock 0), nº proveedores involucrados.
- Acciones sobre la selección:
  - **Imprimir lista de compra** → `print.js` (lista agrupada por proveedor: producto, cajas, sector).
  - **Enviar a Recepción** → escribe el borrador en `sessionStorage` y navega a `recepcion`.

### 3.5 Puente Reposición → Recepción (borrador en `sessionStorage`)

- Clave: `b12_recepcion_draft`.
- Valor: `JSON.stringify([{ product_id, barcode, name, box_qty, cajas }])`.
- Helpers en `bodega/src/api.js`: `setRecepcionDraft(items)`, `takeRecepcionDraft()` (lee y **borra** la clave, one-shot).
- `Recepcion.jsx` en el `mount` llama `takeRecepcionDraft()`; si hay items, siembra sus filas (mapeadas a la forma interna de fila de Recepción) y queda listo para confirmar. No se toca el router (la app navega por estado en `App.jsx`).

### 3.6 Alerta en dashboard (`bodega/src/screens/Inventario.jsx`)

- Llamada extra a `api.reorderList()` (solo para el conteo).
- Banner/KPI: "🛟 N productos bajo mínimo" → clic ejecuta `onNav("reposicion")`.
- Si `count === 0`, no se muestra el banner. (Surface en Gerencia = opcional, fuera de Fase A.)

### 3.7 Setear mínimos (`bodega/src/screens/Productos.jsx` + backend)

- Form de Productos: 2 inputs nuevos (Stock mínimo / Nivel objetivo), opcionales, default 0, en la sección de stock.
- Incluirlos en el payload de create y update.
- Backend: agregar `min_stock` y `target_stock` a los schemas de validación de create y de update (rol manager) en el controller de productos, sin romper los existentes.

### 3.8 Saneamiento de deuda menor

- **`Ajustes.jsx`:** quitar `api.lowStock(99999, 500)`. Reemplazar el `<select>` por un buscador: input de texto → `api.products({ search, limit: 20, include_inactive: false })` con debounce → lista de resultados → seleccionar producto. El resto del formulario (tipo, cantidad, motivo, submit a `api.adjust`) no cambia.
- **`Productos.jsx`:** quitar la edición directa de `stock` en el UPDATE (elimina el path no transaccional de líneas ~244-247). El `stock` inicial se mantiene en el CREATE. En el modo edición se muestra el stock como **solo lectura** con una nota: "El stock se mueve por Recepción o Ajustes". `min_stock`/`target_stock` sí son editables.
- **Inventario ↔ FEFO:** sin cambio funcional; el widget de "por vencer" del dashboard ya cumple el rol de resumen y enlaza a FEFO.

## 4. Componentes y responsabilidades

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `Product.min_stock/target_stock` | Regla de reorden por producto | — |
| `inventoryService.listReorder` | Calcular qué reponer y cuánto | Product, helper box_qty |
| `GET /inventory/reorder` | Exponer la lista (perm read) | listReorder |
| `api.reorderList` | Cliente del endpoint | fetch wrapper |
| `Reposicion.jsx` | UI de reposición + lista de compra | reorderList, draft, print |
| `set/takeRecepcionDraft` | Puente one-shot Reposición→Recepción | sessionStorage |
| `Recepcion.jsx` (mount) | Sembrar filas desde el borrador | takeRecepcionDraft |
| `Inventario.jsx` (banner) | Alertar bajo mínimo | reorderList |
| `Productos.jsx` (form) | Setear mínimos; stock RO en edición | updateProduct |
| `Ajustes.jsx` (buscador) | Elegir producto sin abusar low-stock | products(search) |

## 5. Flujos

1. **Ver qué reponer:** Reposición → `GET /inventory/reorder` → tabla por urgencia.
2. **Comprar:** seleccionar filas + ajustar cajas → "Enviar a Recepción" → draft en sessionStorage → navega a Recepción ya sembrada → confirmar recepción (flujo existente, atómico, costo promedio).
3. **Imprimir:** seleccionar filas → "Imprimir lista de compra" → PDF/print agrupado por proveedor.
4. **Definir mínimos:** Productos → editar → Stock mínimo / Nivel objetivo → guardar.
5. **Ajuste manual:** Ajustes → buscar producto → tipo + cantidad + motivo → `POST /inventory/adjust` (atómico + kardex).

## 6. Manejo de errores

- `listReorder`: si no hay productos con `min_stock>0` → `{ count: 0, items: [] }` (la UI muestra "todo abastecido").
- Reposición sin selección → botones de acción deshabilitados.
- Draft con `product_id` inexistente al sembrar Recepción → se omite esa fila silenciosamente.
- Buscador de Ajustes sin resultados → "Sin coincidencias"; submit deshabilitado hasta elegir producto.
- Productos: `min_stock`/`target_stock` no enteros o negativos → rechazo de validación backend + hint en el form.
- Endpoint protegido: sin `inventory.read` → 403 (manejado por el wrapper que ya setea `err.status`).

## 7. Verificación

Sin tests automatizados nuevos en esta fase (Testing global está 🔴 sin CI; se aborda aparte). Verificación por:
- **API:** crear/editar producto con `min_stock`, consultar `GET /inventory/reorder`, validar `suggested_qty`/`suggested_boxes`/orden.
- **Preview en vivo:** Reposición lista correcta, "Enviar a Recepción" siembra filas, "Imprimir" genera la lista, banner del dashboard aparece/desaparece según conteo, Ajustes busca y ajusta, Productos guarda mínimos y muestra stock RO.
- **Build** del frontend antes de declarar hecho.

## 8. Fuera de alcance (Fase A)

- Lotes/batches, FEFO por lote, item de orden ligado a lote, histórico de costos (Fase B).
- Conteo físico / cycle count (Fase C).
- Reorden automático que emita orden al proveedor (solo se arma lista de compra manual).
- `last_received_at` por producto en la lista de reposición (nice-to-have, posible iteración).
- Exportar a Excel/CSV la lista de compra (por ahora solo imprimir).

## 9. Riesgos

- **Validación de productos:** agregar campos al schema de update podría chocar con la validación estricta existente → revisar el schema del controller antes de editar.
- **Forma de fila de Recepción:** el sembrado debe respetar la estructura interna exacta de las filas de `Recepcion.jsx` → leer el componente antes de implementar el puente.
- **Sidebar con 7 grupos:** posible saturación visual; mitigado porque los grupos son plegables y el estado persiste; revertible.
