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
import BrandBackdrop from "./src/components/BrandBackdrop";
import PuertaEdad from "./src/components/PuertaEdad";
import useEdadStore from "./src/store/edadStore";
import { colors } from "./src/constants/theme";
import { hydrateBrand } from "./src/constants/brand";

export default function App() {
  const { loadAuth, isLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const cargarEdad = useEdadStore((s) => s.cargar);

  useEffect(() => {
    loadAuth();
    // Recupera si el usuario ya declaró ser mayor de edad en este dispositivo,
    // para no volver a preguntárselo en cada visita.
    cargarEdad();
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
      {/* El patrón de marca se monta acá, una sola vez y detrás de toda la
          navegación, para que sea el fondo de todas las pantallas de la
          tienda. El color base también vive acá: los contenedores de pantalla
          van transparentes para no taparlo. */}
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandBackdrop />
        <RootNavigation />
        {/* Puerta de edad: se monta una vez y se abre sola cuando alguna
            pantalla pide confirmar la mayoría de edad para vender alcohol. */}
        <PuertaEdad />
      </View>
    </SafeAreaProvider>
  );
}