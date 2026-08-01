import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resetPasswordRequest } from "../services/authService";
import { showAppAlert } from "../utils/appAlerts";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "../components/AppText";

export default function ResetPasswordScreen({ navigation, route }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const token = useMemo(() => {
    if (route?.params?.token) return route.params.token;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      return search.get("token") || "";
    }

    return "";
  }, [route?.params]);

  useEffect(() => {
    if (!token) {
      setTokenError("Token de recuperación no encontrado o inválido.");
    }
  }, [token]);

  const handleSubmit = async () => {
    if (!token) {
      showAppAlert("Error", "Token de recuperación no encontrado.");
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      showAppAlert("Faltan datos", "Completa ambos campos.");
      return;
    }

    if (password.length < 6) {
      showAppAlert(
        "Contraseña inválida",
        "La contraseña debe tener al menos 6 caracteres.",
      );
      return;
    }

    if (password !== confirmPassword) {
      showAppAlert("No coinciden", "Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      const response = await resetPasswordRequest({
        token,
        password,
      });

      showAppAlert(
        "Contraseña actualizada",
        response?.message || "Tu contraseña fue actualizada correctamente.",
      );

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      });
    } catch (error) {
      showAppAlert(
        "Error",
        error?.response?.data?.message ||
          "No se pudo restablecer la contraseña. El enlace puede haber expirado.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 28,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xl,
              borderWidth: 1,
              borderColor: "#dfe8d8",
              ...shadows.card,
            }}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={{
                position: "absolute",
                top: spacing.lg,
                left: spacing.lg,
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.muted} />
            </Pressable>

            <View style={{ marginTop: 28 }}>
              <AppText
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Nueva contraseña
              </AppText>

              <AppText
                style={{
                  color: colors.muted,
                  textAlign: "center",
                  lineHeight: 20,
                  fontSize: 14,
                  marginBottom: spacing.lg,
                }}
              >
                Ingresa tu nueva contraseña para recuperar el acceso a tu
                cuenta.
              </AppText>

              {!!tokenError && (
                <AppText
                  style={{
                    color: colors.danger,
                    textAlign: "center",
                    marginBottom: spacing.md,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {tokenError}
                </AppText>
              )}

              <View style={{ marginBottom: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: "#cfdcc6",
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    height: 54,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Nueva contraseña"
                    placeholderTextColor="#9a9a9a"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 15,
                    }}
                  />
                </View>
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: "#cfdcc6",
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    height: 54,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Confirmar contraseña"
                    placeholderTextColor="#9a9a9a"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 15,
                    }}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={loading || !token}
                style={{
                  height: 54,
                  borderRadius: 999,
                  backgroundColor:
                    loading || !token ? colors.muted : colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                  ...shadows.card,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <AppText
                    style={{
                      color: colors.primaryText,
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    ACTUALIZAR CONTRASEÑA
                  </AppText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
