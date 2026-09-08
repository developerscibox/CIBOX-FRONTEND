import { Image, Platform } from 'react-native';

/**
 * Patrón de productos de Cibox repetido como marca de agua del fondo.
 *
 * Va montado una sola vez en la raíz de la app (`App.js`), detrás de toda la
 * navegación, para que se vea en todas las pantallas de la tienda. Por eso los
 * contenedores de pantalla (`ScreenContainer`, `InfoPageLayout`, `WebLayout`)
 * no llevan color de fondo propio: si lo llevaran, taparían el patrón.
 *
 * En web va FIXED al viewport para que el patrón quede quieto y se vea repetido
 * a lo largo de toda la página al hacer scroll. pointerEvents none para no
 * interferir con los toques.
 *
 * Con `fijoAlViewport={false}` se ancla al contenedor que lo monta. Lo usa
 * `ScreenContainer`: ahí un fixed se cuelga del primer ancestro con transform
 * (los que animan la navegación) y el patrón termina anclado a medio scroll,
 * cubriendo solo un trozo de la pantalla.
 */
export default function BrandBackdrop({ fijoAlViewport = true }) {
  return (
    <Image
      source={require('../../assets/home/patron.png')}
      resizeMode="repeat"
      pointerEvents="none"
      style={{
        position: fijoAlViewport && Platform.OS === 'web' ? 'fixed' : 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        // El ancho y el alto van explícitos: react-native-web le pone al Image
        // el tamaño intrínseco del archivo (560x560) y ese gana sobre el
        // top/right/bottom/left, dejando el patrón en un cuadrado de la esquina
        // en vez de cubrir la pantalla.
        width: '100%', height: '100%',
        // 0.22 y no 0.13: el patrón estaba corrupto (el generador viejo rellenaba
        // el interior de los íconos, que en el arte son contornos huecos). El tile
        // limpio tiene ~43% menos tinta, así que con la opacidad anterior el fondo
        // quedaba prácticamente vacío.
        opacity: 0.22,
      }}
    />
  );
}
