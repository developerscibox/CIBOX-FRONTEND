import { useEffect, useState } from "react";
import { SafeAreaView, ActivityIndicator, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import useAuthStore from "./src/store/authStore";
import RootNavigation from "./src/navigation";

// Importa SOLO los 3 pesos usados desde subpaths individuales.
// Importar desde el barrel "@expo-google-fonts/poppins" arrastra los ~18 TTF
// de toda la familia al bundle; los subpaths cargan únicamente su .ttf.
import { useFonts } from "@expo-google-fonts/montserrat/useFonts";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import AppText from "./src/components/AppText";
import BrandBackdrop from "./src/components/BrandBackdrop";
import PuertaEdad from "./src/components/PuertaEdad";
import useEdadStore from "./src/store/edadStore";
import { colors } from "./src/constants/theme";
import { hydrateBrand } from "./src/constants/brand";
import { hydrateDespacho } from "./src/constants/delivery";

export default function App() {
  const { loadAuth, isLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Inter_400Regular,
  });

  const cargarEdad = useEdadStore((s) => s.cargar);
  // El precio del despacho se cobra en el servidor, así que se espera igual que
  // la sesión: mostrar un monto y cobrar otro no es una opción.
  const [despachoListo, setDespachoListo] = useState(false);

  useEffect(() => {
    // La página se declara en español.
    //
    // Expo genera el index.html con lang="en", así que Chrome daba la tienda por
    // inglesa y le ofrecía traducirla al visitante. Traduciendo, "RUT" se
    // convertía en "RODERA" —rut en inglés es un surco— y el formulario pedía
    // datos que nadie entiende. Con esto el navegador deja de ofrecer traducir
    // algo que ya está en el idioma del cliente.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.lang = "es-CL";
    }
    loadAuth();
    // Recupera si el usuario ya declaró ser mayor de edad en este dispositivo,
    // para no volver a preguntárselo en cada visita.
    cargarEdad();
    // Identidad de Cibox (RUT, razón social, contacto, dirección): la fuente de
    // verdad es el backend. hydrateBrand nunca lanza; si falla, la tienda sigue
    // con los valores locales de constants/brand.js.
    hydrateBrand();
    // La tarifa de despacho la fija el backend, que es quien cobra: si aquí se
    // mostrara otra, el cliente vería un total y Webpay le cobraría uno distinto.
    // Se ESPERA antes de dibujar (ver el gate de abajo) porque mutar el objeto
    // no vuelve a renderizar lo ya pintado: si llegara tarde, el carrito se
    // quedaría mostrando el precio de respaldo.
    hydrateDespacho().finally(() => setDespachoListo(true));
  }, [loadAuth]);

  // ⛔ Espera a que carguen fuentes, sesión Y la tarifa de despacho
  if (isLoading || !fontsLoaded || !despachoListo) {
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