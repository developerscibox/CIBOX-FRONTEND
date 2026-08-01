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
import { forgotPasswordRequest } from "../services/authService";
import { showAppAlert } from "../utils/appAlerts";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "../components/AppText";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      showAppAlert("Falta correo", "Ingresa tu correo");
      return;
    }

    try {
      setLoading(true);

      await forgotPasswordRequest({
        email: email.trim().toLowerCase(),
      });

      showAppAlert(
        "Correo enviado",
        "Si el correo existe, recibirás instrucciones para cambiar tu contraseña."
      );

      navigation.goBack();
    } catch (error) {
      showAppAlert(
        "Error",
        error?.response?.data?.message || "No se pudo procesar la solicitud"
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
                Recuperar contraseña
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
                Ingresa tu correo y te enviaremos instrucciones.
              </AppText>

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
                    name="mail-outline"
                    size={18}
                    color={colors.muted}
                    style={{ marginRight: 10 }}
                  />

                  <TextInput
                    placeholder="Correo electrónico"
                    placeholderTextColor="#9a9a9a"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                    }}
                  >
                    ENVIAR
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