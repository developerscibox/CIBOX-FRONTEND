# Cibox — Frontends

Las dos caras de Cibox. Ambas consumen el mismo backend
([CIBOX-BACKEND](https://github.com/developerscibox/CIBOX-BACKEND)) y **no
duplican lógica de negocio**: stock, kardex, precios y estados de pedido viven
allá.

| Carpeta | Qué es | Stack | Local |
|---|---|---|---|
| [`tienda/`](tienda) | Tienda del cliente: catálogo, carrito, checkout, seguimiento | Expo / React Native (web + nativa) | `npm run web` → `:8081` |
| [`bodega/`](bodega) | Panel interno: pedidos, inventario, reportes | Vite + React | `npm run dev` → `:5180` |
| [`tools/`](tools) | Puente de impresión térmica para el panel | PowerShell | — |

Cada app tiene su propio README con el detalle.

## Levantar las dos en local

El backend tiene que estar arriba primero (por defecto en `:3001`).

```bash
cd tienda && npm install && echo "EXPO_PUBLIC_API_URL=http://localhost:3001/api" > .env && npm run web
```

```bash
cd bodega && npm install && echo "VITE_API_URL=http://localhost:3001/api" > .env && npm run dev
```

> Sin `VITE_API_URL`, el panel arranca en modo demostración con datos de ejemplo.

## Despliegue

Las dos son sitios estáticos y se despliegan por separado en Vercel, cada una
apuntando a su carpeta como **Root Directory** del proyecto:

| Proyecto en Vercel | Root Directory | Variable de entorno |
|---|---|---|
| tienda | `tienda` | `EXPO_PUBLIC_API_URL` |
| panel | `bodega` | `VITE_API_URL` |

El `vercel.json` de cada carpeta ya trae su build y sus rewrites de SPA. Ojo con
Metro en la tienda: hornea `EXPO_PUBLIC_API_URL` en el bundle, por eso el build
va con `--clear`.

## Identidad

Paleta de Cibox: verde `#4E9B27`, lima `#C3E062`, amarillo `#F7B81C`. Los tokens
viven en `tienda/src/constants/theme.js` y `bodega/src/brand.js` porque Metro y
Vite los necesitan en tiempo de build. Los datos de la empresa —RUT, razón
social, giro, contacto, dirección— **no se escriben en el frontend**: se piden a
`GET /api/config/brand`.
