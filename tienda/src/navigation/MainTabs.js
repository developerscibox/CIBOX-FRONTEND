import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import PantryScreen from "../screens/PantryScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import OrdersScreen from "../screens/OrdersScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { colors } from "../constants/theme";
import { Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuthStore from "../store/authStore";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  // El Home decide mostrar "Mis órdenes" según el token; usamos la misma
  // condición aquí para que la tab exista cuando el Home navega a ella.
  const isAuthenticated = useAuthStore((state) => !!state.token);
  const insets = useSafeAreaInsets();

  // Altura base del tab bar + padding del sistema (barra Android o home indicator iOS)
  const TAB_BAR_HEIGHT = 56;
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleAlign: "left",
        headerTitleStyle: {
          fontWeight: "800",
          color: colors.text,
        },
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      {/* 🏠 INICIO */}
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          headerTitle: () => (
            <Image
              source={require("../../assets/logo-cibox.png")}
              style={{ width: 96, height: 60, resizeMode: "contain" }}
            />
          ),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ❤️ FAVORITOS */}
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesScreen}
        options={{
          title: "Favoritos",
          headerTitle: "Favoritos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* 🧺 DESPENSA */}
      <Tab.Screen
        name="PantryTab"
        component={PantryScreen}
        options={{
          title: "Despensa",
          headerTitle: "Mi Despensa",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "basket" : "basket-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* 📦 ÓRDENES (solo si hay sesión) */}
      {isAuthenticated && (
        <Tab.Screen
          name="OrdersTab"
          component={OrdersScreen}
          options={{
            title: "Órdenes",
            headerTitle: "Mis órdenes",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "receipt" : "receipt-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />
      )}

      {/* 👤 PERFIL */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: "Perfil",
          headerTitle: "Mi perfil",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}