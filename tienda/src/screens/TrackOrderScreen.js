import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import AppText from "../components/AppText";
import { lookupOrderTracking } from "../services/orderService";
import { getApiErrorMessage } from "../utils/apiError";
import { getCheckoutAddress } from "../utils/checkoutStorage";
import { colors, spacing, radius, shadows } from "../constants/theme";

/**
 * SEGUIR MI PEDIDO — pantalla pública, sin sesión.
 *
 * Es la única forma que tiene de volver quien compró SIN CUENTA: entra su
 * número de pedido y el correo con el que compró, y ve en qué va.
 *
 * POR QUÉ SE PIDEN DOS DATOS Y NO SOLO EL NÚMERO
 * El número de pedido son 6 caracteres que salen del identificador interno, así
 * que se adivinan probando de a uno, y además se leen por encima del hombro o
 * quedan en un papel. Detrás hay qué compró la persona, cuándo y por cuánto. El
 * correo es el segundo dato que solo el dueño del pedido conoce. El servidor
 * responde exactamente lo mismo si el número no existe y si el correo no calza,
 * para no confirmarle a nadie qué números son válidos, y limita los intentos
 * fallidos por si alguien quiere probar a lo bruto.
 *
 * Quien SÍ tiene sesión no pasa por aquí: entra por "Mis pedidos" como siempre.
 */

const CAMPO = {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: 14,
  height: 54,
  backgroundColor: colors.surface,
};

/* ── Barra de avance ───────────────────────────────────────────────────────── */
function BarraAvance({ pct }) {
  return (
    <View
      style={{
        height: 10,
        borderRadius: 999,
        backgroundColor: colors.border,
        overflow: "hidden",
        marginTop: spacing.md,
      }}
    >
      {/* El lima es el color de acción y de estado de la marca (Manual, punto 07). */}
      <View
        style={{
          width: `${Math.max(0, Math.min(100, Number(pct) || 0))}%`,
          height: "100%",
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

/* ── Una etapa de la línea de tiempo ───────────────────────────────────────── */
function Etapa({ paso, ultima }) {
  const hecha = Boolean(paso.cumplido);
  const actual = Boolean(paso.actual);
  const fecha = paso.fecha ? new Date(paso.fecha) : null;

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {/* Riel: punto + línea hasta la etapa siguiente */}
      <View style={{ alignItems: "center", width: 22 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hecha ? colors.accent : colors.surface,
            borderWidth: hecha ? 0 : 2,
            borderColor: colors.border,
          }}
        >
          {hecha ? (
            <Ionicons name="checkmark" size={14} color={colors.accentText} />
          ) : null}
        </View>
        {!ultima ? (
          <View
            style={{
              flex: 1,
              width: 2,
              minHeight: 26,
              backgroundColor: hecha ? colors.accent : colors.border,
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, paddingBottom: ultima ? 0 : spacing.md }}>
        <AppText
          weight={actual ? "bold" : "semiBold"}
          style={{ fontSize: 15, color: hecha ? colors.text : colors.muted }}
        >
          {paso.titulo}
        </AppText>
        {actual && paso.detalle ? (
          <AppText style={{ fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 }}>
            {paso.detalle}
          </AppText>
        ) : null}
        {fecha ? (
          <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
            {fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
            {" · "}
            {fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/* ── Pantalla ──────────────────────────────────────────────────────────────── */
export default function TrackOrderScreen({ route, navigation }) {
  const params = route?.params || {};

  // El folio llega servido desde la pantalla de compra exitosa, para que la
  // persona no tenga que copiarlo a mano justo cuando lo tiene al frente.
  const [folio, setFolio] = useState(params.folio ? String(params.folio) : "");
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pedido, setPedido] = useState(null);

  // Si compró en este mismo navegador, el correo del checkout está guardado:
  // se lo dejamos escrito. Es su propio dato, no se está revelando nada.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (params.email) {
        if (vivo) setEmail(String(params.email));
        return;
      }
      const guardado = await getCheckoutAddress();
      if (vivo && guardado?.email) setEmail(String(guardado.email));
    })();
    return () => {
      vivo = false;
    };
  }, [params.email]);

  const consultar = useCallback(async () => {
    const n = folio.trim();
    const c = email.trim();
    if (!n || !c) {
      setError("Necesitamos el número de tu pedido y el correo con el que compraste.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      setPedido(await lookupOrderTracking({ folio: n, email: c }));
    } catch (err) {
      setPedido(null);
      const status = err?.response?.status;
      // El validador del backend responde `message: "Datos inválidos"` y deja el
      // texto útil ("Revisa el correo", "El número de pedido es muy corto") en
      // `details[0].message`. Leyendo solo `message` la persona veía "Datos
      // inválidos" a secas y no sabía cuál de los dos campos corregir; por eso va
      // getApiErrorMessage, que es el helper que ya usa el resto de la tienda.
      setError(
        status === 429
          ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
          : getApiErrorMessage(
              err,
              "No pudimos consultar tu pedido. Revisa tu conexión e intenta de nuevo.",
            ),
      );
    } finally {
      setCargando(false);
    }
  }, [folio, email]);

  const fechaCompra = pedido?.created_at ? new Date(pedido.created_at) : null;
  const guia = pedido?.shipping?.tracking_number || null;

  return (
    <ScreenContainer maxWidth={720}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <AppText weight="bold" style={{ fontSize: 26, color: colors.text, marginBottom: 6 }}>
              Seguir mi pedido
            </AppText>
            <AppText style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>
              Escribe el número de tu pedido y el correo con el que compraste. No
              necesitas tener cuenta.
            </AppText>
          </View>

          {/* ── Formulario ────────────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: spacing.sm,
              ...shadows.card,
            }}
          >
            <AppText weight="semiBold" style={{ fontSize: 13, color: colors.muted }}>
              Número de pedido
            </AppText>
            <View style={CAMPO}>
              <Ionicons name="receipt-outline" size={18} color={colors.muted} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Ej: A1B2C3"
                placeholderTextColor="#9a9a9a"
                value={folio}
                onChangeText={setFolio}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={consultar}
                style={{ flex: 1, color: colors.text, fontSize: 16, letterSpacing: 1.5 }}
              />
            </View>

            <AppText weight="semiBold" style={{ fontSize: 13, color: colors.muted, marginTop: spacing.sm }}>
              Correo con el que compraste
            </AppText>
            <View style={CAMPO}>
              <Ionicons name="mail-outline" size={18} color={colors.muted} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="tucorreo@ejemplo.cl"
                placeholderTextColor="#9a9a9a"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onSubmitEditing={consultar}
                style={{ flex: 1, color: colors.text, fontSize: 15 }}
              />
            </View>

            {/* Pedimos los dos datos y conviene explicar por qué: si no, se lee
                como un trámite de más. */}
            <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 }}>
              Pedimos el correo para que nadie más que tú pueda ver tu pedido.
            </AppText>

            {error ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  backgroundColor: "#FBECEB",
                  borderRadius: radius.sm,
                  padding: 12,
                  marginTop: spacing.xs,
                }}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <AppText style={{ flex: 1, fontSize: 13, color: colors.danger, lineHeight: 18 }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            {cargando ? (
              <View style={{ height: 48, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <AppButton title="Ver mi pedido" onPress={consultar} style={{ marginTop: spacing.sm }} />
            )}
          </View>

          {/* ── Resultado ─────────────────────────────────────────────────── */}
          {pedido ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                ...shadows.card,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 12, color: colors.muted }}>Pedido</AppText>
                  <AppText weight="bold" style={{ fontSize: 22, color: colors.text, letterSpacing: 2 }}>
                    #{pedido.folio}
                  </AppText>
                </View>
                {fechaCompra ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText style={{ fontSize: 12, color: colors.muted }}>Comprado el</AppText>
                    <AppText weight="semiBold" style={{ fontSize: 14, color: colors.text }}>
                      {fechaCompra.toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <View style={{ marginTop: spacing.md }}>
                <AppText weight="bold" style={{ fontSize: 18, color: colors.primary }}>
                  {pedido.estado}
                </AppText>
                {pedido.detalle ? (
                  <AppText style={{ fontSize: 14, color: colors.muted, marginTop: 3, lineHeight: 20 }}>
                    {pedido.detalle}
                  </AppText>
                ) : null}
                <BarraAvance pct={pedido.avance_pct} />
              </View>

              {guia ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: spacing.md,
                    backgroundColor: colors.background,
                    borderRadius: radius.sm,
                    padding: 12,
                  }}
                >
                  <Ionicons name="cube-outline" size={18} color={colors.primary} />
                  <AppText style={{ flex: 1, fontSize: 13, color: colors.text }}>
                    Número de seguimiento del despacho:{" "}
                    <AppText weight="bold" selectable style={{ color: colors.text }}>
                      {guia}
                    </AppText>
                  </AppText>
                </View>
              ) : null}

              {/* Línea de tiempo */}
              {Array.isArray(pedido.timeline) && pedido.timeline.length ? (
                <View style={{ marginTop: spacing.lg }}>
                  <AppText weight="bold" style={{ fontSize: 15, color: colors.text, marginBottom: spacing.md }}>
                    Avance
                  </AppText>
                  {pedido.timeline.map((paso, i) => (
                    <Etapa
                      key={`${paso.estado}-${i}`}
                      paso={paso}
                      ultima={i === pedido.timeline.length - 1}
                    />
                  ))}
                </View>
              ) : null}

              {/* Qué compró: le sirve para reconocer que este es su pedido. */}
              {Array.isArray(pedido.items) && pedido.items.length ? (
                <View
                  style={{
                    marginTop: spacing.lg,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    paddingTop: spacing.md,
                  }}
                >
                  <AppText weight="bold" style={{ fontSize: 15, color: colors.text, marginBottom: spacing.sm }}>
                    Tu compra
                  </AppText>
                  {pedido.items.map((item, i) => (
                    <View
                      key={`${item.name}-${i}`}
                      style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}
                    >
                      <AppText weight="semiBold" style={{ fontSize: 13, color: colors.muted, minWidth: 30 }}>
                        {item.quantity}×
                      </AppText>
                      <AppText style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>
                        {item.name}
                      </AppText>
                    </View>
                  ))}
                  {Number(pedido.total) > 0 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing.sm,
                        borderTopWidth: 1,
                        borderColor: colors.border,
                        paddingTop: spacing.sm,
                      }}
                    >
                      <AppText weight="semiBold" style={{ fontSize: 14, color: colors.muted }}>
                        Total pagado
                      </AppText>
                      <AppText weight="bold" style={{ fontSize: 16, color: colors.text }}>
                        ${Number(pedido.total).toLocaleString("es-CL")}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                onPress={consultar}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md }}
              >
                <Ionicons name="refresh-outline" size={16} color={colors.primaryMid} />
                <AppText weight="semiBold" style={{ fontSize: 13, color: colors.primaryMid }}>
                  Actualizar
                </AppText>
              </Pressable>
            </View>
          ) : null}

          <AppButton
            title="Volver al catálogo"
            variant="secondary"
            onPress={() => navigation.navigate("Products")}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
