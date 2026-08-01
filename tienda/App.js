import { useEffect } from "react";
import { SafeAreaView, ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import useAuthStore from "./src/store/authStore";
import RootNavigation from "./src/navigation";

// Importa SOLO los 3 pesos usados desde subpaths individuales.
// Importar desde el barrel "@expo-google-fonts/poppins" arrastra los ~18 TTF
// de toda la familia al bundle; los subpaths cargan únicamente su .ttf.
import { useFonts } from "@expo-google-fonts/poppins/useFonts";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import AppText from "./src/components/AppText";
import { hydrateBrand } from "./src/constants/brand";

export default function App() {
  const { loadAuth, isLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    loadAuth();
    // Identidad de Cibox (RUT, razón social, contacto, dirección): la fuente de
    // verdad es el backend. hydrateBrand nunca lanza; si falla, la tienda sigue
    // con los valores locales de constants/brand.js.
    hydrateBrand();
  }, [loadAuth]);

  // ⛔ Espera a que carguen fuentes Y auth
  if (isLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator />
            <AppText style={{ marginTop: 10 }}>Cargando...</AppText>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigation />
    </SafeAreaProvider>
  );
}