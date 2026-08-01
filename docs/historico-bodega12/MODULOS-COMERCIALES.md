# Módulos comerciales — Bodega 12 / KSA+

Guía para armar la oferta por módulos. Cada módulo agrupa pantallas reales del
panel (keys del `NAV` de `bodega/src/ui.jsx`), roles involucrados y su forma de
activación. **A · Tienda Web es la base**: B, C y D son upsells que se montan
sobre ella.

## Cómo se activa un módulo

Variable de entorno del backend:

```
MODULES_ENABLED=web,bodega,sala,gerencia   # default: todos
```

- CSV con los módulos contratados: `web` (A), `bodega` (B), `sala` (C), `gerencia` (D).
- Los frontends consultan `GET /api/config/modules` (público) y reciben
  `{ success: true, data: { enabled: ["web", "bodega", "sala", "gerencia"] } }`
  para ocultar los menús no contratados.
- Cambiar el plan de un cliente = cambiar la variable y reiniciar el backend.
  Sin migraciones, sin tocar código.

---

## A · Tienda Web (base — módulo `web`)

Lo mínimo para vender por internet con retiro en tienda: la tienda pública más
el back-office justo para operarla.

**Tienda pública (cliente final)**: catálogo, carrito, checkout (Webpay /
transferencia), seguimiento del pedido, retiro en tienda.

**Pantallas del panel** (keys del NAV):

| Key | Pantalla | Para qué |
|---|---|---|
| `pedidos` | Pedidos | ver y gestionar los pedidos web |
| `calendario` | Calendario retiros | agenda de retiros en tienda |
| `retiro` | Retiro / Mostrador | entregar el pedido al cliente |
| `productos` | Productos | ficha, fotos, import/export del catálogo |
| `precios` | Precios y márgenes | precios por caja/unidad y márgenes |
| `recepcion` | Recepción | ingreso de mercadería (básico) |
| `ajustes` | Ajuste de stock | correcciones con motivo |
| `inventario` | Inventario | resumen de stock |
| `usuarios` | Usuarios | alta/baja de cuentas y roles |
| *(contenido)* | Contenido de la home (CMS) | banners, tarjetas y textos vía `PUT /api/content/home` |

**Roles / permisos**: `admin` (todo), `manager` opcional. Permisos:
`orders.read`, `orders.deliver`, `products.manage`, `inventory.read`,
`inventory.adjust`, `users.manage`.

### "Si el cliente solo quiere la web, ¿qué le dejo?"

`MODULES_ENABLED=web`. Le queda: **tienda pública + pedidos, productos +
precios + ficha + import, recepción + ajustes + inventario resumen, retiro,
contenido (CMS) y usuarios.** Con eso opera venta online completa con retiro
en tienda. No ve: picking profesional, FEFO/lotes/conteo (B), venta presencial
ni caja (C), ni reportes gerenciales (D).

---

## B · Bodega Pro (upsell — módulo `bodega`)

Operación profesional de bodega: preparación de pedidos con escaneo,
trazabilidad por lote y control de inventario cíclico. Requiere A.

**Pantallas del panel**:

| Key | Pantalla | Para qué |
|---|---|---|
| `dashboard` | Resumen | tablero operativo del día |
| `picking` | Picking | preparación con escaneo, checklist por sector, packing, faltantes |
| `reposicion` | Reposición | productos bajo su mínimo (min/max) |
| `conteo` | Conteo físico | inventario cíclico con cierre y ajuste |
| `fefo` | FEFO · por vencer | prioridad de salida por vencimiento |
| `lotes` | Lotes y costos | trazabilidad por lote e histórico de costos |
| `kardex` | Movimientos | kardex completo de entradas/salidas |

**Roles / permisos**: `operator` (bodeguero). Permisos: `orders.prepare`,
`inventory.read`, `inventory.adjust`.

**Dependencias**: requiere A (los pedidos que se pickean nacen en la web o en
sala). Recomendado para C: sin B, el pedido pagado pasa de caja directo a
retiro sin picking controlado.

---

## C · Venta en Sala (upsell — módulo `sala`)

El relay presencial de 4 roles: vendedor toma el pedido → cajera cobra →
bodega prepara → mostrador entrega. Con fila de turnos e impresión central de
boletas. Requiere A; se potencia con B.

**Pantallas del panel**:

| Key | Pantalla | Para qué |
|---|---|---|
| `venta-sala` | Tomar pedido | el vendedor arma el pedido en sala (móvil) |
| `mis-metricas` | Mis métricas | métricas propias del vendedor (incentivos) |
| `historial` | Mi historial | ventas propias del vendedor |
| `turnos` | Turnos / Fila | fila de atención y tablero público |
| `caja` | Caja | cobro (efectivo/tarjeta) y cuadre de caja |
| `cierrez` | Cierre Z | cierre diario de caja |
| `impresion` | Impresión central | boletas de la sala con preview |
| `terreno` | Toma en terreno | toma de pedidos fuera del local |
| `venta-manual` | Venta manual | venta directa sin relay (fallback) |

**Roles / permisos**: `vendedor` (`orders.take`), `cashier` (`orders.pay`,
`orders.deliver`), y `operator` si hay B. Permisos: `orders.take`,
`orders.pay`, `orders.deliver`, `orders.prepare`.

**Dependencias**: requiere A (catálogo, precios y pedidos son la base).
**Recomendado con B** para el relay completo con picking; sin B el flujo es
vendedor → caja → retiro.

---

## D · Gerencia (upsell — módulo `gerencia`)

La consola del dueño: números del negocio sin herramientas de estación.
Requiere A; rinde más con B y C activos (más datos que mirar).

**Pantallas del panel**:

| Key | Pantalla | Para qué |
|---|---|---|
| `gerencia` | Centro de mando | consola ejecutiva del día |
| `reportes` | Reportes | biblioteca de informes (estilo Defontana) |
| `ventas` | Ventas | reporte de ventas |
| `cobranza` | Cobranza | cuentas por cobrar |
| `devoluciones` | Devoluciones | reembolsos y anulaciones |
| `documentos` | Documentos SII | boletas/facturas electrónicas (cuando esté operativo) |
| `modulos` | Módulos | configuración de módulos de atención |

**Roles / permisos**: `manager` (gerente/dueño). Permisos: `reports.read`,
`orders.cancel`, más lectura general.

**Dependencias**: requiere A. Los reportes de sala/caja solo tienen datos si C
está activo; los de inventario fino (lotes, FEFO, conteo), si B está activo.

---

## Matriz resumen

| Módulo | Env | Base/Upsell | Roles que habilita | Depende de |
|---|---|---|---|---|
| A · Tienda Web | `web` | **Base** | admin (+manager) | — |
| B · Bodega Pro | `bodega` | Upsell | operator | A |
| C · Venta en Sala | `sala` | Upsell | vendedor, cashier | A (recomendado B) |
| D · Gerencia | `gerencia` | Upsell | manager | A (rinde con B+C) |

Combos típicos: `web` (solo online) · `web,sala` (online + presencial simple) ·
`web,bodega` (online con bodega seria) · `web,bodega,sala,gerencia` (full, lo
que corre Bodega 12 hoy).
