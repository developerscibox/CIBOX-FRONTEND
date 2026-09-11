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
 * El despacho es tarifa plana dentro de la zona, SALVO que la mercadería llegue
 * al mínimo de envío gratis (`gratisDesde`), y entonces no se cobra. El mínimo
 * se mide sobre el monto de los productos ANTES de cupones, igual que en el
 * servidor: la explicación de por qué es así está en backend/src/config/despacho.js.
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
export const despacho = {
  tarifa: 3990,
  // Desde este monto de mercadería el despacho no se cobra. 0 = promoción
  // apagada. Va DENTRO del objeto por la misma razón que la tarifa: una const
  // suelta se congelaría en el respaldo y hydrateDespacho() no la alcanzaría.
  gratisDesde: 60000,
  comunas: ["Rancagua", "Machalí", "Graneros", "Olivar"],
};

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

/** "$60.000" — el mínimo desde el cual el despacho sale gratis. */
export const envioGratisEnTexto = () =>
  `$${despacho.gratisDesde.toLocaleString("es-CL")}`;

/** true si la promoción está encendida. Con 0 no hay envío gratis. */
export const hayEnvioGratisVigente = () => Number(despacho.gratisDesde) > 0;

/**
 * ¿Este carrito llega al mínimo?
 *
 * El monto que se mira es el de la MERCADERÍA, antes de cupones: es la misma
 * base que usa el servidor para cobrar, y tiene que ser la misma o la tienda
 * mostraría un despacho y Webpay cobraría otro. El `>=` también es el del
 * servidor: quien llega justo a $60.000 se lleva el despacho.
 */
export const tieneEnvioGratis = (subtotal) =>
  hayEnvioGratisVigente() && Number(subtotal || 0) >= Number(despacho.gratisDesde);

/** Lo que cuesta el despacho para un carrito de este monto. */
export const costoDespacho = (subtotal) =>
  tieneEnvioGratis(subtotal) ? 0 : despacho.tarifa;

/** "$3.990" o "Gratis" — lo que se escribe en la línea del despacho. */
export const costoDespachoEnTexto = (subtotal) =>
  tieneEnvioGratis(subtotal)
    ? "Gratis"
    : `$${despacho.tarifa.toLocaleString("es-CL")}`;

/**
 * La frase que menciona el envío gratis, o cadena vacía si la promoción está
 * apagada (mínimo en 0).
 *
 * Existe porque apagar la promoción es cambiar una variable en el servidor,
 * sin desplegar nada. Si cada pantalla interpolara el monto por su cuenta, al
 * apagarla la tienda quedaría publicando "gratis desde $0" en nueve sitios y
 * habría que salir a corregir textos a mano. Cada pantalla pasa lo que va
 * ANTES y DESPUÉS del monto, así conserva su redacción y la frase entera
 * desaparece junto con la promoción.
 */
export const fraseEnvioGratis = (antes = "", despues = "") =>
  hayEnvioGratisVigente() ? `${antes}${envioGratisEnTexto()}${despues}` : "";

/**
 * Cuánto falta para el envío gratis. 0 cuando ya se alcanzó o cuando la
 * promoción está apagada, para que quien llame solo tenga que preguntar por
 * mayor que cero.
 */
export const faltaParaEnvioGratis = (subtotal) => {
  if (!hayEnvioGratisVigente()) return 0;
  const falta = Number(despacho.gratisDesde) - Number(subtotal || 0);
  return falta > 0 ? Math.ceil(falta) : 0;
};

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
    // Aquí NO se copia el guard "> 0" de la tarifa. El backend documenta que un
    // umbral de 0 apaga la promoción, y con ese guard el 0 nunca se escribiría:
    // la tienda seguiría prometiendo envío gratis después de haberlo apagado en
    // el servidor. Se comprueba que el número exista y sea número, no que sea
    // positivo.
    const umbral = Number(d?.envio_gratis_desde_clp);
    if (Number.isFinite(umbral) && umbral >= 0) despacho.gratisDesde = umbral;
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
