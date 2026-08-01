import { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import { colors, radius, shadows, spacing } from "../constants/theme";
import { showAppAlert } from "../utils/appAlerts";

const PRIMARY = colors.primary;

// ─── Tarjeta de contacto directo ─────────────────────────────────────────────
function ContactCard({ icon, title, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 180,
        backgroundColor: pressed ? `${PRIMARY}10` : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: pressed ? `${PRIMARY}40` : colors.border,
        padding: spacing.md,
        alignItems: "center",
        gap: 10,
        ...shadows.card,
      })}
    >
      <View style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: `${PRIMARY}14`,
        borderWidth: 1,
        borderColor: `${PRIMARY}28`,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Ionicons name={icon} size={24} color={PRIMARY} />
      </View>
      <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text, textAlign: "center" }}>
        {title}
      </AppText>
      <AppText style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
        {value}
      </AppText>
    </Pressable>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ContactScreen({ navigation }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSend = async () => {
    const { name, email, subject, message } = form;
    if (!name.trim() || !email.trim() || !message.trim()) {
      showAppAlert("Campos requeridos", "Por favor completa nombre, email y mensaje.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAppAlert("Email inválido", "Ingresa un correo electrónico válido.");
      return;
    }

    setSending(true);
    try {
      const body = `Nombre: ${name}\nEmail: ${email}\nAsunto: ${subject}\n\n${message}`;
      const mailto = `mailto:soporte@bodega12.cl?subject=${encodeURIComponent(subject || "Contacto desde Bodega 12 App")}&body=${encodeURIComponent(body)}`;
      await Linking.openURL(mailto);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      showAppAlert("Error", "No se pudo abrir el cliente de correo. Escríbenos directamente a soporte@bodega12.cl");
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 12 : 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  };

  return (
    <ScreenContainer maxWidth={720} padded>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero ── */}
        <View style={{
          backgroundColor: `${PRIMARY}0F`,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: `${PRIMARY}22`,
          padding: spacing.lg,
          alignItems: "center",
          marginBottom: spacing.lg,
        }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: `${PRIMARY}18`,
            borderWidth: 1,
            borderColor: `${PRIMARY}30`,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 14,
          }}>
            <Ionicons name="chatbubbles-outline" size={30} color={PRIMARY} />
          </View>
          <AppText style={{ fontSize: 24, fontWeight: "900", color: colors.text, textAlign: "center", marginBottom: 8 }}>
            ¿En qué podemos ayudarte?
          </AppText>
          <AppText style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 21, maxWidth: 400 }}>
            Estamos disponibles para responder tus preguntas sobre pedidos, productos o cualquier consulta.
          </AppText>
        </View>

        {/* ── Tarjetas de contacto directo ── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: spacing.lg }}>
          <ContactCard
            icon="logo-whatsapp"
            title="WhatsApp"
            value="+56 9 3244 5772"
            onPress={() => Linking.openURL("https://wa.me/56932445772")}
          />
          <ContactCard
            icon="mail-outline"
            title="Email"
            value="soporte@bodega12.cl"
            onPress={() => Linking.openURL("mailto:soporte@bodega12.cl")}
          />
          <ContactCard
            icon="logo-instagram"
            title="Instagram"
            value="@bodega12.cl"
            onPress={() => Linking.openURL("https://instagram.com/bodega12.cl")}
          />
          <ContactCard
            icon="logo-tiktok"
            title="TikTok"
            value="@bodega12.cl"
            onPress={() => Linking.openURL("https://www.tiktok.com/@bodega12.cl")}
          />
        </View>

        {/* ── Dirección / Retiro en bodega ── */}
        <View style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          marginBottom: spacing.lg,
          ...shadows.card,
        }}>
          <Ionicons name="location-outline" size={22} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 4 }}>
              Retiro en bodega
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
              Av. Lo Espejo 01565, Patio 6, Bodega 826, Centro Logístico Mersan, Lo Espejo.
              {"\n"}2da entrada por Américo Vespucio.
            </AppText>
          </View>
        </View>

        {/* ── Formulario ── */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          ...shadows.card,
          marginBottom: spacing.lg,
        }}>
          <AppText style={{ fontSize: 17, fontWeight: "900", color: colors.text, marginBottom: 16 }}>
            Envíanos un mensaje
          </AppText>

          <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase" }}>
            Nombre *
          </AppText>
          <TextInput
            style={inputStyle}
            placeholder="Tu nombre completo"
            placeholderTextColor={colors.muted}
            value={form.name}
            onChangeText={set("name")}
            autoCapitalize="words"
          />

          <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase" }}>
            Email *
          </AppText>
          <TextInput
            style={inputStyle}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.muted}
            value={form.email}
            onChangeText={set("email")}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase" }}>
            Asunto
          </AppText>
          <TextInput
            style={inputStyle}
            placeholder="¿Sobre qué quieres escribirnos?"
            placeholderTextColor={colors.muted}
            value={form.subject}
            onChangeText={set("subject")}
          />

          <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase" }}>
            Mensaje *
          </AppText>
          <TextInput
            style={[inputStyle, { height: 120, textAlignVertical: "top", paddingTop: 12, marginBottom: 20 }]}
            placeholder="Escribe tu mensaje aquí..."
            placeholderTextColor={colors.muted}
            value={form.message}
            onChangeText={set("message")}
            multiline
            numberOfLines={5}
          />

          <AppButton
            title={sending ? "Abriendo correo..." : "Enviar mensaje →"}
            onPress={handleSend}
            disabled={sending}
          />
        </View>

        {/* ── Horario ── */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: `${colors.accent}18`,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: `${colors.accent}30`,
          padding: spacing.md,
        }}>
          <Ionicons name="time-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 2 }}>
              Horario de atención
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
              Lunes a viernes 09:00 – 18:00 · Sábado 09:00 – 13:00.{"\n"}Respondemos en menos de 24 horas hábiles.
            </AppText>
          </View>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
