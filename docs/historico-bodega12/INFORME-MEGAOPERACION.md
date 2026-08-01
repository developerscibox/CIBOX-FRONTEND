# Bodega 12 — Informe de la operación de QA + Onboarding

> Operación ejecutada el 2026-06-16. Auditoría exhaustiva, corrección y profesionalización de las dos aplicaciones (tienda de clientes + WMS de bodega) y su backend.

---

## 1. Resumen ejecutivo

Se realizó una revisión integral de las **42 pantallas** de los dos programas con una flota de agentes especializados. Se rastrearon **366 elementos interactivos** (botón por botón) hasta su función, se detectaron **125 problemas** y se corrigieron todos los de impacto en cliente o negocio, además de:

- **Limpiar todos los paréntesis** del panel de bodega para que se vea profesional.
- **Agregar dos tutoriales interactivos**: uno para clientes nuevos en la tienda y otro para trabajadores nuevos en el WMS (adaptado a su rol).
- **Cerrar 3 fugas de seguridad** y alinear todo el texto con el modelo real del negocio (venta por caja, retiro en bodega, pago efectivo/transferencia).

Ambas apps compilan sin errores y están **desplegadas en producción**.

| Métrica | Valor |
|---|---|
| Pantallas auditadas | 42 (29 tienda + 13 WMS) |
| Botones/handlers rastreados | 366 |
| Hallazgos totales | 125 |
| — Críticos | 5 |
| — Altos | 16 |
| — Medios | 28 |
| — Bajos | 76 |
| Agentes usados | 20 (auditoría) + 9 (corrección) + 3 (verificación) |

---

## 2. Lo que encontramos

Distribución por tipo: UX confusa (45), contratos rotos frontend↔backend (18), **paréntesis poco profesionales (23)**, bugs (13), labels/textos errados (10), crashes potenciales (8), botones muertos (5), **seguridad (3)**.

### 🔴 Los 5 críticos
1. **La despensa de recompra siempre aparecía vacía** — el frontend leía mal la respuesta del backend.
2. **"Recomprar todo" no funcionaba** — apuntaba a una dirección que no existe (error 404).
3. **Pantalla de presentación B2B expuesta públicamente** — RUT, márgenes y condiciones a proveedores eran alcanzables por cualquiera con el link.
4. **Panel de órdenes de administración sin candado** — cualquier cliente logueado podía abrirlo escribiendo el nombre de la ruta.
5. **"Venta manual" del WMS mostraba siempre Total $0** en producción — el backend no entregaba los precios al selector.

### 🟠 Altos (selección)
- El home y los Términos **prometían pagar con Webpay y despacho a domicilio**, cuando el negocio es retiro en bodega con pago presencial → confusión y promesa incumplida al cliente.
- **Recepción de mercadería sobreescribía el vencimiento de TODO el cargamento** con una sola fecha.
- Navegación a pantallas inexistentes (crash en web), botón "volver" trabado dejando al usuario sin salida, registro duplicado de "olvidé mi contraseña", filtros que se caían con datos incompletos.
- El calendario de retiros **corría el día** por un problema de zona horaria.

---

## 3. Lo que arreglamos

### Seguridad
- Pantallas internas (admin/vendor/B2B) ahora **solo existen para roles autorizados**; se quitó el deep-link público.
- Se eliminó un registro que **filtraba el correo del usuario** en cada recuperación de contraseña.

### Bugs críticos de negocio
- Despensa y **"Recomprar todo" reconectados** a los endpoints reales; las tarjetas ahora muestran nombre, foto y precio por caja.
- **Venta manual** vuelve a calcular el total real (backend ahora entrega los precios; tope subido de 100 a 500 productos).

### Experiencia del cliente alineada al negocio
- Todo el texto de cara al cliente dice ahora **"retiro en bodega · efectivo o transferencia, pago al retirar"**. Se eliminaron las promesas de Webpay y despacho (salvo el banner "Próximamente", intencional).
- Avisos claros cuando hace falta iniciar sesión, carrito vacío manejado, enlaces del footer corregidos, regla "solo por caja" respetada en las tarjetas.

### Operación de bodega (WMS)
- **Recepción con vencimiento por fila** (ya no arrastra una sola fecha a todo el cargamento).
- Calendario sin corrimiento de día; tableros que no se rompen con datos vacíos.
- **23 paréntesis eliminados** de menús, títulos y formularios: *Ventas*, *Movimientos*, *Cuadre de caja efectivo*, *Rentabilidad estimada*, *Venta manual presencial*, etc.

### 🎓 Tutoriales interactivos (nuevos)
- **Tienda — bienvenida de 7 pasos** para clientes nuevos: qué es comprar por caja, retiro en bodega, cómo buscar/filtrar, agregar al carrito, elegir día y pagar al retirar, y dónde ver pedidos y favoritos. Aparece la primera vez y es saltable; se puede reabrir desde el perfil.
- **WMS — tour de hasta 14 pasos adaptado al rol**: cada trabajador (cajero, operario, gerente, admin) ve solo los pasos de las secciones que su rol puede usar. Se reabre desde el avatar.

---

## 4. Lo que se difirió (con criterio)

| Pendiente | Motivo |
|---|---|
| Orden "más vendidos" real por ventas | El backend aún no expone ese ranking; se usa la mejor aproximación (destacados/popular) sin inventar datos. |
| Pantalla in-app de "Cambios y devoluciones" | No existe aún; el enlace quedó protegido con validación y respaldo a Contacto. |
| Limpieza de imports muertos heredados | No afectan el build; fuera del alcance de esta operación. |

---

## 5. Estado del proyecto

- **En línea y operativo** de punta a punta:
  - Tienda: https://tienda-iota-gold.vercel.app
  - WMS: https://bodega-nine.vercel.app
  - Backend: https://bodega12-api.onrender.com
- **Builds verificados**: WMS (Vite) y tienda (Expo, 1405 módulos) compilan sin errores; backend sin errores de sintaxis.
- **Verificado en producción**: catálogo, ocultamiento de costos, alertas de vencimiento y los fixes críticos.

### ⚠️ Pendiente en tus manos (seguridad)
Rotar las credenciales compartidas por chat: contraseña de la base de datos (Atlas), API key de Render, y las contraseñas de prueba `Test1234!`. Para vender legalmente: certificado SII + Webpay producción + plan pago (quita el arranque lento). Detalle en `ESTADO-FINAL.md`.

---

## 6. Cómo estos dos programas ayudan a Bodega 12

**La tienda (app de clientes)** convierte a Bodega 12 en un mayorista que vende **24/7 sin depender del mostrador**: el cliente arma su pedido por caja, ve el ahorro frente al precio unitario, agenda su retiro y paga al pasar. El tutorial nuevo hace que **un cliente que nunca compró entienda el modelo en menos de un minuto**, lo que reduce el abandono y las consultas. Favoritos y "recomprar" fidelizan al comprador recurrente (almacenes, kioscos, casinos) que vuelve a pedir lo mismo en un toque.

**El WMS (panel de bodega)** profesionaliza la operación que antes vivía en cuadernos y memoria: pedidos del día, **picking por escaneo** que evita errores de despacho, **recepción masiva** de cargamentos, **ajustes de stock auditados**, **cuadre de caja** por cajero, **control de vencimientos** y **márgenes por producto**. El tour por rol hace que **un empleado nuevo sea productivo el primer día** sin capacitación presencial.

**Juntos** cierran el círculo: lo que el cliente pide en la tienda aparece al instante en la bodega para prepararlo, descuenta stock, registra el movimiento y cuadra la caja — con los precios, costos y vencimientos en un solo lugar. El resultado para Bodega 12: **menos errores que cuestan clientes, más rotación de inventario, y datos confiables para decidir qué comprar y a qué margen**. Es la diferencia entre operar por intuición y operar como una cadena profesional.

---

*Operación ejecutada por el equipo técnico (CTO + flota de agentes). Documentos relacionados: `ESTADO-FINAL.md` (arquitectura y despliegue).*
