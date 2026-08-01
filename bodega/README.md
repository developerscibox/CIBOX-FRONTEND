# Bodega 12 — Panel de bodega (WMS)

Software interno de bodega para **Bodega 12** (supermercado mayorista, Lo Espejo, Santiago).
App web (Vite + React) pensada para usarse en **desktop, tablet y celular** del equipo de bodega
— el celular sirve como lector de código de barras para el picking.

Consume el backend existente de Bodega 12 (los endpoints `/api/inventory` y `/api/orders` que
ya están construidos), por lo que **no duplica lógica de negocio**: el kardex, los ajustes y las
transiciones de estado siguen viviendo en el backend.

## Módulos (v0.1)

| Módulo | Qué hace | Endpoint backend |
|---|---|---|
| **Resumen** | KPIs del día + stock crítico para reponer | `GET /inventory/low-stock` |
| **Picking** | Lista de pedidos a preparar, checklist por orden y verificación por escaneo de código de barras; al completar, marca el pedido `ready` | `GET /orders?status=preparing`, `GET /inventory/by-barcode/:code` |
| **Kardex** | Movimientos de inventario auditados (venta, ajuste, recepción, anulación…) | `GET /inventory/movements` |
| **Ajuste de stock** | Ingreso/merma con motivo obligatorio; queda en el kardex | `POST /inventory/adjust` |

> Sin `VITE_API_URL` configurada, el panel corre en **modo demostración** con datos de ejemplo
> (`src/data.js`) para poder mostrarlo sin backend.

## Correr local

```bash
npm install
cp .env.example .env   # y completa VITE_API_URL / VITE_API_TOKEN
npm run dev            # http://localhost:5180
npm run build          # genera dist/ (sitio estático)
```

## Identidad

Reutiliza la paleta Bodega 12 (magenta `#E6007E` / fucsia / morado, Poppins). Definida en
`src/theme.js` e `src/index.css`.

## Roadmap

- [ ] Login propio con el `authService` del backend (hoy usa token fijo)
- [ ] Escaneo con cámara real (html5-qrcode en web / expo-camera si se migra a móvil nativo)
- [ ] Tiempo real de pedidos nuevos (Socket.IO o polling)
- [ ] Generación de etiquetas de despacho
- [ ] Recepción de mercadería desde orden de compra a proveedor
