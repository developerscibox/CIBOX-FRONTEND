import api from "../api/client";

/**
 * ZONA DE REPARTO Y TARIFA DE DESPACHO — el ÚNICO sitio de la tienda donde se
 * escriben estos dos datos.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PARA CAMBIAR EL PRECIO DEL DESPACHO: se toca EN EL BACKEND, en         │
 * │  backend/src/config/despacho.js, o con la variable DESPACHO_TARIFA_CLP. │
 * │  La tienda lo lee de ahí al arrancar. Aquí no hay nada que editar.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Cibox despacha a domicilio dentro de la zona de Rancagua y solo ahí. No hay
 * retiro en bodega. Quien vive fuera de estas cuatro comunas no puede comprar,
 * y el checkout se lo dice antes de que llene el formulario (el selector de
 * comuna es el primer campo, a propósito).
 *
 * Todos los textos de la tienda que hablan de cobertura o de costo de despacho
 * —portada, página de Despacho, tour de bienvenida, carrito, checkout, resumen
 * del pedido— leen de aquí. Si mañana entra una quinta comuna o sube la tarifa,
 * se toca este archivo y el cambio aparece en toda la app.
 *
 * DE DÓNDE SALE EL NÚMERO
 *
 * La fuente de verdad es el BACKEND, en `backend/src/config/despacho.js`, que
 * es quien de verdad cobra al crear la orden. Al abrir la app, `hydrateDespacho()`
 * trae ese valor por `GET /api/config/despacho` y pisa el de aquí.
 *
 * Los valores escritos abajo son solo el RESPALDO para el primer render y para
 * cuando no hay red: sin ellos la tienda mostraría el despacho en blanco
 * mientras carga.
 *
 * Por eso el precio se cambia en el backend y basta con eso. Si se tocara solo
 * este archivo, el cliente vería un total y Webpay le cobraría otro.
 */

/**
 * Precio fijo del despacho, por pedido, dentro de la zona. En pesos.
 *
 * Es un objeto y no una constante suelta porque `hydrateDespacho()` lo
 * actualiza con lo que diga el backend: un valor exportado por copia se
 * quedaría congelado en el respaldo.
 */
export const despacho = { tarifa: 3990, comunas: ["Rancagua", "Machalí", "Graneros", "Olivar"] };

/** Única región con reparto. El nombre va tal cual lo espera el backend. */
export const DESPACHO_REGION = "Región del Libertador General Bernardo O'Higgins";

/** Las únicas comunas a las que llegamos. El orden es el que ve el cliente. */
export const DESPACHO_COMUNAS = despacho.comunas;

/** "Rancagua, Machalí, Graneros y Olivar" — para meterlo en una frase. */
export const comunasEnTexto = () => {
  const todas = [...despacho.comunas];
  const ultima = todas.pop();
  return `${todas.join(", ")} y ${ultima}`;
};

/** "$3.990" — el formato chileno, para no repetir el toLocaleString. */
export const tarifaEnTexto = () =>
  `$${despacho.tarifa.toLocaleString("es-CL")}`;

/**
 * ¿Despachamos a esta comuna?
 *
 * Compara sin tildes ni mayúsculas porque el dato puede venir de un pedido
 * viejo o escrito a mano ("MACHALI", "machalí"), no solo del selector.
 */
const normalizar = (texto = "") =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const esComunaConReparto = (comuna) =>
  DESPACHO_COMUNAS.some((c) => normalizar(c) === normalizar(comuna));

/**
 * Trae del backend la tarifa y las comunas reales.
 *
 * El backend es quien cobra, así que es quien manda: si el dueño sube el precio
 * allá —incluso con la variable DESPACHO_TARIFA_CLP, que no necesita
 * despliegue—, la tienda tiene que mostrar ESE número y no el que quedó escrito
 * aquí. Sin esto, el cliente veía un total y Webpay le cobraba otro.
 *
 * Best-effort, igual que `hydrateBrand()`: si el backend no responde, se sigue
 * con los valores de respaldo y la tienda funciona.
 */
export async function hydrateDespacho() {
  try {
    const { data } = await api.get("/config/despacho");
    const d = data?.data ?? data;
    if (Number(d?.tarifa_plana_clp) > 0) despacho.tarifa = Number(d.tarifa_plana_clp);
    if (Array.isArray(d?.comunas) && d.comunas.length) {
      // Se muta el arreglo en vez de reasignarlo: DESPACHO_COMUNAS apunta a
      // este mismo objeto y las pantallas ya lo tienen importado.
      despacho.comunas.splice(0, despacho.comunas.length, ...d.comunas);
    }
  } catch {
    /* sin backend → se queda con el respaldo de arriba */
  }
  return despacho;
}
