# DECISIONS.md — Supuestos y defaults documentados

> Defaults usados para no quedarse parado. Cada uno se reemplaza apenas el
> cliente entregue el dato real (ver BLOCKERS.md).

- **D1 — Formato del export LEQSIS:** se asume CSV con cabecera y columnas
  `vendedor,documento,fecha,monto` (fila por documento). Real = B1.
- **D2 — Comisión del vendedor en terreno ≠ `Vendor.commission_rate`.** `Vendor`
  es el seller del marketplace (Bodega 12 como tienda), no el vendedor en terreno.
  Por eso la comisión del incentivo se calcula con `comisionRate` de
  `config.default.js` sobre la venta del export, NO con `Vendor.commission_rate`.
  Real = B2.
- **D3 — Reglas de incentivo DEFAULT:** meta $15.000.000, comisión 1%, bono
  $200.000 al 100% de meta, 1 punto por cada 1% de meta + 1 por documento.
  Reales = B2.
- **D4 — Identidad del vendedor:** se usa el nombre tal como viene en el export
  (clave de agregación). Si LEQSIS tiene código de vendedor, se migra a ese.
- **D5 — Idempotencia:** dedupe por `vendedor::documento` para que una re-subida
  del mismo export no infle cifras. La persistencia real (upsert por documento)
  queda pendiente (F1.1).
- **D6 — Aislamiento:** el módulo `src/incentivos/` es nuevo y aislado; NO toca
  rutas/servicios de producción (regla: no romper la operación). Sin dependencia
  de Mongo todavía — es lógica pura testeable.
