import client from "../api/client";

/**
 * Envío del formulario "Contáctanos".
 *
 * POR QUÉ ESTO EXISTE Y NO UN `mailto:`
 * Antes el botón abría el programa de correo del visitante. En un teléfono
 * suele funcionar; en un navegador de escritorio sin cliente configurado
 * —el caso normal— no ocurría nada y el mensaje se perdía en silencio: ni la
 * persona sabía que no había salido, ni Cibox que alguien había escrito.
 *
 * Ahora el mensaje viaja al servidor, que lo guarda ANTES de intentar avisar
 * por correo. Aunque el correo falle, el mensaje está y se puede responder.
 *
 * Devuelve `{ folio, mensaje }`: el folio son 6 caracteres que la persona
 * puede citar si vuelve a escribir o llama.
 */
export const enviarMensajeDeContacto = async ({
  nombre,
  email,
  telefono = "",
  asunto = "",
  mensaje,
}) => {
  const { data } = await client.post("/contact", {
    nombre,
    email,
    telefono,
    asunto,
    mensaje,
  });
  return data?.data || {};
};
