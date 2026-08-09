import { SafeAreaView, View } from 'react-native';
import { spacing } from '../constants/theme';

// Sin color de fondo: el fondo (color base + patrón de marca) lo pone `App.js`
// detrás de toda la navegación, y un fondo opaco acá lo taparía.
export default function ScreenContainer({ children, maxWidth = 900, padded = true }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
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
