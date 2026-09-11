import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import brand from "../constants/brand";

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

/* ── Insignia por estado ───────────────────────────────────────────────────── */
// Icono y color con que se presenta cada estado en la cabecera. Lo que está en
// curso va en azul Cibox, el entregado en verde, y anulado/reembolsado en rojo.
// Solo tokens del tema; un estado que no esté aquí cae al azul neutro.
const INSIGNIA = {
  pending: { icono: "time-outline", color: colors.primary },
  paid: { icono: "card-outline", color: colors.primary },
  preparing: { icono: "cube-outline", color: colors.primary },
  ready: { icono: "checkmark-done-outline", color: colors.primary },
  shipped: { icono: "car-outline", color: colors.primary },
  delivered: { icono: "home-outline", color: colors.success },
  cancelled: { icono: "close-circle-outline", color: colors.danger },
  refunded: { icono: "close-circle-outline", color: colors.danger },
};
const insigniaDe = (status) =>
  INSIGNIA[status] || { icono: "ellipse-outline", color: colors.primary };

// Estados de los que el pedido ya no se mueve: ahí no tiene sentido seguir
// consultando al servidor.
const ESTADOS_FINALES = ["delivered", "cancelled", "refunded"];
const ESTADOS_ANOMALOS = ["cancelled", "refunded"];

// Cada cuánto se vuelve a consultar, en silencio, un pedido que sigue en curso.
const INTERVALO_REFRESCO_MS = 60 * 1000;

// Nombre del courier para mostrar. "blueexpress_manual" es el valor por defecto
// del modelo (guía cargada a mano desde el panel) y al cliente no le dice nada,
// así que se omite; cualquier variante de Blue Express se muestra con su nombre.
// No se arma ningún enlace al courier: no hay URL oficial confirmada.
const nombreCarrier = (carrier) => {
  const c = String(carrier || "").trim();
  if (!c || c === "blueexpress_manual") return null;
  return c.toLowerCase().includes("blueexpress") ? "Blue Express" : c;
};

// Las fechas llegan del servidor como ISO. Si alguna viene mal, mejor no mostrar
// nada que un "Invalid Date".
const aFecha = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fechaLarga = (d) =>
  d.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const fechaConHora = (d) =>
  `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })} a las ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;

/* ── Fila de dato (entrega estimada, retiro, guía) ─────────────────────────── */
function Dato({ icono, children }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        marginTop: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: radius.sm,
        padding: 12,
      }}
    >
      <Ionicons name={icono} size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

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
  // Anulado o reembolsado: la etapa existe, pero no es un avance. Va en rojo y
  // con una cruz para que no se lea como un paso más del camino feliz.
  const anomala = Boolean(paso.anomalo);
  const fecha = aFecha(paso.fecha);

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
            backgroundColor: anomala ? colors.danger : hecha ? colors.accent : colors.surface,
            borderWidth: hecha || anomala ? 0 : 2,
            borderColor: colors.border,
          }}
        >
          {anomala ? (
            <Ionicons name="close" size={14} color={colors.primaryText} />
          ) : hecha ? (
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
          style={{ fontSize: 15, color: anomala ? colors.danger : hecha ? colors.text : colors.muted }}
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

// El validador del backend responde `message: "Datos inválidos"` y deja el
// texto útil ("Revisa el correo", "El número de pedido es muy corto") en
// `details[0].message`. Leyendo solo `message` la persona veía "Datos
// inválidos" a secas y no sabía cuál de los dos campos corregir; por eso va
// getApiErrorMessage, que es el helper que ya usa el resto de la tienda.
const mensajeDeError = (err) =>
  err?.response?.status === 429
    ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
    : getApiErrorMessage(err, "No pudimos consultar tu pedido. Revisa tu conexión e intenta de nuevo.");

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
  // Con qué folio y correo se cargó el pedido que está en pantalla. La
  // actualización automática consulta con ESTOS datos, no con lo que haya en el
  // formulario: si la persona está escribiendo otro número, no hay que pisarle
  // el resultado que está mirando.
  const [consultaActiva, setConsultaActiva] = useState(null);

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

  // "Ver mi pedido": la única vía que lee el formulario.
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
      setConsultaActiva({ folio: n, email: c });
    } catch (err) {
      setPedido(null);
      setConsultaActiva(null);
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, [folio, email]);

  // "Actualizar", dentro de la tarjeta: vuelve a consultar el pedido que está
  // en pantalla con los datos con que se cargó, igual que el refresco
  // automático. Lo que haya en el formulario no cuenta: si la persona ya
  // empezó a escribir otro número, no hay que validarle eso ni borrarle la
  // tarjeta que está mirando. Si falla, se conserva lo último que se vio.
  const refrescar = useCallback(async () => {
    if (!consultaActiva) return;
    setCargando(true);
    setError("");
    try {
      const nuevo = await lookupOrderTracking(consultaActiva);
      if (nuevo) setPedido(nuevo);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, [consultaActiva]);

  // Actualización automática: mientras el pedido siga en curso se vuelve a
  // consultar cada minuto, en silencio (sin spinner y sin tocar el error). Si la
  // consulta falla —red caída, límite de intentos— se deja lo que ya está en
  // pantalla: un estado de hace un minuto sirve más que un error que aparece
  // solo. En los estados finales no se consulta más, porque no van a cambiar.
  const statusPedido = pedido?.status || null;
  useEffect(() => {
    if (!consultaActiva || !statusPedido || ESTADOS_FINALES.includes(statusPedido)) {
      return undefined;
    }
    let vivo = true;
    let enVuelo = false;
    const id = setInterval(async () => {
      if (enVuelo) return;
      enVuelo = true;
      try {
        const nuevo = await lookupOrderTracking(consultaActiva);
        if (vivo && nuevo) setPedido(nuevo);
      } catch {
        /* se mantiene el último resultado */
      } finally {
        enVuelo = false;
      }
    }, INTERVALO_REFRESCO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [consultaActiva, statusPedido]);

  const fechaCompra = aFecha(pedido?.created_at);
  const guia = pedido?.shipping?.tracking_number || null;
  const carrier = guia ? nombreCarrier(pedido?.shipping?.carrier) : null;
  const insignia = insigniaDe(statusPedido);
  const esFinal = ESTADOS_FINALES.includes(statusPedido);
  // Anulado/reembolsado, o una etapa que el servidor marcó como anómala: la
  // barra de avance se oculta, porque el pedido no "avanzó" hasta ahí.
  const anomalo =
    ESTADOS_ANOMALOS.includes(statusPedido) ||
    (Array.isArray(pedido?.timeline) && pedido.timeline.some((p) => p?.anomalo));
  // `siguiente` es opcional en la respuesta: puede no venir o venir vacío.
  const siguiente = typeof pedido?.siguiente === "string" ? pedido.siguiente.trim() : "";
  const entregadoEl = statusPedido === "delivered" ? aFecha(pedido?.delivered_at) : null;
  // La estimación deja de tener sentido cuando el pedido ya llegó o se anuló.
  const entregaEstimada = esFinal ? null : aFecha(pedido?.shipping?.estimated_delivery);
  const esRetiro = pedido?.delivery_method === "pickup";
  const retiroEn = esRetiro ? String(pedido?.pickup?.location || "").trim() : "";
  const retiroFecha = esRetiro ? aFecha(pedido?.pickup?.committed_date) : null;
  // El WhatsApp de la marca se hidrata desde el backend al abrir la app
  // (constants/brand.js). Si no hay número, el botón no se muestra. Solo
  // dígitos, como exige wa.me; el folio va codificado dentro del texto.
  const whatsapp = String(brand.contact?.whatsapp || "").replace(/\D/g, "");
  const urlWhatsapp =
    whatsapp && pedido?.folio
      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
          `Hola, tengo una consulta sobre mi pedido #${pedido.folio}`,
        )}`
      : null;
  const refrescoActivo = Boolean(consultaActiva && statusPedido && !esFinal);

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

              {/* Cabecera de estado: insignia con icono y color según el estado,
                  título y detalle. Es lo primero que busca quien entra aquí. */}
              <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: insignia.color,
                  }}
                >
                  <Ionicons name={insignia.icono} size={24} color={colors.primaryText} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 18, color: insignia.color, lineHeight: 24 }}>
                    {pedido.estado}
                  </AppText>
                  {pedido.detalle ? (
                    <AppText style={{ fontSize: 14, color: colors.muted, marginTop: 3, lineHeight: 20 }}>
                      {pedido.detalle}
                    </AppText>
                  ) : null}
                  {entregadoEl ? (
                    <AppText weight="semiBold" style={{ fontSize: 13, color: colors.success, marginTop: 4 }}>
                      Entregado el {fechaConHora(entregadoEl)}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {/* Sin barra cuando el pedido se anuló o reembolsó: no hay avance que mostrar. */}
              {!anomalo ? <BarraAvance pct={pedido.avance_pct} /> : null}

              {siguiente ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: spacing.md,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.accent,
                    paddingLeft: 10,
                  }}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semiBold" style={{ fontSize: 12, color: colors.muted }}>
                      Qué sigue
                    </AppText>
                    <AppText style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                      {siguiente}
                    </AppText>
                  </View>
                </View>
              ) : null}

              {entregaEstimada || retiroEn || guia ? (
                <View style={{ marginTop: spacing.sm }}>
                  {entregaEstimada ? (
                    <Dato icono="calendar-outline">
                      <AppText style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                        Entrega estimada:{" "}
                        <AppText weight="bold" style={{ color: colors.text }}>
                          {fechaLarga(entregaEstimada)}
                        </AppText>
                      </AppText>
                    </Dato>
                  ) : null}

                  {retiroEn ? (
                    <Dato icono="storefront-outline">
                      <AppText style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                        Retiro en:{" "}
                        <AppText weight="bold" style={{ color: colors.text }}>
                          {retiroEn}
                        </AppText>
                      </AppText>
                      {retiroFecha ? (
                        <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          Fecha comprometida: {fechaLarga(retiroFecha)}
                        </AppText>
                      ) : null}
                    </Dato>
                  ) : null}

                  {guia ? (
                    <Dato icono="cube-outline">
                      <AppText style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                        Número de seguimiento del despacho:{" "}
                        <AppText weight="bold" selectable style={{ color: colors.text }}>
                          {guia}
                        </AppText>
                      </AppText>
                      {carrier ? (
                        <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          Transportista: {carrier}
                        </AppText>
                      ) : null}
                    </Dato>
                  ) : null}
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

              {/* Ayuda: abre WhatsApp con el folio ya escrito, para que soporte
                  sepa de qué pedido se trata sin pedirlo de nuevo. */}
              {urlWhatsapp ? (
                <Pressable
                  onPress={() => Linking.openURL(urlWhatsapp)}
                  style={({ hovered, pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: spacing.lg,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: radius.md,
                    // Los mismos azules del botón secundario de AppButton (punto
                    // 07 del manual); se arma aparte solo para llevar el icono.
                    backgroundColor: hovered || pressed ? colors.primaryMid : colors.primaryDark,
                  })}
                >
                  <Ionicons name="logo-whatsapp" size={18} color={colors.primaryText} />
                  <AppText
                    weight="bold"
                    style={{ fontSize: 14, color: colors.primaryText, flexShrink: 1, textAlign: "center" }}
                  >
                    ¿Dudas con tu pedido? Escríbenos por WhatsApp
                  </AppText>
                </Pressable>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: spacing.md,
                }}
              >
                <Pressable
                  onPress={refrescar}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.primaryMid} />
                  <AppText weight="semiBold" style={{ fontSize: 13, color: colors.primaryMid }}>
                    Actualizar
                  </AppText>
                </Pressable>
                {refrescoActivo ? (
                  <AppText style={{ fontSize: 12, color: colors.muted }}>
                    Se actualiza sola cada minuto
                  </AppText>
                ) : null}
              </View>
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
