import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, SafeAreaView, View } from "react-native";
import { verifyEmailRequest } from "../services/authService";
import { colors, spacing, shadows } from "../constants/theme";
import AppText from "../components/AppText";

export default function VerifyEmailScreen({ navigation, route }) {
    console.log('object');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verificando tu correo...");

  const token = useMemo(() => {
    if (route?.params?.token) return route.params.token;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      return search.get("token") || "";
    }

    return "";
  }, [route?.params]);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Token de verificación no encontrado.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const response = await verifyEmailRequest(token);

        setStatus("success");
        setMessage(
          response?.message || "Tu correo fue verificado correctamente."
        );
      } catch (error) {
        setStatus("error");
        setMessage(
          error?.response?.data?.message ||
            "No se pudo verificar el correo. El enlace puede haber expirado."
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
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
            alignItems: "center",
          }}
        >
          {loading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <AppText
                style={{
                  marginTop: 16,
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                Verificando tu correo...
              </AppText>
            </>
          ) : (
            <>
              <AppText style={{ fontSize: 44, marginBottom: 12 }}>
                {status === "success" ? "✅" : "⚠️"}
              </AppText>

              <AppText
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: colors.text,
                  textAlign: "center",
                  marginBottom: 10,
                }}
              >
                {status === "success" ? "Correo verificado" : "No se pudo verificar"}
              </AppText>

              <AppText
                style={{
                  color: colors.muted,
                  textAlign: "center",
                  lineHeight: 22,
                  fontSize: 15,
                  marginBottom: spacing.lg,
                }}
              >
                {message}
              </AppText>

              <Pressable
                onPress={() => navigation.navigate("Auth", { screen: "Login" })}
                style={{
                  height: 52,
                  minWidth: 220,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 24,
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
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}