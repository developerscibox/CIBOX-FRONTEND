import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ScreenContainer from "../components/ScreenContainer";
import { colors, shadows, spacing, radius } from "../constants/theme";
import MobileSearchBar from "../components/MobileSearchBar";
import useCategoryStore from "../store/categoryStore";
import ProductRowSection from "../components/ProductRowSection";
import { getProducts, getRecommendedProducts } from "../services/productService";
import { addItemToCart } from "../services/cartService";
import { esAlcohol } from "../constants/alcohol";
import { exigirMayoriaDeEdad } from "../store/edadStore";
import useCartStore from "../store/cartStore";
import { showToast } from "../store/toastStore";
import { boxQtyOf } from "../utils/boxPricing";
import useAuthStore from "../store/authStore";
import AppText from "../components/AppText";
import { ProductRowSkeleton } from "../components/SkeletonLoader";
import MobileCategoryMenu from "../components/MobileCategoryMenu";
import { readCache, writeCache } from "../utils/catalogCache";
import { useHomeSlots, cmsText } from "../services/contentService";

import brand from "../constants/brand";
import { seccionVisible } from "../constants/seccionesOcultas";
// Degradado de marca de Cibox: navy → azul Cibox → azul medio. La rampa se queda
// entera dentro de la familia azul; el lima no cierra el degradado porque en el
// manual es color de acción (botones, precios, badges), no fondo extenso, y como
// última parada dejaba media franja sin contraste para el texto blanco.
const GRAD = [colors.primaryDark, colors.primary, colors.primaryMid];
// Ícono "NEWS" de marca para el newsletter (versión móvil, ver Newsletter).
const NEWS_ICON = require("../../assets/home/qa-news.png");
// Arte del hero (1600x800, provisto por diseño): trae el logo de Cibox a la
// izquierda y la caja de productos a la derecha.
const BANNER_BG = require("../../assets/home/banner-hero.webp");
// Arte del bloque de ofertas: una persona con una caja Cibox. El fondo se llevó
// al azul medio que pide el punto 10 del manual; la persona y el cartón conservan
// su color, que es lo que pide el punto 09 (fotografía real, colores vibrantes).
const BANNER_OFERTAS = require("../../assets/home/banner-ofertas.webp");

// Ícono por categoría (según el nombre) para "Categorías principales".
const catIcon = (name = "") => {
  const n = name.toLowerCase();
  if (/abarrote|granel|fideo|arroz|conserva|aceite/.test(n)) return "basket-outline";
  if (/l[áa]cteo|leche|queso|yogur|huevo/.test(n)) return "nutrition-outline";
  if (/bebida|jugo|agua|gaseosa|refresco|bebestible|licor/.test(n)) return "wine-outline";
  if (/limpieza|aseo|deterg|hogar/.test(n)) return "sparkles-outline";
  if (/cuidado|personal|higiene|belleza/.test(n)) return "body-outline";
  if (/mascota|perro|gato/.test(n)) return "paw-outline";
  if (/snack|dulce|golosina|galleta|chocolate/.test(n)) return "fast-food-outline";
  if (/congelado|carne|pollo|cecina/.test(n)) return "snow-outline";
  return "pricetag-outline";
};

// ─── Accesos rápidos (6 tarjetas con íconos de marca) ────────────────────────────
const FEATURES = [
  { id: "despensa", icon: require("../../assets/home/qa-mi-despensa.png"), title: "Mi despensa", desc: "Todo lo que necesitas en un solo lugar", screen: "PantryTab", requiresAuth: true },
  { id: "mas", icon: require("../../assets/home/qa-mas-vendido.png"), title: "Más vendido", desc: "Los productos favoritos de nuestros clientes", screen: "Products", params: { preset: "best_sellers" } },
  { id: "liq", icon: require("../../assets/home/qa-liquidacion.png"), title: "Imperdibles de la semana", desc: "Los mejores precios, renovados cada semana", screen: "Products", params: { preset: "liquidation" } },
  { id: "sigue", icon: require("../../assets/home/qa-sigue-tu-pedido.png"), title: "Sigue tu pedido", desc: "Rastrea tu compra en tiempo real", screen: "OrdersTab", requiresAuth: true },
  // Las dos apuntaban a "HowItWorks", dejando inalcanzables sus pantallas
  // dedicadas (registradas en navigation/AppStack.js) — en celular no había
  // ningún otro camino para llegar a ellas.
  { id: "benef", icon: require("../../assets/home/qa-beneficios.png"), title: "Beneficios", desc: "Descuentos y promos exclusivas para ti", screen: "Beneficios" },
  { id: "despacho", icon: require("../../assets/home/qa-despacho-pronto.png"), title: "Despacho a domicilio", desc: "Mira si llegamos a tu comuna", screen: "Despacho" },
];

// ─── % de ahorro por caja (caja vs unidad) ───────────────────────────────────────
const boxSavingsPct = (product) => {
  const tiers = [...(product?.pricing?.tiers || [])].sort(
    (a, b) => (a?.min_qty || 1) - (b?.min_qty || 1),
  );
  const unit = tiers.find((t) => (t?.min_qty || 1) === 1) || tiers[0];
  const box = tiers[tiers.length - 1] || unit;
  if (unit?.price && box?.price && box?.min_qty > 1 && unit.price > box.price) {
    return 1 - box.price / unit.price;
  }
  return 0;
};

// ─── Hero principal ──────────────────────────────────────────────────────────────
// `content` = slots.hero del CMS. Cada campo cae al texto/asset de fábrica si
// no está configurado (una tienda recién instalada se ve idéntica a hoy).
function Hero({ navigation, isWebDesktop, isWide, width, content }) {
  // Sin texto por defecto, A PROPÓSITO: el arte del hero trae su propio titular
  // impreso ("Tu despensa mensual directo a tu puerta"). Si además se dibujara
  // el título de la marca encima, quedarían dos titulares pisados sobre la misma
  // esquina. El texto solo aparece si el administrador lo escribe en el panel,
  // que es el caso de un arte SIN el texto quemado.
  const title = cmsText(content?.title, "");
  const subtitle = cmsText(content?.subtitle, "");
  const cta = cmsText(content?.cta, "Ver ofertas");
  const remoteImage = cmsText(content?.image_url, "");
  const hayTexto = !!title || !!subtitle;

  // El arte va completo, en su proporción 2:1: con `cover` sobre un contenedor
  // más alto se recortaban los costados y se perdía el logo impreso a la
  // izquierda. Los tamaños escalan en tres tramos porque el banner se estira
  // con el ancho de la pantalla y el texto tiene que seguir cabiendo dentro.
  // En móvil el banner mide ~170px de alto y la bajada no cabe sin comerse el
  // tercio superior, que es donde va el logo impreso en el arte: ahí queda solo
  // el título y el botón.
  //
  // Ancho real del banner: el hero vive dentro de ScreenContainer, que centra el
  // contenido con `maxWidth` 1200 (ver el render de esta pantalla) y lo separa
  // `spacing.md` por lado.
  const anchoBanner = Math.max(1, Math.min(width, 1200) - spacing.md * 2);
  const esMovil = !isWide && !isWebDesktop;

  // El tramo móvil NO puede ser de tamaño fijo. El banner es 2:1, así que su alto
  // es `anchoBanner / 2` y se achica con la pantalla, pero las tipografías eran
  // constantes (17/21): en un Android de 360px el banner queda de 328x164, el
  // bloque de texto mide 84,5px y arranca al 40,5% del alto — dentro mismo de la
  // franja donde el arte trae impreso el logo de Cibox (del 11,4% al 41,2% del
  // alto). Con un título de 3 líneas cargado desde el panel el choque llegaba
  // hasta el iPhone (33,1% en 390px).
  //
  // Ahora todo se deriva de `anchoBanner`, con 328px como referencia. El bloque
  // está anclado a `bottom: 8%` y para no pisar el logo tiene que arrancar bajo
  // el 45% del alto (41,2% del logo + margen), o sea:
  //   alto del bloque ≤ (0,55 − 0,08)·alto = 0,47·(anchoBanner/2) = 0,235·anchoBanner
  // Bloque = 2·tituloAlto + (hueco + 4) + botón, y botón = pad + su línea más
  // alta (por eso el tramo móvil fija `ctaAlto`: sin lineHeight explícito la
  // altura del botón depende de la métrica de Poppins y el cálculo no cierra).
  // Medido para pantallas de 320/360/390/430px: 66,5 / 73,8 / 80,0 / 88,2px
  // contra topes de 67,7 / 77,1 / 84,1 / 93,5 → el bloque arranca entre el 45,8%
  // y el 47,7% del alto, siempre bajo el logo. Los pisos (13px de título, 10px
  // de CTA) son el mínimo legible; para que no se los coma un título largo del
  // CMS, en móvil el título se corta en 2 líneas.
  const escM = anchoBanner / 328;
  const ent = (min, v, max) => Math.max(min, Math.min(v, max));
  const tituloM = ent(13, 15 * escM, 20);
  const ctaM = ent(10, 11 * escM, 15);

  const t = isWide
    ? { titulo: 40, tituloAlto: 45, bajada: 16, bajadaAlto: 22, cta: 15, pad: 24, hueco: 14 }
    : isWebDesktop
      ? { titulo: 28, tituloAlto: 32, bajada: 13, bajadaAlto: 18, cta: 14, pad: 20, hueco: 10 }
      : {
          titulo: tituloM,
          tituloAlto: tituloM * 1.22,
          bajada: 0,
          cta: ctaM,
          ctaAlto: ctaM * 1.4,
          pad: ent(11, 12 * escM, 20),
          hueco: ent(4, 5 * escM, 12),
        };

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 2,
        borderRadius: 24,
        overflow: "hidden",
        marginBottom: spacing.lg,
        // Color de respaldo mientras el arte no ha cargado: el navy de marca.
        backgroundColor: colors.primaryDark,
      }}
    >
      <Image
        source={remoteImage ? { uri: remoteImage } : BANNER_BG}
        resizeMode="cover"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
      />
      {/* Velo de marca sobre la mitad izquierda: da contraste al texto SIN
          apagar la caja de productos de la derecha. Va solo cuando el panel
          define un título: sobre un arte que ya trae el suyo impreso, este velo
          lo único que hace es ensuciarlo.
          El tinte pasa del verde (38,79,18) al azul de marca (0,69,104), que es
          un pelo más oscuro, así que el texto blanco no pierde nada: en la zona
          plena del velo queda en 8,24:1 incluso si debajo el arte fuese blanco. */}
      {hayTexto && (
        <LinearGradient
          colors={["rgba(0,69,104,0.92)", "rgba(0,69,104,0.66)", "rgba(0,69,104,0)"]}
          locations={[0, 0.4, 0.75]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {/* Anclado abajo a la izquierda: el logo del arte ocupa el tercio
          superior izquierdo, así que el texto crece hacia arriba sin taparlo. */}
      <View style={{ position: "absolute", left: "6%", right: isWebDesktop ? "48%" : "30%", bottom: "8%" }}>
        {!!title && (
          <AppText
            numberOfLines={esMovil ? 2 : undefined}
            style={{ color: "#fff", fontSize: t.titulo, fontWeight: "900", lineHeight: t.tituloAlto }}
          >
            {title}
          </AppText>
        )}
        {t.bajada > 0 && !!subtitle && (
          <AppText
            numberOfLines={2}
            style={{ color: "rgba(255,255,255,0.94)", fontSize: t.bajada, marginTop: t.hueco, lineHeight: t.bajadaAlto }}
          >
            {subtitle}
          </AppText>
        )}
        <Pressable
          onPress={() => navigation.navigate("Products")}
          style={{ alignSelf: "flex-start", marginTop: t.hueco + 4, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: t.pad, paddingVertical: t.pad * 0.5, flexDirection: "row", alignItems: "center", gap: 8, ...shadows.card }}
        >
          <AppText style={{ color: colors.primary, fontWeight: "900", fontSize: t.cta, lineHeight: t.ctaAlto }}>{cta}</AppText>
          <Ionicons name="arrow-forward" size={t.cta + 2} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Tarjeta de acceso rápido (con ícono de marca) ───────────────────────────────
function FeatureCard({ item, width, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => ({
        width,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: hovered ? colors.primary : colors.border,
        padding: 16,
        ...shadows.card,
        transform: hovered ? [{ translateY: -2 }] : undefined,
      })}
    >
      <Image
        source={item.imageUrl ? { uri: item.imageUrl } : item.icon}
        style={{ width: 52, height: 52, borderRadius: item.imageUrl ? 12 : 0 }}
        resizeMode={item.imageUrl ? "cover" : "contain"}
      />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>{item.title}</AppText>
        <AppText style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 }} numberOfLines={2}>
          {item.desc}
        </AppText>
      </View>
    </Pressable>
  );
}

// ─── Banners secundarios 1-3 (CMS) ───────────────────────────────────────────────
// Franjas promocionales bajo el hero. Solo se renderizan si el admin configuró
// al menos título o imagen (una tienda recién instalada no muestra nada aquí).
// Ratio del diseño: 4:1 web / 2:1 móvil (spec del CMS), imagen resizeMode cover.
function PromoBanner({ banner, navigation, isWebDesktop }) {
  const image = cmsText(banner?.image_url, "");
  const title = cmsText(banner?.title, "");
  const link = cmsText(banner?.link, "");

  const onPress = () => {
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      Linking.openURL(link);
      return;
    }
    // Link interno: nombre de ruta de la app (ej: "Products").
    try {
      navigation.navigate(link.replace(/^\//, ""));
    } catch {}
  };

  const titleOverlay = !!title && (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        paddingHorizontal: isWebDesktop ? 36 : 20,
        // Cap. 10: el velo de los banners va en el azul de la marca. Un negro
        // al 22% apaga el arte y no dice nada; el azul da el mismo contraste
        // al texto y de paso tiñe la franja con el color de Cibox.
        backgroundColor: "rgba(0,69,104,0.42)",
      }}
    >
      <AppText
        style={{
          color: "#fff",
          fontSize: isWebDesktop ? 26 : 18,
          fontWeight: "900",
          textShadowColor: "rgba(0,0,0,0.35)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
        numberOfLines={2}
      >
        {title}
      </AppText>
    </View>
  );

  return (
    <Pressable onPress={onPress} disabled={!link}>
      {image ? (
        <ImageBackground
          source={{ uri: image }}
          resizeMode="cover"
          // width/height explícitos: sin ellos react-native-web le da al <img>
          // el tamaño intrínseco del archivo y la imagen se dibuja a su medida
          // real en vez de llenar el contenedor (el mismo fallo que dejaba la
          // franja del newsletter como una barra de 24px).
          imageStyle={{ borderRadius: 22, width: "100%", height: "100%" }}
          style={{
            borderRadius: 22,
            overflow: "hidden",
            aspectRatio: isWebDesktop ? 4 : 2,
            // Respaldo en navy mientras baja la imagen del CMS.
            backgroundColor: colors.primaryDark,
          }}
        >
          {titleOverlay}
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 22,
            paddingVertical: isWebDesktop ? 30 : 22,
            paddingHorizontal: isWebDesktop ? 36 : 20,
            justifyContent: "center",
          }}
        >
          <AppText style={{ color: "#fff", fontSize: isWebDesktop ? 24 : 17, fontWeight: "900" }} numberOfLines={2}>
            {title}
          </AppText>
        </LinearGradient>
      )}
    </Pressable>
  );
}

function PromoBanners({ slots, navigation, isWebDesktop }) {
  const items = [slots?.banner_1, slots?.banner_2, slots?.banner_3].filter(
    (b) => b && (cmsText(b.image_url, "") || cmsText(b.title, "")),
  );
  if (!items.length) return null;
  return (
    <View style={{ gap: 14, marginBottom: spacing.lg }}>
      {items.map((b, i) => (
        <PromoBanner key={i} banner={b} navigation={navigation} isWebDesktop={isWebDesktop} />
      ))}
    </View>
  );
}

// ─── Suscripción a newsletter (presentacional) ───────────────────────────────────
function Newsletter({ title, subtitle, isWebDesktop }) {
  const [email, setEmail] = useState("");
  const submit = () => {
    if (!email.trim() || !email.includes("@")) {
      showToast("Ingresa un correo válido");
      return;
    }
    setEmail("");
    showToast("¡Listo! Te avisaremos de nuestras ofertas 🎉");
  };
  const layout = {
    borderRadius: 22,
    marginBottom: spacing.lg,
    padding: isWebDesktop ? 28 : 20,
    flexDirection: isWebDesktop ? "row" : "column",
    alignItems: "center",
    gap: isWebDesktop ? 24 : 14,
  };

  const contenido = (
    <>
      <Image source={NEWS_ICON} resizeMode="contain" style={{ width: 62, height: 62, flexShrink: 0 }} />
      <View style={{ flex: isWebDesktop ? 1 : undefined, alignItems: isWebDesktop ? "flex-start" : "center" }}>
        <AppText style={{ color: "#fff", fontSize: 20, fontWeight: "900", textAlign: isWebDesktop ? "left" : "center" }}>{title}</AppText>
        <AppText style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 3, textAlign: isWebDesktop ? "left" : "center" }}>{subtitle}</AppText>
      </View>
      <View style={{ flexDirection: "row", gap: 8, width: isWebDesktop ? 420 : "100%" }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Tu correo electrónico"
          // El malva #9b6f8b no pertenecía a ninguna paleta de la marca; el gris
          // secundario del tema rinde 5,87:1 sobre el campo blanco.
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text }}
        />
        {/* Lima de marca sobre la franja azul: aquí el acento hace exactamente
            su trabajo —es el único botón de acción del bloque y salta a la
            vista—. El texto va oscuro porque sobre el lima el blanco se queda en
            1,9:1; en `colors.text` rinde 10,1:1. */}
        <Pressable onPress={submit} style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" }}>
          <AppText style={{ color: colors.accentText, fontWeight: "900", fontSize: 14 }}>Suscribirme</AppText>
        </Pressable>
      </View>
    </>
  );

  // La franja va dibujada, no como imagen. Antes era un PNG de 1435x24 puesto
  // como ImageBackground con resizeMode "stretch", y react-native-web le daba al
  // <img> su tamaño intrínseco: se pintaba una barra de 24px de alto y 1435 de
  // ancho arriba del bloque en vez de cubrirlo, así que el texto blanco caía
  // sobre el fondo claro de la página y quedaba ilegible (es el mismo problema
  // que BrandBackdrop resuelve fijando width/height). Como el arte era un
  // degradado horizontal puro —cada columna de color constante— un
  // LinearGradient lo reproduce exacto, cubre siempre el bloque completo y de
  // paso saca del bundle un archivo que además traía cuatro rayas de 1px.
  //
  // El degradado original iba de lima (#A2D15B) a verde (#559534) y dejaba el
  // texto blanco en 1,85:1. Este mantiene el azul de marca plano bajo el texto
  // hasta el 55% del ancho —donde el título y la bajada terminan en los dos
  // layouts, porque en móvil se centran y en desktop se alinean a la izquierda—
  // y recién ahí abre hacia el azul medio, detrás del campo de correo. Sobre
  // `primary` el blanco rinde 10,24:1 y la bajada al 90% de opacidad 8,59:1;
  // incluso en la parada más clara (`primaryMid`) quedan 6,07:1 y 5,24:1.
  return (
    <LinearGradient
      colors={[colors.primary, colors.primary, colors.primaryMid]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ ...layout, borderRadius: 22, overflow: "hidden" }}
    >
      {contenido}
    </LinearGradient>
  );
}

// ─── Franja de confianza (4 señales) ─────────────────────────────────────────────
function TrustBar({ isWebDesktop }) {
  const items = [
    { icon: "cart-outline", label: "Precios mayoristas", sub: "Ahorra más comprando online" },
    { icon: "shield-checkmark-outline", label: "Pago 100% seguro", sub: "Transacciones protegidas" },
    { icon: "car-outline", label: "Despacho a domicilio", sub: "Zona de Rancagua" },
    { icon: "heart-outline", label: "Atención personalizada", sub: "Estamos para ayudar" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 18,
        paddingHorizontal: 12,
        marginBottom: spacing.lg,
        ...shadows.card,
      }}
    >
      {items.map((it, i) => (
        <View key={i} style={{ width: isWebDesktop ? "24%" : "48%", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: isWebDesktop ? 0 : 8 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}12`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Ionicons name={it.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>{it.label}</AppText>
            <AppText style={{ fontSize: 11, color: colors.muted, lineHeight: 14 }}>{it.sub}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Banner "Ofertas imperdibles" ────────────────────────────────────────────────
// Sobre el arte de diseño: fondo verde con una persona sosteniendo una caja de
// Cibox a la derecha, y la mitad izquierda libre justamente para el texto. El
// arte estuvo en el repo sin usarse: el bloque se dibujaba con un degradado.
function OffersBanner({ navigation, isWebDesktop }) {
  return (
    <ImageBackground
      source={BANNER_OFERTAS}
      resizeMode="cover"
      // width/height explícitos: sin ellos react-native-web le da al <img> su
      // tamaño intrínseco y la imagen se dibuja a su medida real en vez de
      // llenar el bloque.
      imageStyle={{ borderRadius: 22, width: "100%", height: "100%" }}
      style={{
        borderRadius: 22,
        overflow: "hidden",
        marginBottom: spacing.lg,
        padding: isWebDesktop ? 36 : 24,
        // Respaldo mientras la imagen no ha cargado. Va en el azul del velo, no
        // en el verde del arte: lo que se ve en pantalla es siempre azul.
        backgroundColor: colors.primaryDark,
      }}
    >
      {/* Velo de legibilidad, el mismo recurso que el hero. El arte ya está en
          azul de marca, así que el velo no está para teñir sino solo para que
          el texto no compita con las cajas y las etiquetas del arte: pesa en la
          mitad izquierda —donde va el texto— y se desvanece a la derecha para
          no apagar la foto. */}
      <LinearGradient
        colors={["rgba(0,61,73,0.82)", "rgba(0,61,73,0.55)", "rgba(0,69,104,0)"]}
        locations={[0, 0.45, 0.85]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.3 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Sobre el velo azul el lima vuelve a ser legible y es el acento que
          manda el manual: #17202A sobre #B6D900 rinde 10,1:1. */}
      <View style={{ alignSelf: "flex-start", backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
        <AppText style={{ color: colors.accentText, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>🔥 OFERTA DE LA SEMANA</AppText>
      </View>
      {/* El texto se queda en la mitad izquierda: la persona con la caja ocupa
          el tercio derecho del arte y taparla con letras arruina la foto. */}
      {/* Texto blanco sobre el velo. Sin velo, el blanco sobre el arte verde
          rendía entre 1,88:1 y 2,73:1; sobre la zona del velo donde cae el
          texto (opacidad 0,94 a 0,80 del azul oscuro) queda entre 8,9:1 y
          10,7:1 aun contando lo que se transparenta del arte. Sin sombras: el
          velo ya hace ese trabajo y el halo solo ensuciaba los bordes. */}
      <View style={{ maxWidth: isWebDesktop ? "62%" : "78%" }}>
        <AppText
          style={{
            color: colors.primaryText,
            fontSize: isWebDesktop ? 30 : 23,
            fontWeight: "900",
            lineHeight: isWebDesktop ? 34 : 27,
          }}
        >
          Ofertas imperdibles{"\n"}¡Por tiempo limitado!
        </AppText>
        <AppText
          style={{
            color: "rgba(255,255,255,0.94)",
            fontSize: 14,
            marginTop: 10,
          }}
        >
          Aprovecha nuestros descuentos exclusivos en productos seleccionados.
        </AppText>
      </View>
      <Pressable
        onPress={() => navigation.navigate("Products", { preset: "liquidation" })}
        // Boton primario del manual: fondo lima con texto oscuro. Iba en
        // blanco, que sobre el arte se leia como un boton secundario.
        style={{ alignSelf: "flex-start", marginTop: 20, backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <AppText weight="bold" style={{ color: colors.accentText, fontSize: 14 }}>Ver los imperdibles</AppText>
        <Ionicons name="arrow-forward" size={16} color={colors.accentText} />
      </Pressable>
    </ImageBackground>
  );
}

// ─── Título de sección ───────────────────────────────────────────────────────────
function SectionTitle({ title, right = null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={{ width: 4, height: 22, borderRadius: 999, backgroundColor: colors.primary, marginRight: 10 }} />
        <AppText style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>{title}</AppText>
      </View>
      {right}
    </View>
  );
}

// ─── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 800;
  const isWide = width >= 1040;

  // Stale-while-revalidate: hidrata desde la caché persistente al instante.
  const cachedProducts = readCache("home_products");
  const cachedCategories = readCache("home_categories");

  // Contenido editable del CMS (hero, banners, cards, textos). SWR: caché al
  // instante + revalidación en background. null → home de fábrica.
  const slots = useHomeSlots();

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [featuredCategories, setFeaturedCategories] = useState(
    Array.isArray(cachedCategories) ? cachedCategories : [],
  );
  const [products, setProducts] = useState(
    Array.isArray(cachedProducts) ? cachedProducts : [],
  );
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  // Si ya hay catálogo cacheado, no mostramos skeleton (pintamos directo).
  const [sectionsLoading, setSectionsLoading] = useState(
    !(Array.isArray(cachedProducts) && cachedProducts.length > 0),
  );
  const [addingProductId, setAddingProductId] = useState(null);
  const { cartCount, loadCartSummary } = useCartStore();

  const liquidation = useMemo(
    () =>
      products
        .map((p) => ({ p, pct: boxSavingsPct(p) }))
        .filter((x) => x.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 10)
        .map((x) => x.p),
    [products],
  );
  const liquidationIds = useMemo(() => new Set(liquidation.map((p) => p._id)), [liquidation]);
  const featured = useMemo(
    () => products.filter((p) => !liquidationIds.has(p._id)).slice(0, 10),
    [products, liquidationIds],
  );

  // El catálogo NO depende de la sesión: se trae una sola vez (perf).
  // SWR: si falla la red mantenemos lo cacheado; al éxito refrescamos y
  // persistimos. No volvemos a poner skeleton si ya hay datos en pantalla.
  const fetchProducts = async () => {
    try {
      const prodData = await getProducts({ page: 1, limit: 40 });
      const items = Array.isArray(prodData?.items) ? prodData.items : [];
      if (items.length) {
        setProducts(items);
        writeCache("home_products", items);
      }
    } catch (e) {
      // mantener catálogo cacheado
    } finally {
      setSectionsLoading(false);
    }
  };

  // Recomendados sí dependen de la sesión.
  const fetchRecommended = async () => {
    if (!token) {
      setRecommendedProducts([]);
      return;
    }
    try {
      const recData = await getRecommendedProducts({ limit: 8 });
      setRecommendedProducts(Array.isArray(recData?.items) ? recData.items : []);
    } catch (e) {
      setRecommendedProducts([]);
    }
  };

  const fetchFeaturedCategories = async () => {
    try {
      // Categorías principales = nivel superior del árbol; si no hay árbol,
      // cae al listado plano. (is_featured venía vacío y dejaba la sección en blanco.)
      // Vía categoryStore: caché en memoria + dedupe con WebHeader (no doble fetch).
      let items = await useCategoryStore.getState().fetchTree();
      if (!Array.isArray(items) || items.length === 0) {
        items = await useCategoryStore.getState().fetchFlat();
      }
      if (Array.isArray(items) && items.length) {
        setFeaturedCategories(items);
        writeCache("home_categories", items);
      }
    } catch (e) {}
  };

  const handleAddFromCard = async (product, cajas = 1) => {
    if (!product?._id) return;
    // Compra sin cuenta: el carrito de invitado (x-guest-id) ya funciona en el
    // backend; no exigimos login para agregar (igual que ProductsScreen).

    // Alcohol: hay que declarar mayoría de edad antes de agregarlo (Ley 19.925).
    // Importa acá: hay vinos en "Productos destacados" de la portada.
    if (esAlcohol(product) && !(await exigirMayoriaDeEdad())) {
      showToast("No podemos venderte alcohol si eres menor de 18 años");
      return;
    }

    try {
      setAddingProductId(product._id);
      const n = Math.max(1, Number(cajas) || 1);
      await addItemToCart({ productId: product._id, quantity: boxQtyOf(product) * n });
      await loadCartSummary();
      showToast(n > 1 ? `${n} agregados al carrito` : "Agregado al carrito");
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "No se pudo agregar al carrito");
    } finally {
      setAddingProductId(null);
    }
  };

  const goFeature = (item) => {
    // "Sigue tu pedido" es el acceso más obvio de la portada para quien quiere
    // saber en qué va su compra, y al invitado lo mandaba al login: sin cuenta,
    // callejón sin salida. Ahora lo lleva al seguimiento público (número de
    // pedido + correo), que es justamente la pantalla hecha para su caso.
    if (item.id === "sigue" && !token) {
      navigation.navigate("TrackOrder");
      return;
    }
    if (item.requiresAuth && !token) {
      navigation.navigate("Auth");
      return;
    }
    navigation.navigate(item.screen, item.params);
  };

  // Header móvil (menú + notificaciones + carrito).
  useLayoutEffect(() => {
    if (isWebDesktop) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => setCategoryMenuOpen(true)} style={{ width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", marginLeft: 10 }}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4 }}>
          <Pressable onPress={() => navigation.navigate("Notifications")} style={{ width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", marginRight: 8, backgroundColor: colors.primary }}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Cart")} style={{ width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary, position: "relative" }}>
            <Ionicons name="bag-outline" size={20} color="#fff" />
            {/* Contador del carrito: la píldora lima es justo el uso de acento
                que pide el manual, pero el número iba en blanco y sobre el lima
                eso es 1,9:1 —a 10px, ilegible—. Va en `accentText`: 10,1:1. */}
            {cartCount > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 }}>
                <AppText style={{ color: colors.accentText, fontSize: 10, fontWeight: "800" }}>{cartCount}</AppText>
              </View>
            )}
          </Pressable>
        </View>
      ),
    });
  }, [navigation, cartCount, isWebDesktop]);

  useEffect(() => {
    loadCartSummary();
    fetchFeaturedCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchRecommended();
  }, [token]);

  const onPressProduct = (item) => navigation.navigate("ProductDetail", { productId: item._id });

  // Tarjetas: el CMS puede pisar título/bajada/imagen de cada una de las 6;
  // lo no configurado conserva el contenido e ícono de marca actuales.
  const cmsCards = Array.isArray(slots?.cards) ? slots.cards : [];
  const features = FEATURES.map((f, i) => ({
    ...f,
    title: cmsText(cmsCards[i]?.title, f.title),
    desc: cmsText(cmsCards[i]?.subtitle, f.desc),
    imageUrl: cmsText(cmsCards[i]?.image_url, ""),
  }));

  // Texto de bienvenida (CMS): solo aparece si el admin lo configuró.
  const welcomeTitle = cmsText(slots?.textos?.welcome_title, "");
  const welcomeSubtitle = cmsText(slots?.textos?.welcome_subtitle, "");

  const featureCols = isWide ? 3 : isWebDesktop ? 2 : width >= 560 ? 2 : 1;
  const featureGap = 14;
  const [gridW, setGridW] = useState(0);
  const cardW = gridW > 0 ? (gridW - featureGap * (featureCols - 1)) / featureCols : "100%";

  const mainCategories = (featuredCategories.length ? featuredCategories : []).slice(0, 6);
  const whyCards = [
    { icon: "ribbon-outline", title: "Experiencia", desc: "Más de 10 años en el mercado mayorista" },
    { icon: "grid-outline", title: "Variedad", desc: "Miles de productos para tu elección" },
    { icon: "shield-checkmark-outline", title: "Confianza", desc: "Calidad garantizada en cada compra" },
  ];

  // ─── La portada, armada por bloques ──────────────────────────────────────────
  // Todo lo de arriba vive dentro de un único ListHeaderComponent, así que el
  // orden en que se listan los bloques ES el orden en pantalla. Se arman como
  // piezas sueltas para poder ordenarlas distinto en el teléfono sin duplicar
  // nada de contenido.
  //
  // Por qué el teléfono va aparte: en pantalla angosta la grilla de accesos
  // rápidos cae a UNA columna (seis tarjetas ≈ 590px) y encima venía el
  // newsletter (240px). Entre el banner y la primera tarjeta de producto había
  // ~940px: casi vez y media de pantalla sin nada que comprar. Quien entra desde
  // el celular tiene que ver mercadería apenas pasa el banner; si no, la portada
  // no vende. En escritorio el problema no existe (la misma grilla va en tres
  // columnas y ocupa 186px, y el hero grande ya justifica el primer pantallazo),
  // así que ahí el orden queda exactamente como estaba.
  const esMovil = !isWebDesktop;

  // En el teléfono se recortan dos accesos rápidos: "Más vendido" e "Imperdibles
  // de la semana" llevan al mismo catálogo que ahora se muestra arriba en filas
  // reales de producto. El filtro va DESPUÉS del map porque el CMS pisa las
  // tarjetas por índice (cmsCards[i]); filtrar antes correría los índices y cada
  // tarjeta se quedaría con el texto e imagen de otra.
  const featuresVisibles = features
    // Fuera las secciones escondidas, para que la portada no ofrezca lo que el
    // menú ya no ofrece (ver constants/seccionesOcultas.js).
    .filter((f) => !f.screen || seccionVisible(f.screen))
    // Y en el teléfono, fuera "Imperdibles": esa fila ya va arriba con producto
    // real y con su propio "Ver todos". "Más vendido" SE QUEDA aunque su fila
    // también esté arriba, porque su catálogo no tiene ninguna otra puerta en el
    // celular: el menú y el pie que lo ofrecen son de escritorio.
    .filter((f) => !esMovil || f.id !== "liq");

  // ¿Hay fila de imperdibles? Depende de que el catálogo traiga cajas con ahorro
  // real, así que puede venir vacía; se pregunta acá porque de eso depende qué
  // fila queda primera en el celular.
  const hayImperdibles = !sectionsLoading && liquidation.length > 0;

  /* Buscador (solo móvil) */
  const bBuscador = (
    <View key="buscador" style={{ marginBottom: spacing.md, zIndex: 999, elevation: 999 }}>
      <MobileSearchBar />
    </View>
  );

  /* Bienvenida (CMS, opcional) */
  const bBienvenida = (!!welcomeTitle || !!welcomeSubtitle) && (
    <View key="bienvenida" style={{ marginBottom: spacing.md }}>
      {!!welcomeTitle && (
        <AppText style={{ fontSize: isWebDesktop ? 24 : 19, fontWeight: "900", color: colors.text }}>
          {welcomeTitle}
        </AppText>
      )}
      {!!welcomeSubtitle && (
        <AppText style={{ fontSize: 13.5, color: colors.muted, marginTop: 2 }}>
          {welcomeSubtitle}
        </AppText>
      )}
    </View>
  );

  /* Hero */
  // El hero arranca separado de la cabecera. Los dos son azules y quedaban casi
  // pegados —entre medio solo la franja lima, que a ese grosor no alcanza a
  // separarlos—, así que se leían como una sola mancha de color. Este aire deja
  // ver el fondo gris y devuelve a la cabecera su condición de franja.
  const bHero = (
    <View key="hero" style={{ paddingTop: spacing.lg }}>
      <Hero navigation={navigation} isWebDesktop={isWebDesktop} isWide={isWide} width={width} content={slots?.hero} />
    </View>
  );

  /* Seguimiento del pedido, a la vista de todos. Pedido explícito: el botón no
     puede quedar escondido en la barra chica de arriba ni en el pie. Va debajo
     del hero, antes de cualquier producto, y no exige sesión: la pantalla de
     seguimiento pide número de pedido + correo. */
  const bSeguimiento = (
    <Pressable
      key="seguimiento"
      onPress={() => navigation.navigate("TrackOrder")}
      style={({ pressed, hovered }) => ({
        flexDirection: esMovil ? "column" : "row",
        alignItems: esMovil ? "stretch" : "center",
        gap: esMovil ? 12 : 18,
        backgroundColor: hovered || pressed ? colors.primaryMid : colors.primary,
        borderRadius: radius.xl,
        paddingVertical: esMovil ? 16 : 18,
        paddingHorizontal: esMovil ? 16 : 24,
        marginBottom: spacing.lg,
        ...shadows.card,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="cube-outline" size={24} color={colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="bold" style={{ color: colors.primaryText, fontSize: esMovil ? 16 : 18 }}>
            ¿Ya compraste? Sigue tu pedido
          </AppText>
          <AppText style={{ color: "rgba(255,255,255,0.82)", fontSize: esMovil ? 13 : 14, marginTop: 2 }}>
            Solo con tu número de pedido y tu correo. No necesitas cuenta.
          </AppText>
        </View>
      </View>
      <View
        style={{
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 22,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <AppText weight="bold" style={{ color: colors.accentText, fontSize: 15 }}>
          Seguir mi pedido
        </AppText>
      </View>
    </Pressable>
  );

  /* Banners secundarios 1-3 (CMS, opcionales) */
  const bPromos = (
    <PromoBanners key="promos" slots={slots} navigation={navigation} isWebDesktop={isWebDesktop} />
  );

  /* Accesos rápidos con íconos de marca (6 en escritorio, 4 en móvil) */
  const bAccesos = (
    <View
      key="accesos"
      onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: featureGap, marginBottom: spacing.lg }}
    >
      {featuresVisibles.map((item) => (
        <FeatureCard key={item.id} item={item} width={cardW} onPress={() => goFeature(item)} />
      ))}
    </View>
  );

  /* Newsletter de arriba: en el teléfono no se dibuja. Son 240px justo entre el
     banner y el primer producto, y el formulario del pie hace exactamente lo
     mismo unas pantallas más abajo. No se borra: sigue en escritorio. */
  const bNewsletterTop = (
    <Newsletter
      key="newsletter-top"
      title="Entérate de nuestras ofertas y novedades"
      subtitle="Suscríbete y recibe beneficios exclusivos"
      isWebDesktop={isWebDesktop}
    />
  );

  /* Productos destacados */
  const bDestacados = (
    <View key="destacados" style={{ marginBottom: spacing.lg }}>
      <SectionTitle
        title="Productos destacados"
        right={
          <Pressable onPress={() => navigation.navigate("Products")}>
            <AppText style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>Ver todos</AppText>
          </Pressable>
        }
      />
      {sectionsLoading ? (
        <ProductRowSkeleton count={4} />
      ) : (
        <ProductRowSection
          title=""
          products={featured}
          onPressProduct={onPressProduct}
          onAddToCart={handleAddFromCard}
          addingProductId={addingProductId}
        />
      )}
    </View>
  );

  /* Franja de confianza */
  const bConfianza = <TrustBar key="confianza" isWebDesktop={isWebDesktop} />;

  /* Ofertas imperdibles */
  const bOfertas = <OffersBanner key="ofertas" navigation={navigation} isWebDesktop={isWebDesktop} />;

  /* Imperdibles de la semana (productos reales con ahorro por caja) */
  const bImperdibles = hayImperdibles && (
    // Tinte azul, no lima. El lima al 10% pintaba los 680px de alto de
    // esta sección de un verde pálido —el color que el rediseño vino a
    // sacar— y encima recuperaba el look anterior justo debajo del
    // banner azul. El acento se queda donde hace falta: botones y
    // píldoras, no fondos de sección.
    <View key="imperdibles" style={{ marginBottom: spacing.lg, backgroundColor: `${colors.primary}0A`, borderRadius: 22, borderWidth: 1, borderColor: `${colors.primary}22`, padding: spacing.md }}>
      <SectionTitle title="Imperdibles de la semana" />
      <ProductRowSection
        title=""
        products={liquidation}
        onPressProduct={onPressProduct}
        onAddToCart={handleAddFromCard}
        addingProductId={addingProductId}
      />
    </View>
  );

  /* Categorías principales + ¿Por qué elegir Cibox? */
  const bCategorias = (
    <View key="categorias" style={{ flexDirection: isWide ? "row" : "column", gap: spacing.lg, marginBottom: spacing.lg }}>
      {/* Categorías principales */}
      <View style={{ flex: isWide ? 1 : undefined, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.card }}>
        <AppText style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Categorías principales</AppText>
        <AppText style={{ fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 12 }}>Explora nuestras categorías</AppText>
        {mainCategories.length === 0 ? (
          <AppText style={{ fontSize: 13, color: colors.muted }}>Cargando categorías…</AppText>
        ) : (
          mainCategories.map((c, i) => (
            <Pressable
              key={c._id || i}
              onPress={() => navigation.navigate("Products", { category: c._id })}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: i < mainCategories.length - 1 ? 1 : 0, borderColor: colors.border }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}12`, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={catIcon(c.name)} size={19} color={colors.primary} />
                </View>
                <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{c.name}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))
        )}
      </View>

      {/* ¿Por qué elegir Cibox? */}
      <View style={{ flex: isWide ? 1.2 : undefined }}>
        <AppText style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>¿Por qué elegir Cibox?</AppText>
        <AppText style={{ fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 12 }}>Más de 10.000 clientes confían en nosotros</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {whyCards.map((w, i) => (
            <View key={i} style={{ width: isWide ? "31.5%" : "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: "center", ...shadows.card }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${colors.primary}12`, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Ionicons name={w.icon} size={24} color={colors.primary} />
              </View>
              <AppText style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 4 }}>{w.title}</AppText>
              <AppText style={{ fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 16 }}>{w.desc}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  /* Recomendados (solo con sesión: sin token la lista viene vacía) */
  const bRecomendados = recommendedProducts.length > 0 && (
    <View key="recomendados" style={{ marginBottom: spacing.lg }}>
      <SectionTitle title="Recomendados para ti" />
      <ProductRowSection
        title=""
        products={recommendedProducts}
        onPressProduct={onPressProduct}
        onAddToCart={handleAddFromCard}
        addingProductId={addingProductId}
      />
    </View>
  );

  /* Newsletter del pie */
  const bNewsletterPie = (
    <Newsletter
      key="newsletter-pie"
      title="No te pierdas nuestras ofertas"
      subtitle="Suscríbete y recibe las mejores promociones directo en tu correo"
      isWebDesktop={isWebDesktop}
    />
  );

  // Escritorio: el orden de siempre, sin mover un pixel.
  const ordenEscritorio = [
    bBienvenida,
    bHero,
    bSeguimiento,
    bPromos,
    bAccesos,
    bNewsletterTop,
    bDestacados,
    bConfianza,
    bOfertas,
    bImperdibles,
    bCategorias,
    bRecomendados,
    bNewsletterPie,
  ];

  // Teléfono: banner y enseguida producto.
  // Primero "Imperdibles de la semana" cuando hay, porque es la única fila con
  // criterio detrás (ordena por ahorro real caja-vs-unidad, que es justamente el
  // argumento mayorista de Cibox); detrás va "Productos destacados", que no
  // repite nada porque `featured` ya excluye los de liquidación. Si no hay
  // imperdibles —o mientras el catálogo todavía carga— la primera fila es
  // "Destacados", que sí pinta esqueleto y evita que la portada arranque con un
  // hueco. El resto (ofertas, banners del CMS, confianza, accesos rápidos,
  // categorías, newsletter) no se borra: baja debajo de la mercadería.
  const ordenMovil = [
    bBuscador,
    bBienvenida,
    bHero,
    bSeguimiento,
    ...(hayImperdibles ? [bImperdibles, bDestacados] : [bDestacados]),
    bOfertas,
    bPromos,
    bConfianza,
    bAccesos,
    bCategorias,
    bRecomendados,
    bNewsletterPie,
  ];

  return (
    <ScreenContainer maxWidth={1200} padded>
      <FlatList
        data={[]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item, index) => String(item?._id ?? index)}
        renderItem={null}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListFooterComponent={<View style={{ height: spacing.lg }} />}
        ListHeaderComponent={
          <View>{esMovil ? ordenMovil : ordenEscritorio}</View>
        }
      />
      <MobileCategoryMenu visible={categoryMenuOpen} onClose={() => setCategoryMenuOpen(false)} />
    </ScreenContainer>
  );
}
