import { Linking, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import { colors, radius, shadows, spacing } from "../constants/theme";

import brand from "../constants/brand";

// Identidad: viene de constants/brand.js (que a su vez la trae del backend).
const EMPRESA = brand.name;
const EMAIL = brand.contact.email;
const SITIO = brand.web.site_url;
const SECTIONS = [
  {
    roman: "I",
    title: "Responsable del Tratamiento",
    icon: "business-outline",
    content: `El responsable del tratamiento de sus datos personales es:

BODEGA 12 SpA
RUT: 78.245.061-1
La Concepción 81, Oficina 214, Providencia, Región Metropolitana, Chile
📧 ${EMAIL}
📞 +56 9 3244 5772

Para ejercer cualquier derecho sobre sus datos personales, puede contactarnos directamente a través de los medios indicados anteriormente.`,
  },
  {
    roman: "II",
    title: "Qué Datos Recopilamos",
    icon: "list-outline",
    content: `Recopilamos los siguientes datos personales según la interacción que tenga con nuestra plataforma:

Datos de registro y cuenta:
• Nombre completo.
• Correo electrónico.
• Contraseña (almacenada de forma cifrada).
• Número de teléfono (opcional).

Datos de compra y retiro:
• Historial de pedidos y productos adquiridos.
• Preferencias de retiro en bodega.

Datos de pago:
• ${EMPRESA} no almacena datos de tarjetas. El pago se realiza de forma presencial al retirar el pedido en bodega, en efectivo o por transferencia, por lo que no se procesan pagos en línea a través de la plataforma.

Datos de uso de la plataforma:
• Dirección IP.
• Tipo de dispositivo y sistema operativo.
• Páginas visitadas y tiempo de navegación.
• Búsquedas realizadas dentro de la app.
• Preferencias y productos marcados como favoritos.

Datos de notificaciones push:
• Token de dispositivo para el envío de notificaciones (solo si el usuario otorga permiso).

Datos de comunicaciones:
• Mensajes enviados a través del formulario de contacto o soporte.`,
  },
  {
    roman: "III",
    title: "Finalidad del Tratamiento",
    icon: "flag-outline",
    content: `Sus datos personales son utilizados exclusivamente para las siguientes finalidades:

Finalidades necesarias para la prestación del servicio:
• Crear y gestionar su cuenta de usuario.
• Procesar, confirmar y gestionar sus pedidos.
• Coordinar la preparación y el retiro de productos en bodega.
• Emitir documentos tributarios electrónicos (boletas y facturas) conforme a la normativa del SII.
• Brindar soporte y atención al cliente.
• Gestionar devoluciones, cambios y garantías.

Finalidades de seguridad y cumplimiento:
• Prevenir fraudes y actividades no autorizadas.
• Cumplir obligaciones legales y regulatorias vigentes en Chile.
• Verificar la identidad del usuario cuando sea necesario.

Finalidades con su consentimiento previo:
• Enviar comunicaciones comerciales, promociones y ofertas personalizadas.
• Enviar notificaciones push sobre el estado de sus pedidos y novedades de ${EMPRESA}.
• Realizar análisis estadísticos para mejorar la experiencia de uso.

Usted puede revocar su consentimiento para las finalidades opcionales en cualquier momento, sin que ello afecte la legalidad del tratamiento previo.`,
  },
  {
    roman: "IV",
    title: "Base Legal del Tratamiento",
    icon: "shield-checkmark-outline",
    content: `El tratamiento de sus datos personales se fundamenta en las siguientes bases legales, conforme a la Ley N° 19.628 sobre Protección de la Vida Privada:

• Ejecución de un contrato: cuando el tratamiento es necesario para procesar su compra, gestionar su cuenta o coordinar el retiro del pedido en bodega.
• Cumplimiento de obligación legal: cuando la ley exige el tratamiento, como en la emisión de documentos tributarios.
• Interés legítimo: para la prevención de fraudes, seguridad de la plataforma y mejora del servicio.
• Consentimiento del titular: para el envío de comunicaciones comerciales y notificaciones opcionales.`,
  },
  {
    roman: "V",
    title: "Compartición de Datos con Terceros",
    icon: "share-social-outline",
    content: `${EMPRESA} no vende, arrienda ni cede sus datos personales a terceros con fines comerciales propios.

Sus datos podrán ser compartidos únicamente con:

Proveedores tecnológicos:
• Servicios de infraestructura cloud, hosting y herramientas de análisis que apoyan el funcionamiento de la plataforma, bajo acuerdos de confidencialidad.

Autoridades y organismos regulatorios:
• Cuando sea requerido por ley, orden judicial o fiscalización de organismos competentes (SII, SERNAC, etc.).

Todos los terceros con quienes compartimos datos están obligados a tratarlos de forma confidencial y solo para los fines autorizados.`,
  },
  {
    roman: "VI",
    title: "Transferencias Internacionales de Datos",
    icon: "globe-outline",
    content: `Algunos de nuestros proveedores tecnológicos pueden estar ubicados fuera de Chile (por ejemplo, servicios de infraestructura cloud). En estos casos, ${EMPRESA} exige contractualmente que dichos proveedores apliquen medidas de protección equivalentes a las exigidas por la legislación chilena.

Al utilizar nuestra plataforma, usted acepta que sus datos podrán ser procesados en servidores ubicados fuera del territorio nacional, siempre bajo las garantías antes mencionadas.`,
  },
  {
    roman: "VII",
    title: "Plazo de Conservación de los Datos",
    icon: "time-outline",
    content: `Sus datos personales serán conservados durante los siguientes plazos:

• Datos de cuenta activa: mientras mantenga su cuenta registrada en ${EMPRESA}.
• Historial de compras: mínimo 6 años, conforme a las obligaciones tributarias del SII.
• Datos de comunicaciones y soporte: hasta 2 años desde la última interacción.
• Datos para marketing (con consentimiento): hasta que revoque su consentimiento.

Una vez vencidos los plazos, los datos serán eliminados o anonimizados de forma segura, salvo que una obligación legal exija su conservación por un período mayor.`,
  },
  {
    roman: "VIII",
    title: "Derechos del Titular (ARCO)",
    icon: "person-outline",
    content: `Conforme a la Ley N° 19.628, usted tiene derecho a:

Acceso:
• Solicitar información sobre qué datos personales suyos tratamos, para qué finalidad y a quién han sido comunicados.

Rectificación:
• Solicitar la corrección de datos inexactos, incompletos o desactualizados.

Cancelación (Eliminación):
• Solicitar la eliminación de sus datos cuando ya no sean necesarios para la finalidad por la que fueron recopilados, o cuando revoque su consentimiento.

Oposición:
• Oponerse al tratamiento de sus datos para finalidades de marketing o cuando el tratamiento se base en interés legítimo.

Portabilidad:
• Solicitar una copia de sus datos en formato estructurado y de uso común.

Para ejercer cualquiera de estos derechos, envíe una solicitud a:
📧 ${EMAIL}
Indicando: nombre completo, correo registrado, derecho que desea ejercer y motivo (si corresponde).

${EMPRESA} responderá dentro de un plazo razonable y a más tardar en 15 días hábiles.`,
  },
  {
    roman: "IX",
    title: "Seguridad de los Datos",
    icon: "lock-closed-outline",
    content: `${EMPRESA} implementa medidas técnicas y organizativas para proteger sus datos personales frente a accesos no autorizados, pérdida, destrucción o divulgación indebida, incluyendo:

• Cifrado de contraseñas mediante algoritmos seguros (bcrypt).
• Comunicaciones cifradas mediante protocolo HTTPS/TLS.
• Acceso restringido a datos personales solo al personal autorizado.
• Monitoreo continuo de la plataforma para detectar incidentes de seguridad.
• Copias de seguridad periódicas de la información.

En caso de una brecha de seguridad que afecte sus datos, ${EMPRESA} le notificará a la brevedad posible conforme a la normativa aplicable.`,
  },
  {
    roman: "X",
    title: "Cookies y Tecnologías de Seguimiento",
    icon: "information-circle-outline",
    content: `La versión web de ${EMPRESA} puede utilizar cookies y tecnologías similares para:

Cookies estrictamente necesarias:
• Mantener su sesión activa.
• Recordar el contenido de su carrito de compras.
• Garantizar la seguridad de la navegación.

Cookies de análisis y rendimiento:
• Medir el tráfico y comportamiento de los usuarios para mejorar la plataforma (con su consentimiento).

Cookies de personalización:
• Recordar sus preferencias de navegación (idioma, región, etc.).

Puede gestionar o deshabilitar las cookies desde la configuración de su navegador. La desactivación de cookies necesarias puede afectar el correcto funcionamiento de la plataforma.

La aplicación móvil no utiliza cookies, pero puede recopilar datos de uso de forma similar a través del sistema operativo del dispositivo.`,
  },
  {
    roman: "XI",
    title: "Menores de Edad",
    icon: "people-outline",
    content: `Los servicios de ${EMPRESA} están dirigidos a personas mayores de 18 años. No recopilamos intencionalmente datos personales de menores de edad.

Si un menor de 18 años desea utilizar la plataforma, deberá contar con la autorización expresa de sus padres o tutores legales, quienes asumirán la responsabilidad por el uso que el menor haga de la plataforma.

Si tomamos conocimiento de que hemos recopilado datos de un menor sin autorización, procederemos a eliminarlos a la brevedad.`,
  },
  {
    roman: "XII",
    title: "Notificaciones Push",
    icon: "notifications-outline",
    content: `La aplicación móvil de ${EMPRESA} puede enviar notificaciones push a su dispositivo para informarle sobre:

• El estado de sus pedidos (confirmación, preparación, listo para retiro).
• Promociones y ofertas especiales (solo con su consentimiento).
• Novedades y actualizaciones relevantes de la plataforma.

Puede activar o desactivar las notificaciones push en cualquier momento desde la configuración de su dispositivo o desde las preferencias de su cuenta en la app, sin que ello afecte la prestación del servicio principal.`,
  },
  {
    roman: "XIII",
    title: "Modificaciones a esta Política",
    icon: "create-outline",
    content: `${EMPRESA} podrá modificar esta Política de Privacidad en cualquier momento para adaptarla a cambios legislativos, jurisprudenciales o a modificaciones en nuestros servicios.

Las modificaciones serán publicadas en la plataforma con la correspondiente fecha de actualización. Si los cambios son significativos, le notificaremos por correo electrónico o mediante un aviso destacado en la app.

El uso continuado de la plataforma tras la publicación de cambios implica la aceptación de la política actualizada.`,
  },
  {
    roman: "XIV",
    title: "Legislación Aplicable",
    icon: "library-outline",
    content: `Esta Política de Privacidad se rige por:

• Ley N° 19.628 sobre Protección de la Vida Privada (Chile).
• Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.
• Normativa del Servicio de Impuestos Internos (SII) en materia de documentos tributarios.
• Demás normativa aplicable vigente en la República de Chile.

Cualquier controversia derivada de la aplicación de esta política será sometida a los Tribunales Ordinarios de Justicia de la ciudad de Santiago de Chile.`,
  },
  {
    roman: "XV",
    title: "Contacto y Consultas",
    icon: "mail-outline",
    content: `Para cualquier consulta, solicitud o reclamo relacionado con el tratamiento de sus datos personales, puede contactarnos:

📧 ${EMAIL}
📞 +56 9 3244 5772
📍 La Concepción 81, Oficina 214, Providencia, Santiago.

Horario de atención: Lunes a viernes, 9:00 a 18:00 hrs.
Tiempo de respuesta: máximo 15 días hábiles.`,
  },
];

// ─── Componente de sección ────────────────────────────────────────────────────
function SectionBlock({ section }) {
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: 14,
      ...shadows.card,
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <View style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: `${colors.primary}14`,
          borderWidth: 1,
          borderColor: `${colors.primary}25`,
          justifyContent: "center",
          alignItems: "center",
          flexShrink: 0,
        }}>
          <Ionicons name={section.icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{
            backgroundColor: colors.primary,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
            alignSelf: "flex-start",
            marginBottom: 4,
          }}>
            <AppText style={{ fontSize: 10, fontWeight: "900", color: "#fff", letterSpacing: 0.8 }}>
              {section.roman}
            </AppText>
          </View>
          <AppText style={{ fontSize: 15, fontWeight: "900", color: colors.text, lineHeight: 20 }}>
            {section.title}
          </AppText>
        </View>
      </View>

      {/* Separador */}
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 14 }} />

      {/* Contenido */}
      <AppText style={{ fontSize: 13, color: colors.muted, lineHeight: 22 }}>
        {section.content}
      </AppText>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function PrivacyScreen() {
  return (
    <ScreenContainer maxWidth={800} padded>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Hero ── */}
        <View style={{
          backgroundColor: `${colors.primary}0E`,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: `${colors.primary}20`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: `${colors.primary}18`,
              borderWidth: 1,
              borderColor: `${colors.primary}28`,
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
            }}>
              <Ionicons name="lock-closed-outline" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 2 }}>
                Política de Privacidad
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.muted }}>
                Cómo recopilamos, usamos y protegemos tus datos personales.
              </AppText>
            </View>
          </View>

          {/* Info empresa */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            gap: 6,
          }}>
            <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
              BODEGA 12 SpA
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>RUT: 78.245.061-1</AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>
              La Concepción 81, Oficina 214, Providencia, Región Metropolitana, Chile
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>📧 {EMAIL}</AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>📞 +56 9 3244 5772</AppText>
          </View>

          {/* Fecha + Ley */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: `${colors.primary}12`,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                Última actualización: 20.02.2026
              </AppText>
            </View>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: `${colors.primary}12`,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
              <AppText style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                Ley N° 19.628 — Chile
              </AppText>
            </View>
          </View>
        </View>

        {/* ── Aviso ARCO destacado ── */}
        <View style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          backgroundColor: `${colors.accent}15`,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: `${colors.accent}30`,
          padding: spacing.md,
          marginBottom: spacing.lg,
        }}>
          <Ionicons name="information-circle-outline" size={22} color={colors.accent} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginBottom: 3 }}>
              Tus derechos sobre tus datos
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
              Tienes derecho a acceder, rectificar, eliminar u oponerte al uso de tus datos personales en cualquier momento. Escríbenos a{" "}
              <AppText
                style={{ color: colors.primary, fontWeight: "700" }}
                onPress={() => Linking.openURL(`mailto:${EMAIL}`)}
              >
                {EMAIL}
              </AppText>
            </AppText>
          </View>
        </View>

        {/* ── Secciones ── */}
        {SECTIONS.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}

        {/* ── Footer ── */}
        <View style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingTop: 16,
          marginTop: 6,
          alignItems: "center",
        }}>
          <AppText style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
            © 2026 BODEGA 12 SpA — Todos los derechos reservados
          </AppText>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
