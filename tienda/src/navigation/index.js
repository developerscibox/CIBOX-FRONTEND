import { useRef } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import AppStack from "./AppStack";
import StorePausedGate from "../components/StorePausedGate";
import Toast from "../components/Toast";
import WelcomeTour from "../components/WelcomeTour";
import AvisoRelanzamiento from "../components/AvisoRelanzamiento";
import { colors } from "../constants/theme";
import { usePushNotifications } from "../hooks/usePushNotifications";


/**
 * Título de la pestaña del navegador, por pantalla.
 *
 * Sin esto React Navigation usa el NOMBRE INTERNO de la ruta, que está en
 * inglés: la pantalla de seguimiento se anunciaba como "TrackOrder" en la
 * pestaña, en el historial y en los marcadores. El cliente no tiene por qué leer
 * los nombres que usamos entre nosotros.
 *
 * Solo hace falta nombrar las rutas cuyo nombre interno NO sirve como título; el
 * resto cae al nombre de la ruta, que ya está en español.
 */
const TITULOS = {
  TrackOrder: "Seguir mi pedido",
  Cart: "Mi carrito",
  Checkout: "Finalizar compra",
  Contact: "Contacto",
  OrderDetail: "Detalle del pedido",
  OrderSuccess: "Compra realizada",
  OrderFailed: "No se pudo pagar",
  HowItWorks: "Quiénes somos",
  Notifications: "Notificaciones",
  ForgotPassword: "Recuperar contraseña",
  ResetPassword: "Nueva contraseña",
  VerifyEmail: "Verificar correo",
  Terms: "Términos y condiciones",
  Privacy: "Política de privacidad",
  Products: "Catálogo",
  ProductDetail: "Producto",
  Auth: "Ingresar",
  Stores: "Nuestras tiendas",
};

const documentTitle = {
  formatter: (options, route) => {
    const propio = options?.title || TITULOS[route?.name];
    // El nombre de la marca al final, como es costumbre en la web: lo primero
    // que se lee en una pestaña angosta es dónde está parado.
    return propio ? `${propio} · Cibox` : "Cibox · Tu supermercado online";
  },
};

const linking = {
  prefixes: [
    "cibox://",
    "https://app.cibox.cl",
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
      // Seguimiento público (sin cuenta). Ruta propia y fácil de dictar por
      // teléfono: es la que le vamos a pasar al cliente que llama preguntando.
      TrackOrder: "seguir-mi-pedido",
      OrderDetail: "orders/:orderId",
      VerifyEmail: "auth/verify-email",
      ResetPassword: "auth/reset-password",
      Notifications: "notifications",
      PantryTab: "pantry",
      FavoritesTab: "favorites",
      OrdersTab: "orders",
      ProfileTab: "profile",
      Auth: "auth",
      // Las pantallas internas (admin/vendor) NO se exponen por deep-link:
      // solo son alcanzables con sesión y rol staff (ver AppStack).
      Contact: "contacto",
      Terms: "terminos-y-condiciones",
      Privacy: "politica-de-privacidad",
      Beneficios: "beneficios",
      Despacho: "despacho",
      Blog: "blog",
      B2BProvider: "b2bprovider",
      Stores: "nuestras-tiendas",
    },
  },
};

// El tema de fábrica pinta las escenas de gris (#f2f2f2) y eso tapaba el patrón
// de marca, que se monta detrás de toda la navegación en `App.js`. Con el fondo
// transparente el patrón se ve en todas las pantallas de la tienda.
const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};

export default function RootNavigation() {
  const navigationRef = useRef(null);

  // Registra el dispositivo para push y maneja taps en notificaciones
  usePushNotifications(navigationRef);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={tema}
      linking={linking}
      documentTitle={documentTitle}
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
          {/* El aviso de relanzamiento va DESPUÉS del tour para quedar por
              encima: mientras esté en pantalla, el tour se mantiene oculto (lo
              consulta en su propio render). Dos ventanas apiladas al entrar
              hacen que el cliente cierre todo sin leer ninguna. */}
          <WelcomeTour />
          <AvisoRelanzamiento navigationRef={navigationRef} />
        </StorePausedGate>
        <Toast />
      </View>
    </NavigationContainer>
  );
}
