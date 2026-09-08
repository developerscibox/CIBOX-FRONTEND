import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import WebHeader from "../components/WebHeader";
import WebFooter from "../components/WebFooter";

// Alto de partida, solo para el primer render: la cabecera real son tres
// franjas (avisos + header + navegación) y mide bastante más. Se corrige en
// cuanto `onLayout` reporta el alto verdadero.
const HEADER_HEIGHT_FALLBACK = 180;

export default function WebLayout({ children }) {
  const { height } = useWindowDimensions();

  // Antes se restaban 80px fijos: como la cabecera mide más, el contenido
  // quedaba más alto que la ventana y el sitio salía siempre con barra de
  // desplazamiento y "descolgado" respecto del borde inferior. Ahora se mide.
  const [headerHeight, setHeaderHeight] = useState(HEADER_HEIGHT_FALLBACK);

  // Sin color de fondo: lo pone `App.js` junto con el patrón de marca.
  return (
    <View style={{ flex: 1 }}>
      {/* El envoltorio hereda el z-index alto de la cabecera para que sus
          desplegables (Categorías, buscador) sigan tapando el contenido. */}
      <View
        style={{ zIndex: 1000, position: "relative" }}
        onLayout={(e) => {
          const h = Math.round(e?.nativeEvent?.layout?.height || 0);
          if (h > 0 && h !== headerHeight) setHeaderHeight(h);
        }}
      >
        <WebHeader />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/*
          minHeight = viewport - header: el contenido siempre ocupa al menos
          la pantalla completa, por lo que el footer queda fuera del fold.
          Al hacer scroll hacia abajo el footer aparece naturalmente.
        */}
        <View style={{ minHeight: Math.max(0, height - headerHeight) }}>
          {children}
        </View>
        <WebFooter />
      </ScrollView>
    </View>
  );
}