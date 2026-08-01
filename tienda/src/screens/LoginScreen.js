import { useState } from "react";
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
import {
  loginRequest,
  resendVerificationRequest,
} from "../services/authService";
import useAuthStore from "../store/authStore";
import { colors, spacing, shadows } from "../constants/theme";
import { getApiErrorField, getApiErrorMessage } from "../utils/apiError";
import AppText from "../components/AppText";

export default function LoginScreen({ navigation }) {
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (field, value) => {
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);

    setSuccessMessage("");
    setErrors((prev) => ({
      ...prev,
      [field]: "",
      general: "",
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Ingresa tu correo";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Ingresa un correo válido";
    }

    if (!password.trim()) {
      nextErrors.password = "Ingresa tu contraseña";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});
      setSuccessMessage("");

      const data = await loginRequest({
        email: email.trim().toLowerCase(),
        password,
      });

      const user = data?.data?.user || data?.user;
      const token =
        data?.data?.accessToken ||
        data?.data?.token ||
        data?.accessToken ||
        data?.token;
      const refreshToken = data?.data?.refreshToken || data?.refreshToken;

      if (!user || !token) {
        throw new Error("No se recibió la sesión correctamente");
      }

      await setAuth({ user, token, refreshToken });

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }

      navigation.reset({
        index: 0,
        routes: [{ name: Platform.OS === "web" ? "Inicio" : "MainTabs" }],
      });
    } catch (error) {
      console.log("LOGIN ERROR:", error?.response?.data || error.message);

      const message = getApiErrorMessage(error, "Login fallido");
      const field = getApiErrorField(error);

      if (message.toLowerCase().includes("verificar")) {
        setErrors((prev) => ({
          ...prev,
          general: "Debes verificar tu correo antes de iniciar sesión.",
        }));
        return;
      }

      if (field && ["email", "password"].includes(field)) {
        setErrors((prev) => ({
          ...prev,
          [field]: message,
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          general: message,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setErrors((prev) => ({
        ...prev,
        email: "Ingresa tu correo para reenviar verificación",
        general: "",
      }));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors((prev) => ({
        ...prev,
        email: "Ingresa un correo válido",
        general: "",
      }));
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      setSuccessMessage("");

      await resendVerificationRequest({
        email: email.trim().toLowerCase(),
      });

      setSuccessMessage("Te enviamos nuevamente el correo de verificación.");
    } catch (error) {
      console.log(
        "RESEND VERIFICATION ERROR:",
        error?.response?.data || error.message,
      );

      const message = getApiErrorMessage(
        error,
        "No se pudo reenviar el correo",
      );

      const field = getApiErrorField(error);

      if (field && ["email", "password"].includes(field)) {
        setErrors((prev) => ({
          ...prev,
          [field]: message,
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          general: message,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputWrapperStyle = (hasError) => ({
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: hasError ? colors.danger : "#cfdcc6",
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 54,
    backgroundColor: colors.surface,
  });

  const errorText = (message) =>
    message ? (
      <AppText
        style={{
          color: colors.danger,
          fontSize: 12,
          marginTop: 6,
          marginLeft: 14,
          fontWeight: "600",
        }}
      >
        {message}
      </AppText>
    ) : null;

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
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xl,
              minHeight: 560,
              justifyContent: "center",
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
              <View style={{ marginBottom: spacing.lg }}>
                <AppText
                  style={{
                    fontSize: 30,
                    fontWeight: "900",
                    color: colors.text,
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  Iniciar sesión
                </AppText>

                <AppText
                  style={{
                    color: colors.muted,
                    textAlign: "center",
                    lineHeight: 20,
                    fontSize: 14,
                    paddingHorizontal: 8,
                  }}
                >
                  Accede a tu cuenta Bodega 12 para revisar pedidos, favoritos y tu
                  perfil.
                </AppText>
              </View>

              {errors.general ? (
                <AppText
                  style={{
                    color: colors.danger,
                    textAlign: "center",
                    marginBottom: spacing.md,
                    fontWeight: "700",
                  }}
                >
                  {errors.general}
                </AppText>
              ) : null}

              {successMessage ? (
                <AppText
                  style={{
                    color: colors.success,
                    textAlign: "center",
                    marginBottom: spacing.md,
                    fontWeight: "700",
                  }}
                >
                  {successMessage}
                </AppText>
              ) : null}

              <View style={{ marginBottom: spacing.md }}>
                <View style={inputWrapperStyle(!!errors.email)}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={errors.email ? colors.danger : colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Correo electrónico"
                    placeholderTextColor="#9a9a9a"
                    value={email}
                    onChangeText={(value) => setField("email", value)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 15,
                    }}
                  />
                </View>
                {errorText(errors.email)}
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <View style={inputWrapperStyle(!!errors.password)}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={errors.password ? colors.danger : colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Contraseña"
                    placeholderTextColor="#9a9a9a"
                    secureTextEntry
                    value={password}
                    onChangeText={(value) => setField("password", value)}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 15,
                    }}
                  />
                </View>
                {errorText(errors.password)}
              </View>

              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={{
                  height: 54,
                  borderRadius: 999,
                  backgroundColor: loading ? colors.muted : colors.primary,
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
                      letterSpacing: 0.4,
                    }}
                  >
                    INGRESAR
                  </AppText>
                )}
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate("ForgotPassword")}
                style={{
                  marginTop: spacing.sm,
                  alignItems: "center",
                }}
              >
                <AppText
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </AppText>
              </Pressable>

              <Pressable
                onPress={handleResendVerification}
                style={{
                  marginTop: spacing.sm,
                  alignItems: "center",
                }}
              >
                <AppText
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Reenviar verificación de correo
                </AppText>
              </Pressable>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginTop: spacing.lg,
                  alignItems: "center",
                }}
              >
                <AppText style={{ color: colors.muted, fontSize: 14 }}>
                  ¿No tienes cuenta?
                </AppText>

                <Pressable onPress={() => navigation.navigate("Register")}>
                  <AppText
                    style={{
                      color: colors.primary,
                      fontWeight: "800",
                      fontSize: 14,
                      marginLeft: 8,
                    }}
                  >
                    Regístrate
                  </AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
