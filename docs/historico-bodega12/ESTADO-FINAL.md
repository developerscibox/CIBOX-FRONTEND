# Bodega 12 — Estado del sistema

> Documento de cierre. Última actualización: 2026-06-16. Mantenido por el equipo técnico.

Bodega 12 es un supermercado mayorista (**venta solo por caja**, **retiro en bodega** en Lo Espejo, Santiago). El sistema está **en línea como demo público** sobre plan gratuito y es funcional de punta a punta: catálogo, compra, pago y operación de bodega.

---

## 1. Arquitectura

```
Clientes  ─▶  Tienda (Vercel)  ─┐
                                 ├─▶  Backend API (Render)  ─▶  MongoDB Atlas
Bodega    ─▶  WMS (Vercel)     ─┘
```

| Componente | Tecnología | URL |
|---|---|---|
| Tienda (clientes) | Expo React Native Web | https://tienda-iota-gold.vercel.app |
| WMS (bodega) | Vite + React | https://bodega-nine.vercel.app |
| Backend API | Express 5 + Mongoose | https://bodega12-api.onrender.com (`/api`) |
| Base de datos | MongoDB Atlas M0 (São Paulo) | DB `bodega12` |

**Limitación del plan gratis:** el backend en Render **duerme tras inactividad** → la primera petición tras un rato tarda ~50 s (cold start). Las siguientes son normales. Para producción real se sube a un plan pago (sin sleep).

---

## 2. Accesos de prueba

**WMS** (https://bodega-nine.vercel.app) — contraseña de todas: `Test1234!`

| Rol | Email | Ve |
|---|---|---|
| Administrador | `test@bodega12.cl` | Todo |
| Gerente | `gerente@bodega12.cl` | Todo menos usuarios |
| Operario | `operario@bodega12.cl` | Picking, inventario, recepción |
| Cajero | `cajero@bodega12.cl` | Pedidos, venta manual, caja |

**Tienda:** registro libre, o comprar como invitado. Cupón demo: `BODEGA10` (10% dto).

---

## 3. Qué se construyó

### Base (ya existía y se consolidó)
- Catálogo por caja con precios mayoristas, búsqueda y categorías.
- Carrito, checkout (efectivo / transferencia), retiro con fecha comprometida.
- WMS: resumen operativo, pedidos, picking por escaneo, inventario, kardex auditado, ajustes, venta manual, usuarios y roles.

### Fase 1 — Ganancias rápidas
- **Tienda:** botón *"Recomprar todo"* en la despensa; filtros (disponibles / marca / chips).
- **WMS:** sección **Productos** (alta y edición de productos por caja, permiso `products.manage`).

### Fase 2 — Operación
- **Recepción por escaneo** (`POST /inventory/receive`): sube stock + escribe kardex tipo *recepción*. Sección WMS **📥 Recepción**.
- **Cuadre de caja efectivo:** monto recibido + vuelto automático; consolidado por cajero (`/orders/admin/cash-summary`). Modal en Pedidos + card en Ventas.
- **Fix de flujo:** el job de expiración solo cancela Webpay abandonado; los pagos presenciales (efectivo/transferencia) ya **no se cancelan solos**.

### Fase 3 — Costos y caducidad
- **Costos y márgenes:** campo *"Costo de compra"* por producto; columna **Margen %** en Productos; card de **Rentabilidad** en Ventas.
  - 🔒 El costo **nunca se expone en la tienda pública** — se oculta en los 9 endpoints públicos y solo lo ve quien tiene `products.manage` (admin/gerente).
- **Control de caducidad ligero (FEFO):** fecha de vencimiento al recibir mercadería o editar el producto; sección **⏰ Productos por vencer** en Inventario (badges *vencido* / *por vencer*); endpoint `GET /inventory/expiring-soon?days=30`.
- **Fix badge Picking:** el contador del menú ahora cuenta **pedidos reales en preparación** (antes estaba fijo en 2 por datos de demo).

---

## 4. Decisiones técnicas tomadas (qué se difirió y por qué)

Como el encargo fue "terminar lo más completo y profesional posible", se priorizó lo que aporta valor operativo inmediato y se **difirió** lo que requiere semanas, certificados externos o decisión de negocio:

| Diferido | Por qué | Cuándo conviene |
|---|---|---|
| **Boleta/factura SII real** | Necesita certificado digital del SII y enrolamiento tributario (trámite del negocio). Hoy `SII_ENABLED=false`. | Antes de vender legalmente con documento tributario. |
| **Lotes + FEFO completo** | Módulo grande (modelo `Batch` por lote, trazabilidad). Se implementó la versión **ligera** (una fecha de vencimiento por producto), que cubre el 90% del valor. | Cuando manejen muchos lotes con vencimientos distintos del mismo producto. |
| **Multi-sucursal** | Cambia el modelo de stock e implica decisión de expansión. | Al abrir una segunda bodega. |
| **Fidelización / puntos** | Feature de marketing, no operativa. | Cuando haya base de clientes recurrentes. |

---

## 5. Pendiente que requiere acción tuya (no técnica)

### 🔴 Seguridad (antes de uso real)
Durante el despliegue se compartieron credenciales por chat. **Rótalas tú** desde los paneles:
1. **Atlas** → cambiar contraseña del usuario `gfariaslisboa_db_user` → actualizar `MONGO_URI` en Render.
2. **Render** → revocar la API key usada (`rnd_3yhsx3t5...`) y crear una nueva si la necesitas.
3. **Passwords de prueba** `Test1234!` → cambiarlas antes de dar acceso a personas reales.

### 🟡 Para vender legalmente
- Habilitar boleta SII (certificado + `SII_ENABLED=true`).
- Pasar Webpay de *integración* a *producción* (credenciales de comercio reales).
- Subir Render/Atlas a plan pago (sin cold start, con backups).

---

## 6. Cómo desplegar cambios

```bash
# 1. Commit + push
git add -A && git commit -m "..." && git push origin master

# 2. Backend (Render) — se autodespliega con el push, o forzar:
curl -X POST "https://api.render.com/v1/services/srv-d8o5fpmrnols73cl59a0/deploys" \
  -H "Authorization: Bearer <RENDER_API_KEY>" -H "Content-Type: application/json" -d '{}'

# 3. Tienda (Vercel)
cd tienda && vercel deploy --prod --yes --build-env EXPO_PUBLIC_API_URL="https://bodega12-api.onrender.com/api"

# 4. WMS (Vercel)
cd bodega && vercel deploy --prod --yes --build-env VITE_API_URL="https://bodega12-api.onrender.com/api"
```

Repo: `GFARI008/bodega12` (privado), branch `master`.
