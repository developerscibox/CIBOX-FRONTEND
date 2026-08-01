import { ScrollView, View, useWindowDimensions } from "react-native";
import WebHeader from "../components/WebHeader";
import WebFooter from "../components/WebFooter";
import { colors } from "../constants/theme";

const HEADER_HEIGHT = 80;

export default function WebLayout({ children }) {
  const { height } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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