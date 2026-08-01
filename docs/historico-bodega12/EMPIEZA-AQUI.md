# Bodega 12 — Proyecto completo en tu computador

Tres piezas que se conectan entre sí:

| Carpeta | Qué es | Corre en |
|---|---|---|
| **backend/** | La API: datos, pedidos, inventario | http://localhost:3001 |
| **tienda/** | La app para **comprar** (web) | http://localhost:8081 |
| **bodega/** | El **panel de bodega** (WMS) | http://localhost:5180 |

La tienda y la bodega le piden los datos al backend. Por eso el backend se levanta **primero**.

---

## Lo único que necesitas instalar

1. **Node.js** (versión LTS) → https://nodejs.org — botón verde, siguiente-siguiente.
2. **Una base de datos para el backend.** La forma más fácil y gratis, sin instalar nada:
   **MongoDB Atlas** (base de datos en la nube):
   - Crea cuenta en https://www.mongodb.com/cloud/atlas/register
   - Crea un cluster **gratis (M0)**
   - Botón **Connect** → **Drivers** → copia la URL (empieza con `mongodb+srv://...`)
   - En **Network Access** agrega `0.0.0.0/0` (permite conexión desde tu PC para pruebas)
   - Pega esa URL en **`backend/.env`**, en el campo `MONGO_URI`

> Si prefieres MongoDB instalado en tu PC, también sirve: `MONGO_URI=mongodb://localhost:27017/bodega12`.

---

## Cómo levantarlo (cada pieza en su propia terminal)

### 1) Backend — PRIMERO
```bash
cd backend
npm install
# abre backend/.env y pega tu MONGO_URI
npm run dev
```
Debe decir algo como *"escuchando en http://localhost:3001"*. Déjalo abierto.

### 2) Tienda (app de compra)
En **otra** terminal:
```bash
cd tienda
npm install
npm run web
```
Se abre en http://localhost:8081. Ya viene apuntando al backend (`tienda/.env`).

### 3) Bodega (panel WMS)
En **otra** terminal:
```bash
cd bodega
npm install
npm run dev
```
Se abre en http://localhost:5180. Arranca en **modo demo** (datos de ejemplo) — funciona al toque.

---

## Conectar el WMS a los datos reales (opcional, para después)

El panel de bodega arranca con datos de ejemplo. Para que muestre el inventario **real** del backend:

1. Necesitas el **token de un usuario admin**:
   - Regístrate en la tienda (crea una cuenta).
   - En tu base de datos (Atlas → Collections → `users`) cambia tu campo `role` a `"admin"`.
   - Inicia sesión otra vez y copia el token. *(Si te traba, mándame un mensaje y te saco el token paso a paso.)*
2. Crea un archivo **`bodega/.env`** con:
   ```
   VITE_API_URL=http://localhost:3001/api
   VITE_API_TOKEN=el-token-de-tu-usuario-admin
   ```
3. Reinicia la bodega: `npm run dev`. Ahora el dashboard, kardex y picking salen del backend real.

---

## Notas

- Deja las **3 terminales abiertas** mientras trabajas. Para apagar: `Ctrl + C` en cada una.
- En desarrollo el backend acepta cualquier origen, así que no hay bloqueos de CORS.
- **Respaldo / versiones:** usar git en local es opcional ahora. Cuando quieras, subimos cada pieza a GitHub para tener respaldo y poder publicarlo online (DigitalOcean, etc.).
- **¿Algo no levanta?** Cópiame el error que sale en la terminal y te lo destrabo al toque.

> El backend, la tienda y la bodega ya están con la marca Bodega 12 (paleta magenta, logo, textos) y el WMS ya trae el cliente conectado a `/api/inventory`.
