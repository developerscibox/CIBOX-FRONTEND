import useAlertStore from "../store/alertStore";

/**
 * AVISOS DE LA TIENDA, CON LA CARA DE CIBOX.
 *
 * Antes esto llamaba a `window.alert` en web y a `Alert.alert` en el teléfono.
 * El cuadro del navegador sale con la tipografía del sistema, sin logo ni
 * colores, y encima varios navegadores le ponen arriba el dominio del sitio
 * —"www.cibox.cl dice:"—, que se lee como una advertencia de seguridad en vez
 * de como un mensaje de la tienda.
 *
 * Ahora empujan a un store y los dibuja `<AppAlert/>`, montado una sola vez en
 * la navegación. LA FORMA DE LLAMARLAS NO CAMBIÓ: las 21 pantallas que ya las
 * usaban siguen funcionando sin tocar una línea.
 *
 * Cuándo usar cuál:
 * - `showToast` (store/toastStore): confirmaciones livianas que no interrumpen.
 * - `showAppAlert`: lo que la persona tiene que leer antes de seguir.
 * - `confirmAppAction`: preguntas de sí o no.
 */

/**
 * Aviso de una sola salida.
 *
 * `tipo` es opcional y solo cambia el ícono y el color: "info" (por defecto),
 * "exito" o "error". Quien ya llamaba con dos argumentos no se entera.
 */
export const showAppAlert = (title, message = "", tipo = "info") => {
  useAlertStore.getState().push({
    titulo: String(title ?? ""),
    mensaje: String(message ?? ""),
    tipo,
    pregunta: false,
  });
};

/** Atajos para no tener que acordarse del tercer argumento. */
export const showAppSuccess = (title, message = "") => showAppAlert(title, message, "exito");
export const showAppError = (title, message = "") => showAppAlert(title, message, "error");

/**
 * Pregunta de sí o no. Se mantiene la firma con callback que ya usaban las
 * pantallas (y no una promesa) para no obligar a reescribirlas.
 */
export const confirmAppAction = ({
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  useAlertStore.getState().push({
    titulo: String(title ?? ""),
    mensaje: String(message ?? ""),
    tipo: destructive ? "error" : "pregunta",
    pregunta: true,
    confirmText,
    cancelText,
    destructive,
    onConfirm,
    onCancel,
  });
};
