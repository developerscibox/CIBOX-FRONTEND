import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import MainTabs from "./MainTabs";
import AuthStack from "./AuthStack";
import WebLayout from "../layout/WebLayout";
import useAuthStore from "../store/authStore";
import useCartStore from "../store/cartStore";
import { colors } from "../constants/theme";
import AppText from "../components/AppText";

import HomeScreen from "../screens/HomeScreen";
import PantryScreen from "../screens/PantryScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import OrdersScreen from "../screens/OrdersScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProductsScreen from "../screens/ProductsScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import OrderSuccessScreen from "../screens/OrderSuccessScreen";
import VendorProductsScreen from "../screens/VendorProductsScreen";
import CreateProductScreen from "../screens/CreateProductScreen";
import EditProductScreen from "../screens/EditProductScreen";
import WebpayScreen from "../screens/WebpayScreen";
import VerifyEmailScreen from "../screens/VerifyEmailScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import OrderFailedScreen from "../screens/OrderFailedScreen";
import HowItWorksScreen from "../screens/HowItWorksScreen";
import AdminOrdersScreen from "../screens/AdminOrdersScreen";
import ContactScreen from "../screens/ContactScreen";
import TermsScreen from "../screens/TermsScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import BeneficiosScreen from "../screens/BeneficiosScreen";
import DespachoScreen from "../screens/DespachoScreen";
import BlogScreen from "../screens/BlogScreen";
import StoresScreen from "../screens/StoresScreen";
import B2BProviderScreen from "../screens/B2BProviderScreen";

import brand from "../constants/brand";
const Stack = createNativeStackNavigator();

function withWebLayout(Component) {
  return function WrappedScreen(props) {
    return (
      <WebLayout>
        <Component {...props} />
      </WebLayout>
    );
  };
}

function CartHeaderButton() {
  const navigation = useNavigation();
  const { cartCount } = useCartStore();

  return (
    <Pressable
      onPress={() => navigation.navigate("Cart")}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: `${colors.primaryLight}33`,
        position: "relative",
        marginRight: 8,
      }}
    >
      <Ionicons name="bag-outline" size={21} color={colors.text} />
      {cartCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 4,
          }}
        >
          <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
            {cartCount}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const STAFF_ROLES = ["admin", "manager", "vendor"];

export default function AppStack() {
  const { token, user } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;
  // Solo personal interno (admin/manager/vendor) ve las pantallas de gestión.
  const isStaff = !!token && STAFF_ROLES.includes(user?.role);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => (!isWebDesktop ? <CartHeaderButton /> : null),
      }}
    >
      {isWebDesktop ? (
        <>
          <Stack.Screen
            name="Inicio"
            component={withWebLayout(HomeScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PantryTab"
            component={withWebLayout(PantryScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FavoritesTab"
            component={withWebLayout(FavoritesScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OrdersTab"
            component={withWebLayout(OrdersScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProfileTab"
            component={withWebLayout(ProfileScreen)}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      )}

      <Stack.Screen
        name="Products"
        component={
          isWebDesktop ? withWebLayout(ProductsScreen) : ProductsScreen
        }
        options={isWebDesktop ? { headerShown: false } : { title: "Productos" }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={
          isWebDesktop
            ? withWebLayout(ProductDetailScreen)
            : ProductDetailScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Detalle del producto" }
        }
      />
      <Stack.Screen
        name="Cart"
        component={isWebDesktop ? withWebLayout(CartScreen) : CartScreen}
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Mi carrito", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="Checkout"
        component={
          isWebDesktop ? withWebLayout(CheckoutScreen) : CheckoutScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Checkout", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="OrderDetail"
        component={
          isWebDesktop ? withWebLayout(OrderDetailScreen) : OrderDetailScreen
        }
        options={
          isWebDesktop ? { headerShown: false } : { title: "Detalle de orden" }
        }
      />
      <Stack.Screen
        name="Notifications"
        component={
          isWebDesktop
            ? withWebLayout(NotificationsScreen)
            : NotificationsScreen
        }
        options={
          isWebDesktop ? { headerShown: false } : { title: "Notificaciones" }
        }
      />
      <Stack.Screen
        name="OrderSuccess"
        component={
          isWebDesktop ? withWebLayout(OrderSuccessScreen) : OrderSuccessScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Compra exitosa", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="OrderFailed"
        component={
          isWebDesktop ? withWebLayout(OrderFailedScreen) : OrderFailedScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Compra fallida", headerRight: () => null }
        }
      />
      {/* Pantallas de gestión: SOLO personal interno (admin/manager/vendor).
          Para clientes normales estas rutas no existen. */}
      {isStaff && (
        <>
          <Stack.Screen
            name="VendorProducts"
            component={
              isWebDesktop
                ? withWebLayout(VendorProductsScreen)
                : VendorProductsScreen
            }
            options={
              isWebDesktop ? { headerShown: false } : { title: "Mis productos" }
            }
          />
          <Stack.Screen
            name="CreateProduct"
            component={
              isWebDesktop
                ? withWebLayout(CreateProductScreen)
                : CreateProductScreen
            }
            options={
              isWebDesktop ? { headerShown: false } : { title: "Crear producto" }
            }
          />
          <Stack.Screen
            name="EditProduct"
            component={
              isWebDesktop
                ? withWebLayout(EditProductScreen)
                : EditProductScreen
            }
            options={
              isWebDesktop ? { headerShown: false } : { title: "Editar producto" }
            }
          />
          <Stack.Screen
            name="AdminOrders"
            component={
              isWebDesktop
                ? withWebLayout(AdminOrdersScreen)
                : AdminOrdersScreen
            }
            options={
              isWebDesktop
                ? { headerShown: false }
                : { title: "Panel de órdenes" }
            }
          />
        </>
      )}

      <Stack.Screen
        name="Webpay"
        component={isWebDesktop ? withWebLayout(WebpayScreen) : WebpayScreen}
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Pago con Webpay", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="HowItWorks"
        component={
          isWebDesktop ? withWebLayout(HowItWorksScreen) : HowItWorksScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: `Cómo funciona ${brand.name}` }
        }
      />
      <Stack.Screen
        name="Contact"
        component={
          isWebDesktop ? withWebLayout(ContactScreen) : ContactScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Contáctanos", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="Terms"
        component={
          isWebDesktop ? withWebLayout(TermsScreen) : TermsScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Términos y condiciones", headerRight: () => null }
        }
      />
      <Stack.Screen
        name="Privacy"
        component={
          isWebDesktop ? withWebLayout(PrivacyScreen) : PrivacyScreen
        }
        options={
          isWebDesktop
            ? { headerShown: false }
            : { title: "Política de privacidad", headerRight: () => null }
        }
      />

      <Stack.Screen
        name="Beneficios"
        component={isWebDesktop ? withWebLayout(BeneficiosScreen) : BeneficiosScreen}
        options={isWebDesktop ? { headerShown: false } : { title: "Beneficios" }}
      />
      <Stack.Screen
        name="Despacho"
        component={isWebDesktop ? withWebLayout(DespachoScreen) : DespachoScreen}
        options={isWebDesktop ? { headerShown: false } : { title: "Despacho y retiro" }}
      />
      <Stack.Screen
        name="Blog"
        component={isWebDesktop ? withWebLayout(BlogScreen) : BlogScreen}
        options={isWebDesktop ? { headerShown: false } : { title: "Blog & Noticias" }}
      />
      <Stack.Screen
        name="Stores"
        component={isWebDesktop ? withWebLayout(StoresScreen) : StoresScreen}
        options={isWebDesktop ? { headerShown: false } : { title: "Nuestras tiendas" }}
      />
      <Stack.Screen
        name="B2BProvider"
        component={isWebDesktop ? withWebLayout(B2BProviderScreen) : B2BProviderScreen}
        options={isWebDesktop ? { headerShown: false } : { title: "Proveedores" }}
      />

      {!token && (
        <>
          <Stack.Screen
            name="Auth"
            component={AuthStack}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VerifyEmail"
            component={
              isWebDesktop
                ? withWebLayout(VerifyEmailScreen)
                : VerifyEmailScreen
            }
            options={
              isWebDesktop
                ? { headerShown: false }
                : { title: "Verificar correo", headerRight: () => null }
            }
          />
          <Stack.Screen
            name="ForgotPassword"
            component={
              isWebDesktop
                ? withWebLayout(ForgotPasswordScreen)
                : ForgotPasswordScreen
            }
            options={
              isWebDesktop
                ? { headerShown: false }
                : { title: "Recuperar contraseña", headerRight: () => null }
            }
          />
          <Stack.Screen
            name="ResetPassword"
            component={
              isWebDesktop
                ? withWebLayout(ResetPasswordScreen)
                : ResetPasswordScreen
            }
            options={
              isWebDesktop
                ? { headerShown: false }
                : { title: "Nueva contraseña", headerRight: () => null }
            }
          />
        </>
      )}
    </Stack.Navigator>
  );
}
