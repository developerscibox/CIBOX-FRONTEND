# Bodega 12 — Checklist de Despliegue a Producción

> Estado: la app **funciona 100% en local**. Para publicarla en internet hay que hostear 3 piezas y resolver 2 bloqueantes de cobro real. Este documento es para que decidas con todo a la vista.

---

## 1. Qué se publica (arquitectura objetivo)

| Pieza | Qué es | Hoy (local) | Dónde se hostea | Servicio recomendado |
|---|---|---|---|---|
| **Base de datos** | MongoDB | `localhost:27017` (replica set rs0) | Nube administrada | **MongoDB Atlas** |
| **Backend API** | Express (`node server.js`) | `localhost:3001` | Servidor Node 24/7 | **Render** o Railway |
| **Tienda (web cliente)** | Expo web → estático (`dist/`) | `localhost:8081` | Hosting estático/CDN | **Netlify** (usa el `_redirects` que ya existe) |
| **Panel de bodega (WMS)** | Vite → estático (`dist/`) | `localhost:5180` | Hosting estático/CDN | Netlify (subdominio aparte, ej. `bodega.tudominio.cl`) |

Flujo: la **Tienda** y el **WMS** (estáticos) llaman al **Backend**, que habla con **Atlas**.

---

## 2. Bloqueantes para COBRAR de verdad (decisión de negocio)

| Bloqueante | Estado hoy | Qué se necesita |
|---|---|---|
| **Webpay (Transbank)** | Modo **integración** (tarjetas de prueba, no cobra) | Convenio con Transbank → `WEBPAY_COMMERCE_CODE` + `WEBPAY_API_KEY` de **producción**. Cambiar `WEBPAY_ENV=production`. |
| **Boleta electrónica (SII)** | **Stub** (no emite documento real; `SII_ENABLED=false`) | Certificado digital, RUT empresa, folios CAF, e implementar firma/XML real. Es un proyecto en sí (parte de F5/integraciones). |
| **Dominio propio** | No hay | Comprar dominio (ej. `.cl` en NIC Chile). Sin dominio, queda en URLs tipo `*.netlify.app` / `*.onrender.com`. |
| **Correos transaccionales** | SMTP sin configurar (`EMAIL_*` vacío) | Cuenta SMTP real (Gmail App Password, Resend, Brevo, etc.) para verificación de cuenta y avisos. |

> **Importante:** se puede salir a internet como **demo** (link compartible) sin resolver estos 2 primeros — pero con pagos en modo prueba. Para cobrar de verdad, sí o sí Webpay producción.

---

## 3. Cuentas que hay que crear

| Cuenta | Para | Plan inicial | Costo |
|---|---|---|---|
| MongoDB Atlas | Base de datos | M0 (free) | **$0** (512 MB, suficiente para empezar) |
| Render | Backend Node | Free o Starter | **$0** (con "sleep" tras inactividad) o **~US$7/mes** (siempre activo) |
| Netlify | Tienda + WMS | Free | **$0** (100 GB/mes) |
| Dominio | Marca | NIC Chile / registrador | **~$10.000–15.000 CLP/año** (.cl) |
| Transbank | Pagos reales | Convenio comercial | Comisión por venta (según convenio) |

**Demo funcional: $0.** **Producción con dominio: ~$10–20 mil CLP/año + comisiones Transbank** (Render gratis si tolera el "sleep", o US$7/mes para 24/7).

---

## 4. Variables de entorno (las reales del proyecto)

### Backend (en Render → Environment)
```
NODE_ENV=production
PORT=3001
MONGO_URI=<cadena de conexión de Atlas>
JWT_SECRET=<32+ caracteres aleatorios>
JWT_REFRESH_SECRET=<32+ caracteres aleatorios, distinto>
GUEST_ID_SECRET=<32+ caracteres aleatorios>
ALLOWED_ORIGINS=https://tudominio.cl,https://bodega.tudominio.cl   # OBLIGATORIO en prod
FRONTEND_URL=https://tudominio.cl
# Pagos (demo: dejar en integration; producción: production + credenciales Transbank)
WEBPAY_ENV=integration
WEBPAY_COMMERCE_CODE=<solo en producción>
WEBPAY_API_KEY=<solo en producción>
WEBPAY_RETURN_URL=https://api.tudominio.cl/api/payments/webpay/return
# Correo (para verificación de cuenta y avisos)
EMAIL_HOST=  EMAIL_PORT=587  EMAIL_USER=  EMAIL_PASS=  EMAIL_FROM="Bodega 12 <no-reply@tudominio.cl>"
# Imágenes de productos (si se usan subidas)
UPLOAD_DRIVER=cloudinary  CLOUDINARY_CLOUD_NAME=  CLOUDINARY_API_KEY=  CLOUDINARY_API_SECRET=
# Boleta SII (dejar deshabilitado hasta tener certificado)
SII_ENABLED=false
```
> El backend **valida el entorno al arrancar** (Zod): si falta `MONGO_URI`, los `JWT_*`/`GUEST_ID_SECRET` (<32 chars) o `ALLOWED_ORIGINS` en prod, **no levanta**. Eso es bueno: evita publicar mal configurado.

### Tienda (en Netlify → Environment)
```
EXPO_PUBLIC_API_URL=https://api.tudominio.cl/api
```
Build command: `npm run build:web` · Publish dir: `dist`

### WMS (en Netlify → Environment)
```
VITE_API_URL=https://api.tudominio.cl/api
```
Build command: `npm run build` · Publish dir: `dist`
> Recordar: el WMS ya **no** usa token compartido; cada persona inicia sesión.

---

## 5. Pasos ordenados (camino "demo online")

1. **Atlas**: crear cluster M0 → usuario DB → permitir IP `0.0.0.0/0` (o las de Render) → copiar `MONGO_URI`.
2. **Migrar datos** (opcional): exportar la base local y restaurar en Atlas (`mongodump`/`mongorestore`), o re-sembrar con los scripts (`seedBodega12.js`, `seedWmsUsers.js`).
3. **Backend en Render**: conectar el repo → root `backend/` → build `npm install` → start `npm start` → cargar variables del punto 4 → desplegar → anotar la URL (`https://...onrender.com`).
4. **Tienda en Netlify**: root `tienda/` → build `npm run build:web` → publish `dist` → variable `EXPO_PUBLIC_API_URL` apuntando al backend → desplegar.
5. **WMS en Netlify**: root `bodega/` → build `npm run build` → publish `dist` → variable `VITE_API_URL` → desplegar.
6. **Conectar**: poner las URLs reales de Netlify en `ALLOWED_ORIGINS` y `FRONTEND_URL` del backend y redeploy.
7. **Probar**: registro/login, agregar caja, checkout (Webpay integración con tarjeta de prueba), y el WMS con los 4 usuarios.

Para **producción real** se agregan: dominio + DNS (apuntar a Netlify/Render), `WEBPAY_ENV=production` con credenciales Transbank, SMTP real, y el proyecto de boleta SII.

---

## 6. Checklist de seguridad pre-producción

- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` / `GUEST_ID_SECRET` nuevos y fuertes (no los de dev).
- [ ] `ALLOWED_ORIGINS` solo con los dominios reales (CORS cerrado).
- [ ] **Eliminar/!cambiar contraseñas** de los usuarios de prueba (`test@`, `gerente@`, `operario@`, `cajero@` con `Test1234!`).
- [ ] HTTPS en todo (Netlify y Render lo dan automático).
- [ ] Rate limiting ya viene en el backend (`express-rate-limit`) — verificar límites de login.
- [ ] Atlas: usuario DB con permisos mínimos, IP allowlist (no `0.0.0.0/0` en prod si se puede).
- [ ] Backups de Atlas activados.
- [ ] `NODE_ENV=production`.

---

## 7. Resumen de decisión

- **Quiero un link para mostrar ya** → camino demo (sección 5), **$0**, ~1–2 h, pagos en modo prueba.
- **Quiero vender de verdad** → demo + dominio + Webpay producción (convenio Transbank) + SMTP. La **boleta SII real** es trabajo adicional (recomendado abordarlo junto con el módulo de Recepción/F5).

*Generado el 2026-06-13. Datos tomados de `backend/src/config/env.js`, `webpay.js`, y los `package.json` reales.*
