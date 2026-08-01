# Beta de puesta en marcha — Bodega 12 con catálogo acotado (~30 productos)

- **Fecha:** 2026-06-19
- **Autor:** CTO (Claude) — validado con CEO
- **Estado:** En revisión (pendiente aprobación del CEO)
- **Tipo:** Spec de diseño → pasa a plan de implementación

---

## 1. Contexto de negocio

Tras una reunión exitosa, Bodega 12 quiere **arrancar en producción su tienda web como su software de bodega**, aunque el WMS completo todavía no cubre el 100% de lo que necesitarán a futuro.

El acuerdo de puesta en marcha es un **beta**: no estarán todos los productos, sino una prueba de **~20–30 productos reales**, cada uno con:
- Código propio
- Ficha con foto, información, precio
- Stock seguido en línea y sincronizado con la página

El "módulo simplificado de bodega" pedido es, en la práctica, **acotar el catálogo y dejar el flujo de bodega pulido y operable** para esos 30 productos. No es construir un WMS nuevo: las capacidades ya existen.

## 2. Estado actual del sistema (lo que YA existe)

Verificado en código en esta sesión:

- **Modelo de producto** (`backend/src/models/Product.js`) ya tiene todo lo necesario: `sku`, `barcode`, `stock`, `reserved`, `allocated`, `pricing.tiers`, `images[]`, `thumbnail`, `category`/`categories`, `cost_price`, `compare_price`, `expiry_date`, `location`. El virtual `available = stock − reserved − allocated`.
- **Gestión de catálogo:** alta/edición/activar productos desde el WMS (`bodega/src/screens/Productos.jsx`), permiso `products.manage`.
- **Subida de imágenes** (`backend/src/services/uploadService.js`, rutas `POST /upload/image`, `POST /upload/images` hasta 10, `DELETE /upload/:key`): soporta 3 drivers — `cloudinary`, `s3`, `disk` — según `env.UPLOAD_DRIVER`.
- **Flujo de bodega completo:** Inventario, Recepción (`POST /inventory/receive`), Pedidos/picking (`paid→preparing→ready`), Caja con cuadre de efectivo (`POST /orders/admin/:id/pay-cash`, `cash-summary`).
- **Reserva de stock atómica** (modelo `Reservation` + `Product.reserved`): evita sobreventa y mantiene la web sincronizada en tiempo real. El stock físico se descuenta al confirmar la orden.
- **Roles y permisos finos** (`backend/src/utils/constants.js`): autorización por permiso atómico, no por rol entero.
- **Producción operativa:** las 2 webs (Vercel) → backend (Render) → MongoDB Atlas, todo HTTP 200, keep-warm activo (sin cold start). Tienda en modo solo-retiro + efectivo/transferencia (sin Webpay).

**Conclusión:** el trabajo del beta es **datos + configuración + QA**, no desarrollo de features grandes.

## 3. Decisiones tomadas (CEO)

1. **Quién es:** Bodega 12 lanzando un **beta acotado** sobre su propia operación → **misma instancia, sin multi-tenant ni deploy nuevo.**
2. **Funciones de bodega requeridas:** las 4 — (a) ver y ajustar stock, (b) recibir mercadería, (c) preparar pedidos web (picking), (d) caja/cobro.
3. **Datos de los 30 productos:** el **cliente entrega lista + fotos**; nosotros cargamos y armamos las fichas.

**Asunciones (vigentes salvo que el CEO indique lo contrario):**
- **Pagos:** se mantiene solo retiro + efectivo/transferencia (sin Webpay).
- El catálogo demo se **desactiva** (`is_active=false`), no se borra → reversible y no rompe órdenes históricas.
- El catálogo público del beta = **solo** los ~30 productos reales; nada de demo visible.

## 4. Hallazgo crítico — almacenamiento de fotos

El registro de despliegue indica que **Render no tiene Cloudinary configurado**. Si `UPLOAD_DRIVER` cae en `disk`, las fotos se guardan en el **disco efímero de Render** y **se borran en cada deploy/restart**. Esto rompería todas las fichas en el primer redeploy.

**Acción bloqueante (Fase 0):** configurar `UPLOAD_DRIVER=cloudinary` + `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET/FOLDER` en Render (cuenta free de Cloudinary alcanza de sobra para 30 fotos) y verificar persistencia tras un redeploy. Alternativa equivalente: S3/R2; Cloudinary es la de menor fricción y ya está soportada en código.

## 5. Enfoque elegido

**Carga masiva por script + WMS recortado por roles**, con la UI del WMS para el día a día.

| Criterio | **A — Script de import (elegido)** | B — Todo a mano por la UI |
|---|---|---|
| Carga de 30 productos | Plantilla Excel + carpeta de fotos → 1 script | Uno por uno en pantalla |
| Fotos | 30 a Cloudinary en lote | Una por una |
| Cliente corrige la lista | Re-corre el script (idempotente por SKU) | Re-trabajo manual |
| Escalar a +productos luego | Mismo script | Inviable |
| Riesgo de error humano | Bajo (validado por script) | Alto |

**Híbrido:** el script hace la **carga inicial**; la UI del WMS (`Productos.jsx`, Inventario, Recepción) queda para **ajustes del día a día** (precio, stock, recepción). Lo mejor de ambos.

## 6. Modelo de datos del beta

### 6.1 Esquema de códigos
- **SKU interno:** `B12-0001`, `B12-0002`, … (correlativo, asignado por nosotros). Es el "código propio" de cada producto y la **clave de idempotencia** del import.
- **Barcode (opcional):** EAN-13 del envase si el producto lo trae, para escanear en recepción/picking. Si no lo trae, se deja vacío.

### 6.2 Plantilla de carga (Excel/CSV) — columnas
| Columna | Obligatoria | Ejemplo | Notas |
|---|---|---|---|
| `codigo` | sí | B12-0001 | SKU interno, único |
| `nombre` | sí | Arroz Grado 1 Tucapel 1kg | |
| `descripcion` | sí | … | Texto de la ficha |
| `categoria` | sí | Abarrotes | Debe existir o se crea en Fase 1 |
| `precio` | sí | 1290 | CLP, entero. Tier base |
| `precio_comparacion` | no | 1590 | Para mostrar ahorro |
| `stock_inicial` | sí | 24 | Unidades en bodega hoy |
| `costo` | no | 980 | Solo visible en WMS (margen) |
| `barcode` | no | 7801234567890 | EAN si existe |
| `archivo_foto` | sí | B12-0001.jpg | Nombre del archivo en la carpeta de fotos |

- **Fotos:** carpeta con imágenes nombradas exactamente por `archivo_foto` (≤5 MB, jpg/png/webp).
- **Pricing:** para el beta cada producto usa **un solo tier** (`min_qty=1`, `price`, `label="Unidad"`). Si después quieren precio por mayor, se agregan tiers.

## 7. Roles — quién opera el beta

Hallazgo de `constants.js`: **ningún rol único cubre las 4 funciones.**
- `operator` → stock + recepción + picking (no cobra).
- `cashier` → solo entrega/cobro.
- `manager` → **cubre las 4** + edición de productos + reportes.

**Decisión de diseño:** para el beta, el/la encargado(a) de Bodega 12 usa rol **`manager`** (opera todo de punta a punta, que es lo natural en una operación chica). Si más adelante quieren separar funciones, se agregan usuarios `operator` y `cashier`. No se crea ningún rol nuevo.

> Pendiente de seguridad heredado: cambiar las contraseñas de prueba `Test1234!` antes del uso real. Se incluye en Fase 1.

## 8. Plan por fases

### Fase 0 — Infra de fotos (bloqueante, no depende del cliente)
- [ ] Crear cuenta Cloudinary (free) y carpeta del proyecto.
- [ ] Configurar `UPLOAD_DRIVER=cloudinary` + `CLOUDINARY_*` en Render.
- [ ] Verificar: subir una foto de prueba → redeploy → la foto sigue accesible.

### Fase 1 — Limpieza y estructura (no depende del cliente)
- [ ] Script para **desactivar** los productos de demo (`is_active=false`), reversible.
- [ ] Crear/verificar las **categorías reales** que usarán los 30.
- [ ] Crear usuario(s) del personal con rol `manager` (y `cashier` si se decide separar caja).
- [ ] Cambiar contraseñas `Test1234!` de las cuentas que queden activas.

### Fase 2 — Insumos del cliente (bloquea Fase 3)
- [ ] Entregar al cliente la **plantilla Excel** (sección 6.2) + instrucciones de nombrado de fotos.
- [ ] Recibir planilla completa + carpeta de fotos.
- [ ] Validar insumos (precios, fotos presentes, categorías).

### Fase 3 — Carga
- [ ] Script `import-beta.js`: lee la planilla, sube cada foto a Cloudinary, crea/actualiza el producto por `codigo` (idempotente), arma la ficha completa (pricing, stock, categoría, imágenes, barcode, costo).
- [ ] Correr en producción; verificar los 30 en la tienda.

### Fase 4 — QA end-to-end con los 30
- [ ] Cliente compra en la web → reserva de stock baja el disponible.
- [ ] El pedido entra al WMS → picking (`preparing→ready`).
- [ ] Caja: cobro efectivo/transferencia al retiro → `ready→delivered`, stock físico baja, cuadre de caja.
- [ ] Recepción: llega mercadería → stock sube (kardex `recepcion`).
- [ ] Ajuste manual de stock (merma/conteo).
- [ ] Anti-sobreventa: dos compras simultáneas del último ítem.
- [ ] Verificación en **navegador real en producción**, no solo curl.

## 9. Criterios de éxito

- 30 productos reales visibles en la tienda con foto, precio y descripción correctos.
- Las fotos sobreviven un redeploy de Render.
- Una compra web se refleja en el WMS y descuenta stock; el cobro y la entrega cierran el pedido.
- Recepción y ajuste manual mueven el stock y quedan en el kardex.
- El personal entra con su usuario y opera las 4 funciones sin tocar nada de demo.

## 10. Fuera de alcance (YAGNI para este beta)

- Multi-tenant / multi-sucursal / deploy separado.
- Webpay / pagos online / despacho a domicilio.
- Lotes/FEFO completo (la caducidad ligera por producto basta).
- Boleta SII real (requiere certificado).
- Precio por mayor / tiers múltiples (se puede agregar después sin reestructurar).
- Roles nuevos a medida.

## 11. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Cloudinary no configurado → fotos se pierden | Alto | Fase 0 bloqueante + verificación post-redeploy |
| Cliente demora la lista/fotos | Medio | Fases 0 y 1 avanzan en paralelo sin depender del cliente |
| Datos inconsistentes en la planilla | Medio | Script valida; columnas obligatorias definidas |
| Contraseñas de prueba en producción | Alto | Cambio en Fase 1 |
| Mezcla de productos demo con reales | Medio | Desactivación de demo en Fase 1, verificada en Fase 4 |

## 12. Qué necesito del cliente (resumen de insumos)

1. Planilla Excel con las columnas de la sección 6.2 (o sus datos para que la llenemos nosotros).
2. Carpeta de fotos nombradas por código (`B12-0001.jpg`…), ≤5 MB c/u.
3. Confirmación de quién(es) será(n) el/los usuario(s) operador(es) y sus nombres/correos.
