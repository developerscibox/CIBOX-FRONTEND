# Cibox — Panel de operaciones

Panel interno del equipo de Cibox. App web (Vite + React) pensada para usarse en
**desktop, tablet y celular**; el celular sirve como lector de código de barras
al preparar los pedidos.

Consume el backend de Cibox (`/api/...`), por lo que **no duplica lógica de
negocio**: el kardex, los ajustes de stock y las transiciones de estado del
pedido viven en el backend.

## Qué hay adentro

| Área | Qué hace |
|---|---|
| **Inicio · gestión** | Centro de mando, Dashboard 360°, resumen del día, reportes, cobranza y clientes |
| **Pedidos** | Seguimiento de todos los pedidos, preparación (checklist + escaneo) y calendario de entregas |
| **Inventario · Catálogo** | Productos (alta, edición, carga masiva CSV, fotos), precios y márgenes, contenido de la tienda |
| **Inventario · Movimiento** | Recepción de mercadería, reposición, conteo físico y ajustes (entrada / ajuste / merma) |
| **Inventario · Control** | Panorama de stock, FEFO, lotes, kardex |
| **Reportes · admin** | Ventas, documentos tributarios, devoluciones y usuarios |

Todo el panel pasa por login. Los roles son **admin**, **manager** (gerencia) y
**operator** (operaciones); cada uno ve solo lo suyo (`src/ui.jsx` → `ROLE_SCOPE`).

> Sin `VITE_API_URL` configurada, el panel corre en **modo demostración** con
> datos de ejemplo (`src/data.js`), para poder mostrarlo sin backend.

## Correr local

```bash
npm install
echo "VITE_API_URL=http://localhost:3001/api" > .env
npm run dev            # http://localhost:5180
npm run build          # genera dist/ (sitio estático)
```

## Identidad

Paleta de Cibox: verde `#4E9B27`, lima `#C3E062`, amarillo `#F7B81C`. Los tokens
visuales están en **`src/brand.js`** (y sus alias en `src/theme.js` /
`src/index.css`). Los datos de la empresa —RUT, razón social, giro, contacto,
dirección— **no se escriben aquí**: se piden a `GET /api/config/brand`, cuya
fuente de verdad es `backend/src/config/brand.js`.

## Pendientes

- [ ] Escaneo con cámara real en más pantallas (hoy en Productos y Recepción)
- [ ] Generación de etiquetas de despacho desde el panel
- [ ] Recepción de mercadería a partir de una orden de compra al proveedor
