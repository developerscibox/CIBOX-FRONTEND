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
// Degradado de marca de Cibox: verde profundo → verde → lima (los tonos del logo).
const GRAD = ["#3E7D1E", "#4E9B27", "#C3E062"];
// Ícono "NEWS" de marca para el newsletter (versión móvil, ver Newsletter).
const NEWS_ICON = require("../../assets/home/qa-news.png");
// Arte del hero (1600x800, provisto por diseño): trae el logo de Cibox a la
// izquierda y la caja de productos a la derecha.
const BANNER_BG = require("../../assets/home/banner-hero.webp");
// Franja del newsletter (1435x147, provista por diseño): degradado de marca con
// el ícono de noticias a la izquierda.
const BANNER_NEWS = require("../../assets/home/banner-news.webp");

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
  { id: "liq", icon: require("../../assets/home/qa-liquidacion.png"), title: "Liquidación", desc: "Ofertas imperdibles por tiempo limitado", screen: "Products", params: { preset: "liquidation" } },
  { id: "sigue", icon: require("../../assets/home/qa-sigue-tu-pedido.png"), title: "Sigue tu pedido", desc: "Rastrea tu compra en tiempo real", screen: "OrdersTab", requiresAuth: true },
  { id: "benef", icon: require("../../assets/home/qa-beneficios.png"), title: "Beneficios", desc: "Descuentos y promos exclusivas para ti", screen: "HowItWorks" },
  { id: "despacho", icon: require("../../assets/home/qa-despacho-pronto.png"), title: "Despacho pronto", desc: "Recibe tus productos rápido y seguro", screen: "HowItWorks" },
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
function Hero({ navigation, isWebDesktop, isWide, content }) {
  const title = cmsText(content?.title, `${brand.name}\n${brand.tagline}`);
  const subtitle = cmsText(
    content?.subtitle,
    "Haz tu compra del supermercado desde donde estés. Nosotros la preparamos y te la llevamos.",
  );
  const cta = cmsText(content?.cta, "Ver ofertas");
  const remoteImage = cmsText(content?.image_url, "");

  // El arte va completo, en su proporción 2:1: con `cover` sobre un contenedor
  // más alto se recortaban los costados y se perdía el logo impreso a la
  // izquierda. Los tamaños escalan en tres tramos porque el banner se estira
  // con el ancho de la pantalla y el texto tiene que seguir cabiendo dentro.
  // En móvil el banner mide ~170px de alto y la bajada no cabe sin comerse el
  // tercio superior, que es donde va el logo impreso en el arte: ahí queda solo
  // el título y el botón.
  const t = isWide
    ? { titulo: 40, tituloAlto: 45, bajada: 16, bajadaAlto: 22, cta: 15, pad: 24, hueco: 14 }
    : isWebDesktop
      ? { titulo: 28, tituloAlto: 32, bajada: 13, bajadaAlto: 18, cta: 14, pad: 20, hueco: 10 }
      : { titulo: 17, tituloAlto: 21, bajada: 0, cta: 12, pad: 14, hueco: 7 };

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 2,
        borderRadius: 24,
        overflow: "hidden",
        marginBottom: spacing.lg,
        backgroundColor: "#3E7D1E",
      }}
    >
      <Image
        source={remoteImage ? { uri: remoteImage } : BANNER_BG}
        resizeMode="cover"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
      />
      {/* Velo de marca sobre la mitad izquierda: da contraste al texto sin
          apagar la caja de productos de la derecha. El logo impreso queda
          debajo, y como es blanco sobre verde se sigue leyendo. */}
      <LinearGradient
        colors={["rgba(38,79,18,0.92)", "rgba(38,79,18,0.66)", "rgba(38,79,18,0)"]}
        locations={[0, 0.4, 0.75]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Anclado abajo a la izquierda: el logo del arte ocupa el tercio
          superior izquierdo, así que el texto crece hacia arriba sin taparlo. */}
      <View style={{ position: "absolute", left: "6%", right: isWebDesktop ? "48%" : "30%", bottom: "8%" }}>
        <AppText style={{ color: "#fff", fontSize: t.titulo, fontWeight: "900", lineHeight: t.tituloAlto }}>
          {title}
        </AppText>
        {t.bajada > 0 && (
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
          <AppText style={{ color: colors.primary, fontWeight: "900", fontSize: t.cta }}>{cta}</AppText>
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
        backgroundColor: "rgba(0,0,0,0.22)",
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
          imageStyle={{ borderRadius: 22 }}
          style={{
            borderRadius: 22,
            overflow: "hidden",
            aspectRatio: isWebDesktop ? 4 : 2,
            backgroundColor: "#3E7D1E",
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
          placeholderTextColor="#9b6f8b"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text }}
        />
        <Pressable onPress={submit} style={{ backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" }}>
          <AppText style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>Suscribirme</AppText>
        </Pressable>
      </View>
    </>
  );

  // La franja de diseño es casi 10:1 y el bloque queda mucho más alto, así que
  // va con `cover`: `stretch` estiraría el arte 2,4x a lo alto y deformaría el
  // ícono que trae incrustado. Con el recorte ese ícono queda fuera de cuadro,
  // por eso se sigue dibujando el ícono suelto encima. En móvil el bloque es
  // vertical y el recorte no dejaría degradado útil: ahí va el de marca.
  return isWebDesktop ? (
    <ImageBackground
      source={BANNER_NEWS}
      resizeMode="cover"
      imageStyle={{ borderRadius: 22 }}
      style={{ ...layout, overflow: "hidden" }}
    >
      {contenido}
    </ImageBackground>
  ) : (
    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={layout}>
      {contenido}
    </LinearGradient>
  );
}

// ─── Franja de confianza (4 señales) ─────────────────────────────────────────────
function TrustBar({ isWebDesktop }) {
  const items = [
    { icon: "cart-outline", label: "Precios mayoristas", sub: "Ahorra más comprando online" },
    { icon: "shield-checkmark-outline", label: "Pago 100% seguro", sub: "Transacciones protegidas" },
    { icon: "car-outline", label: "Despacho rápido", sub: "A todo Chile" },
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
function OffersBanner({ navigation, isWebDesktop }) {
  return (
    <LinearGradient
      colors={GRAD}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 22, overflow: "hidden", marginBottom: spacing.lg, padding: isWebDesktop ? 36 : 24 }}
    >
      <View pointerEvents="none" style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.12)" }} />
      <View style={{ alignSelf: "flex-start", backgroundColor: colors.discount, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
        <AppText style={{ color: "#7a4d00", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>🔥 LIQUIDACIÓN</AppText>
      </View>
      <AppText style={{ color: "#fff", fontSize: isWebDesktop ? 30 : 23, fontWeight: "900", lineHeight: isWebDesktop ? 34 : 27 }}>
        Ofertas imperdibles{"\n"}¡Por tiempo limitado!
      </AppText>
      <AppText style={{ color: "rgba(255,255,255,0.92)", fontSize: 14, marginTop: 10, maxWidth: 520 }}>
        Aprovecha nuestros descuentos exclusivos en productos seleccionados.
      </AppText>
      <Pressable
        onPress={() => navigation.navigate("Products", { preset: "liquidation" })}
        style={{ alignSelf: "flex-start", marginTop: 20, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <AppText style={{ color: colors.primary, fontWeight: "900", fontSize: 14 }}>Ver liquidaciones</AppText>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </Pressable>
    </LinearGradient>
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
    try {
      setAddingProductId(product._id);
      const n = Math.max(1, Number(cajas) || 1);
      await addItemToCart({ productId: product._id, quantity: boxQtyOf(product) * n });
      await loadCartSummary();
      showToast(n > 1 ? `${n} cajas agregadas al carrito` : "Caja agregada al carrito");
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "No se pudo agregar al carrito");
    } finally {
      setAddingProductId(null);
    }
  };

  const goFeature = (item) => {
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
            {cartCount > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 }}>
                <AppText style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{cartCount}</AppText>
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

  return (
    <ScreenContainer maxWidth={1180} padded>
      <FlatList
        data={[]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item, index) => String(item?._id ?? index)}
        renderItem={null}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListFooterComponent={<View style={{ height: spacing.lg }} />}
        ListHeaderComponent={
          <View>
            {/* Buscador móvil */}
            {!isWebDesktop && (
              <View style={{ marginBottom: spacing.md, zIndex: 999, elevation: 999 }}>
                <MobileSearchBar />
              </View>
            )}

            {/* Bienvenida (CMS, opcional) */}
            {(!!welcomeTitle || !!welcomeSubtitle) && (
              <View style={{ marginBottom: spacing.md }}>
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
            )}

            {/* Hero */}
            <Hero navigation={navigation} isWebDesktop={isWebDesktop} isWide={isWide} content={slots?.hero} />

            {/* Banners secundarios 1-3 (CMS, opcionales) */}
            <PromoBanners slots={slots} navigation={navigation} isWebDesktop={isWebDesktop} />

            {/* 6 accesos rápidos con íconos de marca */}
            <View
              onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
              style={{ flexDirection: "row", flexWrap: "wrap", gap: featureGap, marginBottom: spacing.lg }}
            >
              {features.map((item) => (
                <FeatureCard key={item.id} item={item} width={cardW} onPress={() => goFeature(item)} />
              ))}
            </View>

            {/* Newsletter */}
            <Newsletter
              title="Entérate de nuestras ofertas y novedades"
              subtitle="Suscríbete y recibe beneficios exclusivos"
              isWebDesktop={isWebDesktop}
            />

            {/* Productos destacados */}
            <View style={{ marginBottom: spacing.lg }}>
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

            {/* Franja de confianza */}
            <TrustBar isWebDesktop={isWebDesktop} />

            {/* Ofertas imperdibles */}
            <OffersBanner navigation={navigation} isWebDesktop={isWebDesktop} />

            {/* Zona de liquidación (productos reales con ahorro) */}
            {!sectionsLoading && liquidation.length > 0 && (
              <View style={{ marginBottom: spacing.lg, backgroundColor: `${colors.discount}1A`, borderRadius: 22, borderWidth: 1, borderColor: `${colors.discount}55`, padding: spacing.md }}>
                <SectionTitle title="Zona de liquidación" />
                <ProductRowSection
                  title=""
                  products={liquidation}
                  onPressProduct={onPressProduct}
                  onAddToCart={handleAddFromCard}
                  addingProductId={addingProductId}
                />
              </View>
            )}

            {/* Categorías principales + ¿Por qué elegir Cibox? */}
            <View style={{ flexDirection: isWide ? "row" : "column", gap: spacing.lg, marginBottom: spacing.lg }}>
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

            {/* Recomendados (con sesión) */}
            {recommendedProducts.length > 0 && (
              <View style={{ marginBottom: spacing.lg }}>
                <SectionTitle title="Recomendados para ti" />
                <ProductRowSection
                  title=""
                  products={recommendedProducts}
                  onPressProduct={onPressProduct}
                  onAddToCart={handleAddFromCard}
                  addingProductId={addingProductId}
                />
              </View>
            )}

            {/* Newsletter final */}
            <Newsletter
              title="No te pierdas nuestras ofertas"
              subtitle="Suscríbete y recibe las mejores promociones directo en tu correo"
              isWebDesktop={isWebDesktop}
            />
          </View>
        }
      />
      <MobileCategoryMenu visible={categoryMenuOpen} onClose={() => setCategoryMenuOpen(false)} />
    </ScreenContainer>
  );
}
