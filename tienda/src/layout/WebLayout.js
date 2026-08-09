import { ScrollView, View, useWindowDimensions } from "react-native";
import WebHeader from "../components/WebHeader";
import WebFooter from "../components/WebFooter";

const HEADER_HEIGHT = 80;

export default function WebLayout({ children }) {
  const { height } = useWindowDimensions();

  // Sin color de fondo: lo pone `App.js` junto con el patrón de marca.
  return (
    <View style={{ flex: 1 }}>
      <WebHeader />
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
        <View style={{ minHeight: height - HEADER_HEIGHT }}>
          {children}
        </View>
        <WebFooter />
      </ScrollView>
    </View>
  );
}