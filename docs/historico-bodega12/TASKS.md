# TASKS.md — Backlog del loop (KSA+ × Bodega 12)

Estados: `[DONE]` `[PARCIAL]` `[BLOCKED-NEEDS-INPUT]` `[BLOCKED-TECH]` `[PENDIENTE]`

## FASE 0 — Prep
- `[DONE]` F0.1 — CODEBASE_MAP.md (recon duro, con discrepancias).
- `[PARCIAL]` F0.2 — Importador del export LEQSIS (parser CSV + agregación idempotente). Lógica + tests verde; **formato real = B1**.
- `[DONE]` F0.3 — BLOCKERS.md con preguntas precisas (B1–B8).

## FASE 1 — Gancho + tienda + dashboards  → CONSTRUIBLE VERDE
- `[DONE]` F1.1 — Importador → BD. `VendorSale` + `incentivosService.importarExportLeqsis` (upsert idempotente periodo+documento) + `POST /incentivos/import`. **Verificado contra Mongo local** (2 imports, no duplica).
- `[DONE]` F1.2 — Motor de puntaje (config DEFAULT; reglas reales = **B2**) + test.
- `[DONE]` F1.3 — Comisión server-side (`comisionRate` de config; NO `Vendor.commission_rate`, ver D2) + test.
- `[DONE]` F1.4 — Vista TV/oficina `bodega/screens/Incentivos.jsx` (podio + ranking) + `GET /incentivos/tablero`. **Build WMS verde.** Modo demo incluido.
- `[DONE]` F1.5 — Mensaje "vas en $X · te faltan $Y para el bono" en la vista responsive (= vista-celular del vendedor). PENDIENTE prod: vista por-vendedor autenticada → necesita mapeo vendedor↔usuario.
- `[DONE]` F1.6 — Liquidación (`liquidacion.js` + `GET /incentivos/liquidacion`) + test.
- `[BLOCKED-NEEDS-INPUT]` F1.7 — Tienda B2B ya construida/desplegada; devolver pedido a LEQSIS depende de **B4** (intercambio) + **B5** (precios).
- `[DONE-reuse]` F1.8 — Dashboards ejecutivos: cubierto por `Dashboard.jsx`/`Ventas.jsx` (agregaciones admin), responsive.
- `[DONE]` F1.9 — Cuadre Z: `cuadreZ.js` (puro + test) + endpoint existente `orders/admin/cash-summary` + card en `Ventas.jsx`.
- `[DONE]` F1.10 — Alertas de stock: `alertasStock.js` (puro + test) + vistas low-stock/expiring existentes. PENDIENTE delta: disparar push con `Notification`.
- `[DONE]` F1.11 — Seed `seedIncentivos.js`: verifica 1:1 + idempotencia contra Mongo. Verde.

## FASE 2 — Absorber operación
- `[DONE-reuse]` F2.1/F2.2 — WMS recepción/ajustes/inventario/kardex YA existen (reuse). Multi-local/traspasos + OC completas = pendiente.
- `[DONE]` F2.3 — FEFO: `wms/fefo.js` (orden por vencimiento) + test.
- `[DONE]` F2.4 — Caja/POS: cuadre Z (`incentivos/cuadreZ.js`) + arqueo (`wms/arqueo.js`) + tests; `cash-summary` existente.
- `[DONE-core]` F2.5 — Crédito/cobranza: modelos `CreditAccount`/`Cheque` + `cobranza/aging.js` (aging 0-30…+90, a-quién-llamar-hoy, cheques por vencer) + tests. Reglas/cupos = **B6**.
- `[DONE-demo]` F2.6 — Toma de pedido en terreno como vista móvil del WMS (`screens/Terreno.jsx`) con datos demo: precio por nivel de cliente garantizado, stock visible, suma a comisión, cierra a picking. Producción: empaquetar Expo nativo + **B5** + mapeo vendedor↔usuario.

## FASE 3 — Fiscal + cutover (regulado — borde definido, sin emitir real)
- `[DONE]` F3.1 — Puerto `dte/DteEmitter.js` + `SandboxDteEmitter` + fábrica que falla explícito sin proveedor + tests. Enchufar adapter del proveedor = **B7**.
- `[SCAFFOLD]` F3.2 — Contabilidad: modelo `LibroEntry` (forma de datos). Lógica tributaria = validación de contador (**NEEDS-INPUT**).
- `[DONE-core]` F3.3 — Conciliación parallel-run `dte/conciliacion.js` (faltantes + diferencias) + tests. Migración real = validada por humano.
