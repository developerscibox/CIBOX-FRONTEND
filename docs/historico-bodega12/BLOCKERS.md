# BLOCKERS.md — Cola NEEDS-INPUT (la agenda con Giovanni)

> Lo que necesitamos del cliente para avanzar. Este es el entregable más valioso
> del loop: cada ítem tiene la pregunta precisa y qué desbloquea.

## 🔴 Bloquea el motor de incentivos (el gancho)

### B1 — Export real de "ventas por vendedor" de LEQSIS
- **Pregunta:** ¿Nos pueden dar un **export real** (Excel/CSV) de ventas-por-vendedor de un período? Necesitamos ver las **columnas exactas** (nombre/código de vendedor, documento/folio, fecha, monto neto/total).
- **Desbloquea:** fijar el parser definitivo. Hoy el importador asume columnas `vendedor,documento,fecha,monto` (documentado); si difieren, se ajusta en minutos.
- **Estado:** el parser y la reconciliación 1:1 **ya funcionan** contra un fixture con esos montos; solo falta calzar al formato real.

### B2 — Reglas reales del programa de incentivos (hoy en Excel)
- **Pregunta:** ¿Cómo calculan HOY en su Excel? Necesitamos: **meta** por vendedor (¿fija, por categoría, por historial?), **comisión** (¿% plano, por tramos, mixta?), **bonos** (¿umbral y monto?), y el **esquema de puntos** si existe.
- **Desbloquea:** que las cifras del tablero sean las reales, no defaults. Hoy se usan defaults documentados en `config.default.js` (meta $15M, comisión 1%, bono $200k al 100%).

### B3 — Alcance ampliado: KPIs de bodega y cajeros
- **Contexto:** ya se decidió incentivar a **todos** (vendedores + bodega + cajeros).
- **Pregunta:** ¿Qué se mide y de qué fuente? Bodega: ¿pedidos preparados, exactitud de picking, tiempo? (fuente: nuestro WMS). Cajeros: ¿exactitud de caja, nº transacciones, velocidad? (fuente: caja). ¿Metas/bonos por rol?
- **Desbloquea:** extender el motor a las 3 "ligas".

## 🔴 Bloquea la interoperación con LEQSIS

### B4 — Método de intercambio con LEQSIS
- **Pregunta:** ¿Cómo intercambiamos datos? (a) export/import CSV manual, (b) carpeta de intercambio automática, (c) acceso a su base de datos, (d) API de su nueva web.
- **Desbloquea:** automatizar el importador (hoy es carga manual de archivo) y la devolución de pedidos web para el DTE.

### B5 — Mapeo de los 5 niveles de precio → tipo de cliente
- **Pregunta:** ¿A qué tipo de cliente corresponde cada uno de los 5 precios de LEQSIS? (los tenemos como `pricing.tiers` por cantidad).
- **Desbloquea:** que la tienda B2B y la app de terreno muestren el precio correcto por cliente.

## 🟡 Bloquea fases posteriores (no urgente para el gancho)

### B6 — Reglas/cupos de crédito (Fase 2)
- **Pregunta:** ¿Cómo asignan cupo de crédito por cliente? ¿condiciones, plazos, manejo de cheques?
- **Desbloquea:** el módulo de cuentas corrientes/cobranza.

### B7 — Proveedor DTE (Fase 3, regulado)
- **Pregunta:** ¿Con qué proveedor DTE integramos (OpenFactura / Lioren / LibreDTE self-host)? Necesitamos **credenciales y certificado digital**.
- **Desbloquea:** reemplazar el `siiService` stub por emisión real. **No se construye emisión, certificado ni CAF sin esto.**

## 🟢 Decisiones de negocio (no técnicas)

### B8 — Modelo comercial de Fase 1
- **Pregunta:** ¿cerramos en $300/caja, o $/caja + mensualidad creciente? (ver §8 del plan).
