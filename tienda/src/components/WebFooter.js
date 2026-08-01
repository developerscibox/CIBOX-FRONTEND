import { Linking, Pressable, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import AppText from "./AppText";
import useAuthStore from "../store/authStore";
import { useHomeSlots, cmsText } from "../services/contentService";

import brand, { links } from "../constants/brand";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.82)";
const LINE = "rgba(255,255,255,0.22)";
const GRAD = ["#E81E86", "#C0006F", "#3B7A1D"];

// ─── Link de columna ─────────────────────────────────────────────────────────
function FooterLink({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 10 }}>
      {({ hovered }) => (
        <AppText style={{ fontSize: 13, color: hovered ? "#fff" : MUTED, fontWeight: "500" }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

// ─── Columna ─────────────────────────────────────────────────────────────────
function Col({ title, children }) {
  return (
    <View style={{ flex: 1, minWidth: 150 }}>
      <AppText style={{ fontSize: 13, fontWeight: "900", color: TEXT, marginBottom: 16 }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

// ─── Ícono social ─────────────────────────────────────────────────────────────
function SocialBtn({ name, url }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: LINE,
        backgroundColor: pressed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
      })}
    >
      <Ionicons name={name} size={19} color="#fff" />
    </Pressable>
  );
}

// ─── Chip de medio de pago ────────────────────────────────────────────────────
function PayChip({ label }) {
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 }}>
      <AppText style={{ fontSize: 12, fontWeight: "900", color: "#3B7A1D", letterSpacing: 0.3 }}>
        {label}
      </AppText>
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
export default function WebFooter() {
  const navigation = useNavigation();
  const { token } = useAuthStore();
  // Nota del pie editable desde el CMS (slots.textos.footer_note), con
  // fallback exacto al texto de fábrica.
  const slots = useHomeSlots();
  const footerNote = cmsText(
    slots?.textos?.footer_note,
    "Tu supermercado online. Compra desde donde estés: nosotros preparamos tu pedido y te lo llevamos.",
  );

  return (
    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: "100%" }}>
      {/* Cuerpo */}
      <View
        style={{
          maxWidth: 1280,
          alignSelf: "center",
          width: "100%",
          paddingHorizontal: 32,
          paddingVertical: 48,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 32,
        }}
      >
        {/* Marca */}
        <View style={{ flex: 1.4, minWidth: 240 }}>
          <Image
            source={require("../../assets/logo-cibox.png")}
            resizeMode="contain"
            style={{ width: 132, height: 170, marginBottom: 14, marginLeft: -4 }}
          />
          <AppText style={{ fontSize: 13.5, color: MUTED, lineHeight: 20, maxWidth: 300, marginBottom: 18 }}>
            {footerNote}
          </AppText>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SocialBtn name="logo-instagram" url={links.instagram()} />
            <SocialBtn name="logo-tiktok" url={links.tiktok()} />
            <SocialBtn name="logo-whatsapp" url={links.whatsapp()} />
          </View>
        </View>

        {/* Enlaces rápidos */}
        <Col title="Enlaces rápidos">
          <FooterLink label="Inicio" onPress={() => navigation.navigate("Inicio")} />
          <FooterLink label="Mi Despensa" onPress={() => navigation.navigate(token ? "PantryTab" : "Auth")} />
          <FooterLink label="Más Vendido" onPress={() => navigation.navigate("Products", { preset: "best_sellers" })} />
          <FooterLink label="Liquidación" onPress={() => navigation.navigate("Products", { preset: "liquidation" })} />
          <FooterLink label="Beneficios" onPress={() => navigation.navigate("Beneficios")} />
          <FooterLink label="Blog" onPress={() => navigation.navigate("Blog")} />
          <FooterLink label="Contacto" onPress={() => navigation.navigate("Contact")} />
        </Col>

        {/* Información */}
        <Col title="Información">
          <FooterLink label="Quiénes somos" onPress={() => navigation.navigate("HowItWorks")} />
          <FooterLink label="Términos y condiciones" onPress={() => navigation.navigate("Terms")} />
          <FooterLink label="Política de privacidad" onPress={() => navigation.navigate("Privacy")} />
          <FooterLink label="Formas de pago" onPress={() => navigation.navigate("HowItWorks")} />
          <FooterLink label="Despacho y entregas" onPress={() => navigation.navigate("Despacho")} />
          <FooterLink label="Nuestras tiendas" onPress={() => navigation.navigate("Stores")} />
          <FooterLink label="Preguntas frecuentes" onPress={() => navigation.navigate("Contact")} />
        </Col>

        {/* Contacto */}
        <Col title="Contacto">
          <Pressable onPress={() => Linking.openURL("https://wa.me/56932445772")} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="call-outline" size={16} color="#fff" />
            <AppText style={{ fontSize: 13, color: MUTED }}>{brand.contact.phone}</AppText>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`mailto:${brand.contact.email}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="mail-outline" size={16} color="#fff" />
            <AppText style={{ fontSize: 13, color: MUTED }}>{brand.contact.email}</AppText>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
            <Ionicons name="location-outline" size={16} color="#fff" style={{ marginTop: 2 }} />
            <AppText style={{ fontSize: 12.5, color: MUTED, lineHeight: 17, flex: 1 }}>
              {brand.address.one_line}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Ionicons name="time-outline" size={16} color="#fff" style={{ marginTop: 2 }} />
            <AppText style={{ fontSize: 12.5, color: MUTED, lineHeight: 17, flex: 1 }}>
              Lun a Vie 09:00–18:00 · Sáb 09:00–13:00
            </AppText>
          </View>
        </Col>
      </View>

      {/* Bottom bar */}
      <View style={{ borderTopWidth: 1, borderColor: LINE }}>
        <View
          style={{
            maxWidth: 1280,
            alignSelf: "center",
            width: "100%",
            paddingVertical: 18,
            paddingHorizontal: 32,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <AppText style={{ fontSize: 12.5, color: MUTED }}>
            © {new Date().getFullYear()} {brand.legal.razon_social || brand.name}. Todos los derechos reservados.
          </AppText>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <PayChip label="webpay" />
            <PayChip label="VISA" />
            <PayChip label="Mastercard" />
            <PayChip label="Redcompra" />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
