import { useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import AppStack from "./AppStack";
import StorePausedGate from "../components/StorePausedGate";
import Toast from "../components/Toast";
import WelcomeTour from "../components/WelcomeTour";
import { colors } from "../constants/theme";
import { usePushNotifications } from "../hooks/usePushNotifications";

const linking = {
  prefixes: [
    "bodega12://",
    // dominio nuevo de Bodega 12 (confirmar con el cliente)
    "https://app.bodega12.cl",
    // despliegue actual en DigitalOcean — quitar cuando se migre al dominio nuevo
    "https://cibox-frontend-j7257.ondigitalocean.app",
    "http://192.168.1.3:8081",
    "http://localhost:8081",
  ],
  config: {
    screens: {
      Inicio: "",
      Products: "products",
      ProductDetail: "products/:productId",
      Cart: "cart",
      Checkout: "checkout",
      // Rutas específicas ANTES que la dinámica
      OrderSuccess: "orders/success",
      OrderFailed: "orders/failed",
      OrderDetail: "orders/:orderId",
      VerifyEmail: "auth/verify-email",
      ResetPassword: "auth/reset-password",
      Notifications: "notifications",
      PantryTab: "pantry",
      FavoritesTab: "favorites",
      OrdersTab: "orders",
      ProfileTab: "profile",
      Auth: "auth",
      // B2BProvider y demás pantallas internas (admin/vendor) NO se exponen por
      // deep-link: solo son alcanzables con sesión y rol staff (ver AppStack).
      Contact: "contacto",
      Terms: "terminos-y-condiciones",
      Privacy: "politica-de-privacidad",
      Beneficios: "beneficios",
      Despacho: "despacho",
      Blog: "blog",
      Stores: "nuestras-tiendas",
    },
  },
};

export default function RootNavigation() {
  const navigationRef = useRef(null);

  // Registra el dispositivo para push y maneja taps en notificaciones
  usePushNotifications(navigationRef);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      fallback={
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      }
    >
      <View style={{ flex: 1 }}>
        {/* Si la tienda está pausada desde el panel, los clientes ven la página de
            mantenimiento (el personal interno navega igual). El tour de bienvenida
            va DENTRO del gate: no debe flotar sobre la página de mantención. */}
        <StorePausedGate>
          <AppStack />
          <WelcomeTour />
        </StorePausedGate>
        <Toast />
      </View>
    </NavigationContainer>
  );
}
