import { SafeAreaView, View, Image, Platform } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Logo de Cibox repetido como marca de agua del fondo (verde tenue).
// En web va FIXED al viewport para que el patrón se vea repetido a lo largo de
// toda la página al hacer scroll. pointerEvents none para no interferir.
function BrandBackdrop() {
  return (
    <Image
      source={require('../../assets/home/logo-tile.png')}
      resizeMode="repeat"
      pointerEvents="none"
      style={{
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.13,
      }}
    />
  );
}

export default function ScreenContainer({ children, maxWidth = 900, padded = true, decorated = false }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {decorated ? <BrandBackdrop /> : null}
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
  );
}
