import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import AppText from "../components/AppText";
import useAuthStore from "../store/authStore";
import useOnboardingStore from "../store/onboardingStore";
import { colors, radius, spacing, shadows } from "../constants/theme";
import { getMyProfile } from "../services/userService";
import VendorDashboardScreen from "./VendorDashboardScreen";
import { showAppAlert } from "../utils/appAlerts";

const BENEFITS = [
  "Precios por caja al por mayor",
  "Retiro gratis en bodega (Lo Espejo)",
  "Ahorra comprando por caja vs. unidad",
];

export default function ProfileScreen({ navigation }) {
  const { user, logout, token } = useAuthStore();
  const openTour = useOnboardingStore((s) => s.openTour);
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;

  // En web desktop la ruta del catálogo es "Inicio"; "MainTabs" no existe.
  const goToCatalog = () =>
    isWebDesktop
      ? navigation.navigate("Inicio")
      : navigation.navigate("MainTabs");

  const [profile, setProfile] = useState(user || null);
  const [loading, setLoading] = useState(!!token);

  const isVendor = profile?.role === "vendor";

  const getDisplayName = useCallback(() => {
    return (
      profile?.name ||
      profile?.full_name ||
      profile?.first_name ||
      profile?.username ||
      profile?.email?.split("@")?.[0] ||
      "Usuario"
    );
  }, [profile]);

  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await getMyProfile();
      const profileData = data?.user || data?.data?.user || data?.data || data;

      setProfile(profileData || null);
    } catch (error) {
      console.log("GET PROFILE ERROR:", error?.response?.data || error.message);

      if (error?.response?.status === 401) {
        await logout();
        try {
          navigation.navigate("Auth");
        } catch (navError) {
          try {
            navigation.navigate("MainTabs");
          } catch (fallbackError) {}
        }
        return;
      }

      showAppAlert("Error", "No se pudo cargar el perfil");
      setProfile(user || null);
    } finally {
      setLoading(false);
    }
  }, [token, logout, navigation, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── No autenticado ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={styles.centeredFill}>
          <View style={styles.loginCard}>
            <View style={styles.loginIcon}>
              <Ionicons name="person-outline" size={32} color={colors.primary} />
            </View>
            <AppText style={styles.loginTitle}>
              Inicia sesión para ver tu cuenta
            </AppText>
            <AppText style={styles.loginSubtitle}>
              Accede para revisar tus compras, seguir cada pedido y aprovechar
              tus beneficios en Bodega 12.
            </AppText>
            <AppButton
              title="Iniciar sesión"
              onPress={() => navigation.navigate("Auth")}
            />
            <AppButton
              title="Volver al catálogo"
              onPress={goToCatalog}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ── Cargando ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText style={{ marginTop: spacing.sm, color: colors.muted }}>
            Cargando tu cuenta...
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  const displayName = getDisplayName();
  const initial = String(displayName).trim().charAt(0).toUpperCase() || "U";

  // ── Cuenta ──────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer maxWidth={720}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {/* Encabezado */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initial}</AppText>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={styles.greeting} numberOfLines={1}>
              Hola, {displayName}
            </AppText>
            <AppText style={styles.greetingEmail} numberOfLines={1}>
              {profile?.email || "—"}
            </AppText>
          </View>
        </View>

        {isVendor && (
          <View style={{ marginBottom: spacing.md }}>
            <VendorDashboardScreen hideHeaderInfo />
          </View>
        )}

        {/* Mis pedidos — seguimiento en vivo + historial (pestañas dentro) */}
        <ActionCard
          icon="cube-outline"
          iconColor="#8b5cf6"
          title="Mis pedidos"
          description="Sigue en vivo los pedidos en curso (pago → preparación → retiro) y revisa tu historial de compras finalizadas."
          buttonTitle="Ver mis pedidos"
          onPress={() => navigation.navigate("OrdersTab", { mode: "tracking" })}
        />

        {/* Mis beneficios */}
        <View style={styles.benefitsCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
              <Ionicons name="pricetags-outline" size={20} color="#fff" />
            </View>
            <AppText style={styles.cardTitle}>Mis beneficios</AppText>
          </View>
          <View style={{ marginTop: 4 }}>
            {BENEFITS.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.primary}
                />
                <AppText style={styles.benefitText}>{benefit}</AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Accesos rápidos: despensa + favoritos + notificaciones */}
        <View style={styles.quickRow}>
          <QuickTile
            icon="basket-outline"
            iconColor="#16a34a"
            label="Mi despensa"
            onPress={() => navigation.navigate("PantryTab")}
          />
          <QuickTile
            icon="heart-outline"
            iconColor="#ec4899"
            label="Favoritos"
            onPress={() => navigation.navigate("FavoritesTab")}
          />
          <QuickTile
            icon="notifications-outline"
            iconColor="#f59e0b"
            label="Notificaciones"
            onPress={() => navigation.navigate("Notifications")}
          />
        </View>

        {/* Datos de cuenta */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: "#64748b" }]}>
              <Ionicons name="person-outline" size={20} color="#fff" />
            </View>
            <AppText style={styles.cardTitle}>Datos de cuenta</AppText>
          </View>

          <DataRow label="Nombre" value={displayName} />
          <DataRow label="Email" value={profile?.email || "—"} />
          {!!profile?.phone && (
            <DataRow label="Teléfono" value={profile.phone} last />
          )}
        </View>

        {/* Ayuda */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: "#0ea5e9" }]}>
              <Ionicons name="help-circle-outline" size={20} color="#fff" />
            </View>
            <AppText style={styles.cardTitle}>Ayuda</AppText>
          </View>
          <AppText style={styles.cardDescription}>
            ¿Primera vez aquí? Repasa cómo comprar por caja y retirar en bodega.
          </AppText>
          <AppButton
            title="Ver tutorial"
            onPress={() => {
              if (typeof openTour === "function") openTour();
            }}
            variant="secondary"
          />
        </View>

        {/* Sesión */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.danger }]}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </View>
            <AppText style={styles.cardTitle}>Sesión</AppText>
          </View>
          <AppButton
            title="Cerrar sesión"
            onPress={async () => {
              await logout();
              try {
                navigation.navigate("Auth");
              } catch (navError) {
                try {
                  navigation.navigate("MainTabs");
                } catch (fallbackError) {}
              }
            }}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────
function ActionCard({ icon, iconColor, title, description, buttonTitle, onPress }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <AppText style={styles.cardTitle}>{title}</AppText>
      </View>
      <AppText style={styles.cardDescription}>{description}</AppText>
      <AppButton title={buttonTitle} onPress={onPress} />
    </View>
  );
}

function QuickTile({ icon, iconColor, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickTile, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <AppText style={styles.quickLabel}>{label}</AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function DataRow({ label, value, last }) {
  return (
    <View style={[styles.dataRow, last && { borderBottomWidth: 0 }]}>
      <AppText style={styles.dataLabel}>{label}</AppText>
      <AppText style={styles.dataValue} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centeredFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },

  // No autenticado
  loginCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.card,
  },
  loginIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  loginSubtitle: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Encabezado
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.card,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  greetingEmail: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },

  // Tarjeta base
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    flex: 1,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // Beneficios (destacada)
  benefitsCard: {
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: radius.lg,
    backgroundColor: `${colors.primary}0d`,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
  },
  benefitText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },

  // Accesos rápidos (favoritos / notificaciones)
  quickRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadows.card,
  },
  quickLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  // Datos de cuenta
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
    textAlign: "right",
  },
});
