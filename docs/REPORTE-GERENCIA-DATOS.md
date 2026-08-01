# Reporte de información para gerencia y trazabilidad — Bodega 12

> Qué ve hoy el gerente, qué datos captura el sistema (con detalle), y cómo trazar/incorporar todo.

## A. Lo que el gerente VE hoy — Centro de mando (`/admin/gerencia`)
Dashboard ejecutivo, datos reales, selector de periodo (hoy / 7d / 30d / trimestre). Secciones:
- **Resumen:** venta del periodo (+ % vs periodo anterior), pedidos, ticket promedio, utilidad estimada y margen %, por cobrar / vencido, entregados + throughput, cuello de botella.
- **Ventas:** tendencia por día, ventas por hora (peaks), comparación vs periodo anterior.
- **Equipo:** ranking de vendedores ($/pedidos/ticket), cajeras (cobros/$), bodegueros (preparados/velocidad).
- **Productos:** más vendidos, menos vendidos, rentabilidad por producto (costo→utilidad→margen), quiebres/stock bajo.
- **Operación:** tiempo promedio por etapa, cuello, throughput, cola en vivo.
- **Finanzas:** caja por método del periodo + aging de cobranza.
Pantallas de apoyo: Reportes (export CSV/Excel/PDF, D/S/M/Q), Operación y tiempos, Incentivos, Cobranza, Cierre Z, Ventas, Precios y márgenes.

## B. La columna vertebral: trazabilidad (quién + cuándo en cada paso)
**Cada pedido guarda su historia completa.** En `status_history` queda, por cada transición: `changed_by {user_id, role, label}` + `changed_at`. Cadena del relay:
`EN_TOMA (vendedor) → POR_PAGAR → PAGADO (cajera) → EN_PREPARACIÓN (bodeguero) → LISTO → ENTREGADO`.
Eso permite reconstruir, para CUALQUIER pedido: quién lo tomó, quién cobró, quién preparó, quién entregó, y a qué hora cada paso. Además lleva `codigo_escaneo` (boleta), `turno_numero`, `payment.cashier_id`, y `sector` por ítem.

## C. Qué datos captura el sistema (catálogo por entidad)
### Pedido (`Order`)
- **Ítems:** producto, nombre, cantidad, precio unit, subtotal, **sector** (zona de bodega).
- **Totales:** subtotal, descuento (+ cupón), envío, total.
- **Cliente:** nombre, email, teléfono, RUT.
- **Entrega:** método (retiro/despacho), fecha comprometida de retiro, retirado_at; (despacho: dirección, tracking, eventos).
- **Pago:** método (efectivo/transferencia/tarjeta/webpay), **cajera (cashier_id)**, estado, monto, **monto recibido y vuelto**, transaction_id, comprobante de transferencia.
- **Tiempos:** creado, pagado, listo/despachado, entregado, anulado (+ motivo).
- **Historia:** `status_history` con actor+rol+hora por transición. `codigo_escaneo`, `turno_numero`, notas, origen (manual/cart/box…).
- **Stock flags:** comprometido (allocated) vs descontado (committed), repuesto.

### Producto (`Product`)
- **Inventario 3 estados:** stock físico, reservado (carrito), comprometido (allocated) → **disponible** derivado.
- **Costo de compra (`cost_price`)** → margen y utilidad (solo lo ve administración).
- **Precios por tramo (`pricing.tiers`):** unidad y caja (mayorista).
- **Ubicación:** zona / rack / nivel / código / **sector**.
- **Vencimiento (`expiry_date`)** → FEFO. Código de barras, categoría, marca, precio de referencia (compare_price).

### Kardex (`StockMovement`) — inmutable
Cada entrada/salida: producto, cantidad ± , **tipo** (venta / anulación / expiración / reembolso / **ajuste** / **recepción**), motivo, **quién**, stock resultante. Es la auditoría de inventario.

### Turno (`Turno`) + Módulo (`Module`)
Número/código correlativo del día, estado (espera→llamado→atención→atendido/cancelado), **quién llamó/atendió + horas**, módulo, enlace a pedido. → tiempos de fila y conversión.

### Sesión de caja (`CajaSession`)
Cajera, fondo inicial, ventas efectivo, esperado, **contado, diferencia**, apertura/cierre. → cuadre por turno y por cajera.

### Cobranza (`Deuda`, `CreditAccount`, `Cheque`)
Deudas por cliente, aging 0-30/31-60/61-90/+90, cheques por vencer. → plata en la calle.

### Incentivos (piloto)
Puntos por vendedor calculados desde los **pedidos reales del relay** (unidades + venta).
→ ranking de incentivos. Lógica en `backend/src/incentivos/piloto.js` (modificable).

### Otros disponibles
Devoluciones (`Refund`), Documentos tributarios (`TaxDocument`/DTE sandbox), Usuarios+roles (`User`), Categorías, Cupones + uso, Reseñas, Reservas de stock, Contabilidad scaffold (`LibroEntry`).

## D. Métricas que YA se derivan y de dónde
| Métrica | Fuente |
|---|---|
| Venta $, pedidos, ticket, por hora, tendencia | Order (PAID) + created_at |
| Utilidad y margen por producto | Order.items × Product.cost_price |
| Más/menos vendidos | Order.items agregado |
| Tiempo por etapa + cuello de botella | Order.status_history (timestamps) |
| Desempeño por persona (vend/caj/bod) | status_history.changed_by |
| Cuadre de caja, por método, diferencias | Order.payment + CajaSession |
| Aging / por cobrar / vencido | Deuda/CreditAccount |
| Quiebres / stock bajo / por vencer | Product (disponible, expiry_date) |

## E. Lo que se puede INCORPORAR (oportunidades)
### Ya capturado, falta exponerlo (rápido)
- Tiempo de cada persona en su etapa (no solo bodeguero): vendedor (toma), cajera (cobro).
- **Conversión turno → venta** (Turno.order_id) y tiempo de fila (espera/atención).
- **% de anulaciones** y monto anulado (status CANCELLED + motivo) por causa/persona.
- **Diferencias de caja por cajera** (CajaSession.diferencia) — tendencia de sobrantes/faltantes.
- Rotación de productos con **días sin venta**; margen real ganado por categoría.
- Hora pico por **día de la semana**; ticket por canal (sala vs web vs manual).
- **Ficha/línea de tiempo del pedido** (drill-down): todos sus eventos en una vista.

### Falta capturar (para trazar más) — decisiones del negocio
- **Margen objetivo** por producto/categoría (config) → alertas de bajo margen.
- **Metas** por persona y por periodo (hoy las metas de caja son referenciales).
- **Costo por recepción/proveedor** (lote) → margen real por compra, no solo costo unitario fijo.
- **Atribución de comisión por pedido** (mapeo vendedor↔usuario) → comisiones desde el relay (hoy vienen del import LEQSIS).
- Motivo de anulación **estructurado** (catálogo), tiempos de recepción, foto/firma de entrega.
- **AuditLog** transversal para acciones no-pedido (login, cambio de precio/rol, ajuste de stock).

## F. Cómo trazar TODO (recomendación)
1. **El patrón ya existe:** actor+timestamp por transición (pedidos) + Kardex (inventario). Extenderlo a un **AuditLog** unificado para toda acción sensible cierra la trazabilidad 360°.
2. **Vista "ficha del pedido":** línea de tiempo con cada evento (quién/cuándo/qué) — drill-down desde cualquier número del Centro de mando.
3. **Entidades de configuración** (margen objetivo, metas, mapeo vendedor↔usuario) para que las métricas tengan referencia real y dejen de ser "referenciales".
4. **Reportes exportables** por cada dimensión (ya hay base CSV/Excel/PDF) + agendados.
