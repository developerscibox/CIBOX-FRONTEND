# Tienda de Cibox

App Expo / React Native que corre como **web** (lo que se despliega) y también
como app nativa. Es la cara del supermercado: catálogo, carrito, checkout y
seguimiento del pedido.

## Correrla en local

```bash
npm install
echo "EXPO_PUBLIC_API_URL=http://localhost:3001/api" > .env
npm run web          # http://localhost:8081
```

El backend tiene que estar arriba (`cd ../backend && npm run dev`).

## Build de producción

```bash
npm run build:web    # expo export -p web + _redirects
```

**Ojo con Metro:** hornea `EXPO_PUBLIC_API_URL` en el bundle y su caché puede
reutilizar una URL vieja. Los builds van siempre con `--clear` (ya está en
`vercel.json`). Si la tienda en producción llama a `localhost`, es esto.

## App nativa (APK)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

`eas.json` y `app.json` ya están configurados (scheme `cibox://`, package
`cl.cibox.app`). Antes de compilar, revisa a dónde apunta `EXPO_PUBLIC_API_URL`.

## Dónde está cada cosa

| Ruta | Qué hay |
|---|---|
| `src/api/client.js` | Cliente axios: Bearer, `x-guest-id`, refresh automático ante 401 |
| `src/constants/brand.js` | Identidad de Cibox — se hidrata desde `GET /api/config/brand` |
| `src/constants/theme.js` | Paleta y tokens visuales (el único lugar con colores) |
| `src/navigation/` | Stack web/móvil y deep links |
| `src/screens/` | Pantallas |
| `src/store/` | Estado global (zustand) |
| `assets/` | Logo de Cibox, íconos de la app y del home |

La identidad de la empresa (RUT, razón social, giro, contacto, dirección) **no
se escribe aquí**: vive en `backend/src/config/brand.js` y se sirve por API.
Los colores sí están en `theme.js`, porque Metro los necesita en tiempo de build.
