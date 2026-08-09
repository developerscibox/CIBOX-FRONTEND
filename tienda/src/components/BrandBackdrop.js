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
 */
export default function BrandBackdrop() {
  return (
    <Image
      source={require('../../assets/home/patron.png')}
      resizeMode="repeat"
      pointerEvents="none"
      style={{
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        // El ancho y el alto van explícitos: react-native-web le pone al Image
        // el tamaño intrínseco del archivo (320x320) y ese gana sobre el
        // top/right/bottom/left, dejando el patrón en un cuadrado de la esquina
        // en vez de cubrir la pantalla.
        width: '100%', height: '100%',
        opacity: 0.13,
      }}
    />
  );
}
