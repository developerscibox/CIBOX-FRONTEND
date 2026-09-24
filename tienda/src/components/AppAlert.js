import { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import useAlertStore from "../store/alertStore";
import { colors, radius, spacing, shadows } from "../constants/theme";
import AppText from "./AppText";

/**
 * ALERTA CON LA CARA DE CIBOX.
 *
 * Reemplaza los cuadros del navegador (`window.alert` / `window.confirm`), que
 * salen con la tipografía y los botones del sistema operativo, sin logo ni
 * colores, y que en algunos navegadores muestran la dirección del sitio arriba
 * —"localhost dice:"— como si fuera una advertencia de seguridad.
 *
 * Se monta UNA vez en la navegación, igual que el Toast, y dibuja lo que haya
 * en el store. Las pantallas siguen llamando a `showAppAlert(titulo, mensaje)`
 * como siempre: ninguna necesitó cambiar.
 *
 * DÓNDE VA CADA COSA
 * - Toast: confirmaciones livianas que no interrumpen ("Agregado al carrito").
 * - Esta alerta: lo que la persona TIENE que leer antes de seguir, y las
 *   preguntas de sí o no.
 */

const ESTILO = {
  info: { icono: "information-circle", color: colors.primary, fondo: "#E6F0F5" },
  exito: { icono: "checkmark-circle", color: colors.success, fondo: "#E6F4EC" },
  error: { icono: "alert-circle", color: colors.danger, fondo: "#FBECEB" },
  pregunta: { icono: "help-circle", color: colors.primary, fondo: "#E6F0F5" },
};

const usarNativo = Platform.OS !== "web";

export default function AppAlert() {
  const cola = useAlertStore((s) => s.cola);
  const cerrar = useAlertStore((s) => s.cerrar);
  const alerta = cola[0] || null;

  const escala = useRef(new Animated.Value(0.94)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!alerta) {
      escala.setValue(0.94);
      opacidad.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(escala, { toValue: 1, useNativeDriver: usarNativo, friction: 8, tension: 90 }),
      Animated.timing(opacidad, { toValue: 1, duration: 140, useNativeDriver: usarNativo }),
    ]).start();
  }, [alerta, escala, opacidad]);

  // La tecla Escape cierra, como en cualquier cuadro de diálogo. Solo en web.
  useEffect(() => {
    if (Platform.OS !== "web" || !alerta || typeof document === "undefined") return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") cerrar(false);
      if (e.key === "Enter") cerrar(true);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [alerta, cerrar]);

  if (!alerta) return null;

  const esPregunta = Boolean(alerta.pregunta);
  const tipo = alerta.tipo || (esPregunta ? "pregunta" : "info");
  const st = ESTILO[tipo] || ESTILO.info;
  const destructiva = Boolean(alerta.destructive);
  const colorAccion = destructiva ? colors.danger : colors.primary;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => cerrar(false)}>
      {/* Telón: tocarlo fuera cierra, salvo en las preguntas, donde exigir una
          respuesta explícita evita cancelar algo sin querer. */}
      <Pressable
        onPress={() => (esPregunta ? null : cerrar(false))}
        style={{
          flex: 1,
          backgroundColor: "rgba(23,32,42,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <Animated.View
          style={{
            width: "100%",
            maxWidth: 420,
            opacity: opacidad,
            transform: [{ scale: escala }],
          }}
        >
          {/* Se frena la propagación: tocar DENTRO de la tarjeta no debe cerrar. */}
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              overflow: "hidden",
              ...shadows.card,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor: st.fondo,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <Ionicons name={st.icono} size={32} color={st.color} />
              </View>

              <AppText
                weight="bold"
                style={{ fontSize: 18, color: colors.text, textAlign: "center", lineHeight: 24 }}
              >
                {alerta.titulo}
              </AppText>

              {alerta.mensaje ? (
                <ScrollView style={{ maxHeight: 220, marginTop: 6 }} showsVerticalScrollIndicator={false}>
                  <AppText
                    style={{ fontSize: 14.5, color: colors.muted, textAlign: "center", lineHeight: 21 }}
                  >
                    {alerta.mensaje}
                  </AppText>
                </ScrollView>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: esPregunta ? "row" : "column",
                gap: 10,
                padding: spacing.lg,
                paddingTop: spacing.md,
              }}
            >
              {esPregunta ? (
                <Pressable
                  onPress={() => cerrar(false)}
                  style={({ hovered, pressed }) => ({
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    alignItems: "center",
                    backgroundColor: hovered || pressed ? colors.background : colors.surface,
                  })}
                >
                  <AppText weight="bold" style={{ fontSize: 15, color: colors.muted }}>
                    {alerta.cancelText || "Cancelar"}
                  </AppText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => cerrar(true)}
                style={({ hovered, pressed }) => ({
                  flex: esPregunta ? 1 : undefined,
                  paddingVertical: 13,
                  borderRadius: radius.md,
                  alignItems: "center",
                  backgroundColor: hovered || pressed ? colors.primaryMid : colorAccion,
                })}
              >
                <AppText weight="bold" style={{ fontSize: 15, color: colors.primaryText }}>
                  {alerta.confirmText || "Entendido"}
                </AppText>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
