import { createContext, useContext } from 'react';
import { SafeAreaView, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import BrandBackdrop from './BrandBackdrop';

// Marca que ya hay un ScreenContainer más arriba en el árbol: el dashboard de
// vendedor se dibuja incrustado dentro del perfil, y dos patrones de marca
// superpuestos se ven al doble de tinta.
const HayContenedorArriba = createContext(false);

// El contenedor pinta su propio fondo opaco. Sin él, la pantalla deja ver lo que
// haya montado por debajo: en la web las pestañas de la barra inferior no se
// desmontan al cambiar de una a otra, la que pierde el foco solo baja de
// z-index, así que la portada se seguía viendo entre las tarjetas del perfil.
// El patrón de marca se monta acá dentro, detrás del contenido, porque este
// fondo tapa el que `App.js` pone en la raíz de la app.
export default function ScreenContainer({ children, maxWidth = 900, padded = true }) {
  const anidado = useContext(HayContenedorArriba);

  return (
    <HayContenedorArriba.Provider value={true}>
      {/* Anidado va transparente: el contenedor de arriba ya pintó fondo opaco,
          y repetirlo acá taparía su patrón de marca dejando un rectángulo liso
          (el dashboard de vendedor incrustado dentro del perfil). */}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: anidado ? 'transparent' : colors.background }}
      >
        {!anidado && <BrandBackdrop fijoAlViewport={false} />}
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth,
            alignSelf: 'center',
            padding: padded ? spacing.md : 0,
          }}
        >
          {children}
        </View>
      </SafeAreaView>
    </HayContenedorArriba.Provider>
  );
}
