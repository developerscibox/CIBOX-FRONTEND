/**
 * SECCIONES ESCONDIDAS DE LA TIENDA — no borradas, escondidas.
 *
 * Quitar una clave de este conjunto devuelve la sección al menú tal como
 * estaba: su pantalla, su ruta y su contenido siguen en el repositorio y
 * registrados en la navegación. Solo dejan de ofrecerse.
 *
 * POR QUÉ ESCONDER Y NO BORRAR
 * El trabajo hecho no se tira. Estas páginas volverán a servir cuando haya con
 * qué llenarlas; borrarlas obligaría a rehacer el diseño, la maquetación y los
 * textos desde cero.
 *
 * POR QUÉ ESCONDERLAS AHORA
 * Un menú lleno de secciones vacías hace dudar de las que sí tienen algo. Es la
 * misma decisión que ya se tomó en el panel de bodega (ver `HIDDEN_NAV` en
 * bodega/src/ui.jsx), y por el mismo motivo.
 *
 * LAS RUTAS SIGUEN VIVAS a propósito: quien tenga el enlace guardado o llegue
 * desde Google no se encuentra un error, sino la página. Lo que desaparece es
 * el camino desde el menú, el pie y la barra superior.
 */
export const SECCIONES_OCULTAS = new Set([
  // Sus tres artículos están escritos a mano en el propio código y no hay forma
  // de publicar uno nuevo sin tocar el repositorio. Un blog que no se actualiza
  // envejece a la vista de todos.
  "Blog",

  // Ya no hay retiro en bodega: todo se despacha a domicilio. Una página que
  // invita a visitar la tienda promete algo que la tienda no hace.
  "Stores",

  // Enumera ventajas genéricas ("compra online", "precios bajos") que no dicen
  // nada que la tienda no demuestre sola con sus precios y su catálogo. Una
  // página que solo se elogia a sí misma le resta espacio a las que sirven.
  "Beneficios",
]);

/** ¿Se ofrece esta sección en los menús? */
export const seccionVisible = (screen) => !SECCIONES_OCULTAS.has(screen);
