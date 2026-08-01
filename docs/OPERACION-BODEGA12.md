# Bodega 12 — Guía rápida de operación (beta)

> Actualizado: 2026-06-21. Para el día a día del beta. Imprimible / para tener a mano en el mostrador.

---

## 1. Enlaces

| Para qué | Dirección |
|---|---|
| **Tienda** (la usan los clientes) | https://tienda-iota-gold.vercel.app |
| **Panel de bodega** (lo usa el personal) | https://bodega-nine.vercel.app |
| **Pantalla** (TV de la sala / turnos) | https://bodega-nine.vercel.app/pantalla |
| **Pedir turno** (QR para el cliente) | https://bodega-nine.vercel.app/turno |

---

## 2. Usuarios del panel y qué puede hacer cada uno

Se entra con **correo + contraseña**. Cada rol ve solo lo que le toca:

| Rol | Stock | Recepción | Preparar pedidos | Cobrar/entregar | Productos |
|---|:--:|:--:|:--:|:--:|:--:|
| **Gerente / Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operario** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Cajero** | ❌ | ❌ | ❌ | ✅ | ❌ |

> En el beta, lo más simple: el/la encargado/a entra como **Gerente** y hace todo de punta a punta.
>
> ⚠️ **Seguridad:** las cuentas de prueba usan la contraseña `Test1234!`. **Cambiarla antes de usar en serio.**

---

## 3. Cómo compra un cliente (SIN cuenta)

1. Entra a la **Tienda**, mira los productos por categoría.
2. **Agrega al carrito** — no necesita registrarse.
3. En el **Checkout** llena: nombre, RUT, correo, teléfono y **fecha de retiro**.
4. Confirma. El pago es **al retirar** (efectivo o transferencia).
5. **Retira en la bodega** el día elegido.

> No hay despacho a domicilio ni pago online (Webpay) en el beta: solo **retiro + efectivo/transferencia**.

---

## 4. Tareas del día a día (en el Panel)

### 📦 Ver y ajustar stock
- Sección **Inventario / Productos**: ves el stock disponible de cada producto.
- Para corregir (merma, conteo, error): **ajuste manual** indicando el motivo. Queda registrado.

### 📥 Recibir mercadería (cuando llega producto)
- Sección **Recepción**: eliges/escaneas el producto, pones la cantidad que llegó → el stock **sube** automáticamente y queda en el historial (kardex).

### 🧺 Preparar pedidos de la web (picking)
- Sección **Pedidos**: aparecen los pedidos que entran por la tienda.
- Marca el pedido **"En preparación"** → júntalo → márcalo **"Listo para retiro"**.

### 💵 Cobrar y entregar (caja)
- Cuando el cliente llega a retirar: cobra (**efectivo o transferencia**), registra el cobro → el pedido pasa a **"Entregado"** y el stock se descuenta.
- Al cierre del día: **cuadre de caja** (cuánto efectivo debería haber).

---

## 5. El flujo completo, de un vistazo

```
Cliente compra en la web
        │  (el stock se RESERVA al instante → no se sobrevende)
        ▼
El pedido aparece en el Panel (Pedidos)
        │
        ▼
Personal prepara (picking): "En preparación" → "Listo"
        │
        ▼
Cliente retira y paga (efectivo/transferencia)
        │
        ▼
"Entregado" → el stock baja de verdad
```

---

## 6. Estado del beta (qué está listo y qué falta)

| | Estado |
|---|---|
| 🛒 Comprar sin cuenta | ✅ Funcionando |
| 📸 Fotos de productos (Cloudinary) | ✅ Funcionando |
| 🧮 Stock en línea / anti-sobreventa | ✅ Funcionando |
| 📧 Correos (verificar cuenta / recuperar contraseña) | ⏳ Falta configurar (no bloquea vender) |
| 🗂️ Catálogo real de ~30 productos | ⏳ Falta la lista + fotos del cliente |

---

## 7. Notas importantes

- **El correo no frena las ventas:** como se compra sin cuenta, el correo solo sirve para recuperar contraseña de quien decida registrarse. Se configura aparte (Resend).
- **Si un cliente dice "no me llega el correo de verificación":** por ahora **puede iniciar sesión igual** sin verificar (el sistema no lo exige).
- **Catálogo:** hoy el catálogo es de prueba. Para el beta real se cargan los ~30 productos definitivos del cliente (código, foto, precio, stock) con un script de carga.
