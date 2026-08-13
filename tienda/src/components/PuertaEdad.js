import { Modal, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import { colors, radius, shadows, spacing } from "../constants/theme";
import useEdadStore from "../store/edadStore";
import brand from "../constants/brand";

/**
 * Puerta de edad para la venta de alcohol (Ley 19.925).
 *
 * Se monta una sola vez en `App.js` y se abre sola cuando alguna pantalla llama
 * a `exigirMayoriaDeEdad()`. No se puede cerrar por fuera a propósito: hay que
 * responder, porque el punto es que quede una declaración explícita.
 */
export default function PuertaEdad() {
  const preguntando = useEdadStore((s) => s.preguntando);
  const confirmarMayor = useEdadStore((s) => s.confirmarMayor);
  const rechazar = useEdadStore((s) => s.rechazar);

  if (!preguntando) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={rechazar}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(17, 24, 17, 0.72)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.lg,
            ...shadows.card,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <View
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: `${colors.primary}18`,
                justifyContent: "center", alignItems: "center", marginBottom: 12,
              }}
            >
              <Ionicons name="wine-outline" size={30} color={colors.primary} />
            </View>
            <AppText style={{ fontSize: 20, fontWeight: "900", color: colors.text, textAlign: "center" }}>
              ¿Eres mayor de 18 años?
            </AppText>
            <AppText
              style={{
                fontSize: 14, color: colors.muted, textAlign: "center",
                marginTop: 8, lineHeight: 20,
              }}
            >
              Este producto contiene alcohol. En Chile su venta a menores de 18 años
              está prohibida por la Ley 19.925.
            </AppText>
          </View>

          <Pressable
            onPress={confirmarMayor}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <AppText style={{ color: colors.primaryText, fontWeight: "900", fontSize: 15 }}>
              Sí, soy mayor de 18
            </AppText>
          </Pressable>

          <Pressable
            onPress={rechazar}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <AppText style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
              No
            </AppText>
          </Pressable>

          <AppText
            style={{
              fontSize: 11.5, color: colors.muted, textAlign: "center",
              marginTop: 14, lineHeight: 16,
            }}
          >
            Al confirmar declaras ser mayor de edad. {brand.name} puede solicitar tu
            cédula de identidad al momento de la entrega.
            {Platform.OS === "web" ? " Tu respuesta se recuerda en este navegador." : ""}
          </AppText>
        </View>
      </View>
    </Modal>
  );
}
