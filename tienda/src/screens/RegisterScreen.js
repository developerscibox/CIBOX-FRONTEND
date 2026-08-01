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
import { registerRequest } from "../services/authService";
import { colors, spacing, shadows } from "../constants/theme";
import { getApiErrorField, getApiErrorMessage } from "../utils/apiError";
import AppText from "../components/AppText";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const setField = (field, value) => {
    if (field === "name") setName(value);
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

    if (!name.trim()) {
      nextErrors.name = "Ingresa tu nombre";
    }

    if (!email.trim()) {
      nextErrors.email = "Ingresa tu correo";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Ingresa un correo válido";
    }

    if (!password.trim()) {
      nextErrors.password = "Ingresa una contraseña";
    } else if (password.length < 8) {
      nextErrors.password = "La contraseña debe tener al menos 8 caracteres";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});

      await registerRequest({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setRegistered(true); // ← mostrar pantalla de éxito
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo crear la cuenta");
      const field = getApiErrorField(error);

      if (field && ["name", "email", "password"].includes(field)) {
        setErrors((prev) => ({ ...prev, [field]: message }));
      } else {
        setErrors((prev) => ({ ...prev, general: message }));
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

  if (registered) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 28,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xl,
              width: "100%",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#dfe8d8",
              ...shadows.card,
            }}
          >
            <AppText style={{ fontSize: 48, marginBottom: 16 }}>📬</AppText>

            <AppText
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: colors.text,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              ¡Cuenta creada!
            </AppText>

            <AppText
              style={{
                color: colors.muted,
                textAlign: "center",
                lineHeight: 22,
                fontSize: 15,
                marginBottom: 32,
              }}
            >
              Te enviamos un correo a{" "}
              <AppText style={{ fontWeight: "800", color: colors.text }}>
                {email.trim().toLowerCase()}
              </AppText>
              {"\n\n"}
              Revisa tu bandeja de entrada y haz clic en el enlace para
              verificar tu cuenta antes de iniciar sesión.
            </AppText>

            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 999,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                ...shadows.card,
              }}
            >
              <AppText
                style={{
                  color: colors.primaryText,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                Ir a iniciar sesión
              </AppText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
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
              minHeight: 660,
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

            <View style={{ marginTop: 20 }}>
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
                  Crear cuenta
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
                  Regístrate en Bodega 12 para guardar tus pedidos, favoritos y
                  datos de compra.
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
                <View style={inputWrapperStyle(!!errors.name)}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={errors.name ? colors.danger : colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Nombre"
                    placeholderTextColor="#9a9a9a"
                    value={name}
                    onChangeText={(value) => setField("name", value)}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 15,
                    }}
                  />
                </View>
                {errorText(errors.name)}
              </View>

              <View style={{ marginBottom: spacing.md }}>
                <View style={inputWrapperStyle(!!errors.email)}>
                  <Ionicons
                    name="mail-outline"
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
                onPress={handleRegister}
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
                    REGISTRARME
                  </AppText>
                )}
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
                  ¿Ya tienes cuenta?
                </AppText>

                <Pressable onPress={() => navigation.navigate("Login")}>
                  <AppText
                    style={{
                      color: colors.primary,
                      fontWeight: "800",
                      fontSize: 14,
                      marginLeft: 8,
                    }}
                  >
                    Inicia sesión
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
