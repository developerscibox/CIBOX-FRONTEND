import { useEffect } from "react";
import { Image, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import AppText from "./AppText";
import useBienvenidaStore from "../store/bienvenidaStore";
import useAuthStore from "../store/authStore";
import { colors, shadows, spacing } from "../constants/theme";

import brand from "../constants/brand";

// Degradado de marca de Cibox (navy → azul Cibox → azul medio), el mismo que usa
// la portada. La rampa termina en azul y no en lima: el manual usa el lima como
// acento, y cerrar el degradado con él convertía el color de acción en fondo
// —además de dejar el borde derecho de la cabecera sin contraste para el texto—.
const GRAD = [colors.primaryDark, colors.primary, colors.primaryMid];
// Sobre el azul va el logo en blanco: el logo a color es lima y en la parada más
// clara del degradado se queda en 3,73:1, bajo el mínimo.
const LOGO = require("../../assets/logo-cibox-blanco.png");

// Razones para registrarse. Son tres y cortas a propósito: la ventana tiene que
// leerse de una pasada, no explicarse.
const BENEFICIOS = [
  { icono: "pricetags", texto: "Ofertas y precios solo para clientes registrados" },
  { icono: "repeat", texto: "Tu despensa guardada: recompra todo en un toque" },
  { icono: "bicycle", texto: "Preparamos tu pedido y lo dejamos listo" },
];

/**
 * Ventana de bienvenida del relanzamiento.
 *
 * Sale en CADA VISITA mientras dure la campaña (ver `bienvenidaStore`), encima
 * de cualquier pantalla, y va montada en la raíz de la navegación
 * (`navigation/index.js`), dentro del gate de tienda pausada.
 *
 * Invita a registrarse, que es lo que la campaña persigue. A quien ya tiene
 * sesión no se le pide que se registre: se le manda a las ofertas.
 *
 * Convive con el tour de bienvenida: mientras este aviso está en pantalla, el
 * tour se queda esperando. Dos ventanas superpuestas al entrar es la forma más
 * rápida de que el cliente cierre todo sin leer nada.
 */
export default function AvisoRelanzamiento({ navigationRef }) {
  const visto = useBienvenidaStore((s) => s.visto);
  const cargado = useBienvenidaStore((s) => s.cargado);
  const cerrarAviso = useBienvenidaStore((s) => s.cerrarAviso);
  const token = useAuthStore((s) => s.token);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    useBienvenidaStore.getState().cargarAviso();
  }, []);

  if (!cargado || visto) return null;

  const esAngosto = width < 620;
  const conSesion = Boolean(token);

  const navegar = (...args) => {
    cerrarAviso();
    try {
      navigationRef?.current?.navigate?.(...args);
    } catch {}
  };

  const irARegistro = () => navegar("Auth", { screen: "Register" });
  const irAOfertas = () => navegar("Products", { preset: "liquidation" });

  // En web el overlay va fixed para cubrir el viewport completo aunque la página
  // esté scrolleada (mismo criterio que WelcomeTour y BrandBackdrop).
  const posicion = Platform.OS === "web" ? { position: "fixed" } : { position: "absolute" };

  return (
    <View
      style={[
        posicion,
        {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // Velo del modal: el mismo peso de antes, pero con el tinte azul de
          // marca en vez del verdoso (17,24,17) de la identidad anterior.
          backgroundColor: "rgba(0,25,34,0.72)",
          justifyContent: "center",
          alignItems: "center",
          padding: esAngosto ? spacing.sm : spacing.md,
          zIndex: 1000,
        },
      ]}
    >
      {/* La tarjeta puede pasarse de alto en teléfonos apaisados o con el
          teclado abierto, así que scrollea en vez de recortarse. */}
      <ScrollView
        style={{ maxHeight: height - (esAngosto ? 24 : 48), width: "100%" }}
        contentContainerStyle={{ alignItems: "center", justifyContent: "center", flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: esAngosto ? 520 : 620,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: colors.surface,
            ...shadows.card,
          }}
        >
          {/* Cabecera de marca: degradado, logo en blanco y los círculos que la
              portada usa como firma visual. */}
          <LinearGradient
            colors={GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: esAngosto ? 30 : 40,
              paddingBottom: esAngosto ? 26 : 34,
              paddingHorizontal: 24,
              alignItems: "center",
            }}
          >
            <View
              pointerEvents="none"
              style={{ position: "absolute", right: -40, top: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.14)" }}
            />
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: -36, bottom: -56, width: 165, height: 165, borderRadius: 83, backgroundColor: "rgba(255,255,255,0.10)" }}
            />

            <View
              style={{
                width: esAngosto ? 92 : 112,
                height: esAngosto ? 92 : 112,
                borderRadius: 26,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
              }}
            >
              <Image
                source={LOGO}
                resizeMode="contain"
                style={{ width: (esAngosto ? 66 : 82) * 0.75, height: esAngosto ? 66 : 82 }}
              />
            </View>

            <View
              style={{
                alignSelf: "center",
                marginTop: 18,
                backgroundColor: colors.discount,
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 7,
              }}
            >
              {/* Sobre el lima el texto va oscuro: `accentText` rinde 10,1:1.
                  Antes iba en el café #7a4d00, que era el par del amarillo
                  anterior y sobre el lima nuevo se queda en 4,47:1: bajo el
                  mínimo, por poco pero bajo. */}
              <AppText style={{ color: colors.accentText, fontSize: esAngosto ? 12.5 : 14, fontWeight: "900", letterSpacing: 0.8 }}>
                🎉 ESTAMOS DE VUELTA
              </AppText>
            </View>
          </LinearGradient>

          {/* Cuerpo */}
          <View style={{ padding: esAngosto ? 24 : 34 }}>
            <AppText
              style={{
                fontSize: esAngosto ? 26 : 34,
                fontWeight: "900",
                color: colors.text,
                textAlign: "center",
                lineHeight: esAngosto ? 32 : 41,
              }}
            >
              {conSesion ? `¡Qué bueno verte de vuelta!` : `Únete a la familia ${brand.name}`}
            </AppText>

            <AppText
              style={{
                fontSize: esAngosto ? 15 : 16.5,
                color: colors.muted,
                textAlign: "center",
                lineHeight: esAngosto ? 22 : 25,
                marginTop: 12,
              }}
            >
              {conSesion
                ? "Volvimos con ofertas imperdibles en abarrotes, bebidas, lácteos y aseo. Tu despensa te está esperando."
                : "Volvimos, y queremos que hagas tu compra del supermercado sin moverte de donde estés. Crea tu cuenta en un minuto."}
            </AppText>

            {!conSesion && (
              <View style={{ marginTop: 22, gap: 12 }}>
                {BENEFICIOS.map((b) => (
                  <View key={b.icono} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: `${colors.primary}14`,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={b.icono} size={19} color={colors.primary} />
                    </View>
                    <AppText style={{ flex: 1, fontSize: esAngosto ? 14 : 15, color: colors.text, fontWeight: "600", lineHeight: 20 }}>
                      {b.texto}
                    </AppText>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={conSesion ? irAOfertas : irARegistro}
              style={({ pressed }) => ({
                marginTop: 26,
                // El estado pulsado se oscurece dentro de la familia azul. Antes
                // viraba a `accent`, y el rótulo blanco del botón sobre el lima
                // se queda en 1,9:1: el botón se borraba justo al tocarlo.
                // Botón primario del manual: lima con texto oscuro. Al pulsar
                // pasa al lima claro, que mantiene el rótulo legible (9,6:1).
                backgroundColor: pressed ? colors.accentLight : colors.accent,
                borderRadius: 16,
                paddingVertical: esAngosto ? 16 : 19,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              })}
            >
              {/* Sobre el lima el rótulo va oscuro: en blanco se queda en 1,9:1. */}
              <AppText weight="bold" style={{ color: colors.accentText, fontSize: esAngosto ? 16 : 18 }}>
                {conSesion ? "Ver ofertas imperdibles" : "Crear mi cuenta gratis"}
              </AppText>
              <Ionicons name="arrow-forward" size={esAngosto ? 18 : 20} color={colors.accentText} />
            </Pressable>

            {!conSesion && (
              <Pressable
                onPress={irAOfertas}
                style={({ pressed }) => ({
                  marginTop: 10,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: pressed ? colors.primary : colors.border,
                  paddingVertical: esAngosto ? 14 : 16,
                  alignItems: "center",
                })}
              >
                {/* Botón secundario: fondo blanco, así que el rótulo va en azul
                    de marca (10,2:1). El lima es color de relleno, no de texto:
                    sobre blanco se queda en 1,63:1 y es ilegible. */}
                <AppText style={{ color: colors.primary, fontWeight: "800", fontSize: esAngosto ? 14.5 : 15.5 }}>
                  Ver ofertas imperdibles
                </AppText>
              </Pressable>
            )}

            <Pressable onPress={cerrarAviso} style={{ marginTop: 12, paddingVertical: 10, alignItems: "center" }}>
              <AppText style={{ color: colors.muted, fontWeight: "700", fontSize: 13.5 }}>
                Seguir mirando la tienda
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
