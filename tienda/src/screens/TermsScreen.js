import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import AppText from "../components/AppText";
import { colors, radius, shadows, spacing } from "../constants/theme";

import brand, { hasAddress } from "../constants/brand";

// Identidad: viene de constants/brand.js (que a su vez la trae del backend).
// Es un documento legal: la razón social, el RUT y el domicilio NO se escriben
// a mano acá, tienen que ser los mismos que declara el backend.
const EMPRESA = brand.name;
const EMAIL = brand.contact.email;
const SITIO = brand.web.site_url;
const RAZON_SOCIAL = brand.legal.razon_social;
const RUT = brand.legal.rut;
const TELEFONO = brand.contact.phone;
// Sin dirección definida no se declara domicilio: en un contrato electrónico
// una dirección equivocada es peor que ninguna.
const DOMICILIO = hasAddress() ? brand.address.one_line : "";
const DOMICILIO_LINEA = DOMICILIO ? `
📍 ${DOMICILIO}` : "";
const SECTIONS = [
  {
    roman: "I",
    title: "Disposiciones Generales",
    items: [
      {
        num: "1",
        title: "Objeto",
        content: `El presente instrumento regula:

• El uso del sitio web ${SITIO}
• La compra de productos.
• Las condiciones de retiro de los pedidos en bodega.
• Las políticas sanitarias.
• El tratamiento de datos personales.
• La relación contractual entre ${EMPRESA} y el cliente.

Este documento constituye contrato electrónico y se regulan conforme a la Ley N°19.496.

• Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.
• Ley N° 19.628 sobre Protección de la Vida Privada.
• Reglamento Sanitario de los Alimentos (DS N° 977/96 Ministerio de Salud).
• Código de Comercio y Código Civil chileno.
• Normativa del Servicio de Impuestos Internos (SII) sobre documentos tributarios electrónicos.`,
      },
      {
        num: "2",
        title: "Identificación del Proveedor",
        content: `El proveedor responsable de la plataforma y de las ventas efectuadas a través del Sitio es: ${RAZON_SOCIAL}, RUT ${RUT}, sociedad legalmente constituida en Chile, dedicada a la comercialización digital de productos de supermercado, abarrotes, alimentos, bebidas, artículos de aseo y productos para el hogar.`,
      },
    ],
  },
  {
    roman: "II",
    title: "Modelo de Negocio y Alcance Operacional",
    items: [
      {
        num: "3",
        title: "Modelo",
        content: `${EMPRESA} opera como:

• Supermercado mayorista digital.
• Venta directa de productos por caja.
• Programas de ahorro y membresías.
• Comercializador directo de productos, cajas temáticas, packs u otro bulto.

El retiro se realiza únicamente en nuestra bodega. No se realiza despacho a domicilio.

${EMPRESA} podrá abastecer productos desde:

• Bodega y centros de almacenamiento propios.
• Proveedores autorizados.

${EMPRESA} actúa como vendedor directo de los productos ofrecidos en el Sitio.`,
      },
      {
        num: "4",
        title: "Registro de Usuario",
        content: `Para realizar compras, el cliente podrá:

• Comprar como invitado.
• Crear una cuenta registrando datos verídicos y actualizados.

El usuario es responsable de la confidencialidad de su clave de acceso y de todas las operaciones realizadas desde su cuenta.`,
      },
      {
        num: "5",
        title: "Proceso de Compra",
        content: `La compra se perfecciona cuando:

• El cliente selecciona los productos (por caja).
• Acepta los presentes términos.
• Reserva su pedido para retiro en bodega.
• Recibe confirmación electrónica de la orden.

El pago se realiza de forma presencial al momento del retiro, en efectivo o mediante transferencia.

${EMPRESA} podrá anular pedidos en caso de:

• Error evidente en precios.
• Falta de stock no informada oportunamente.
• Pedido no retirado dentro del plazo informado.`,
      },
      {
        num: "6",
        title: "Precios y Medios de Pago",
        content: `Los precios:

• Se expresan en pesos chilenos (CLP).
• Incluyen IVA.
• Corresponden al precio por unidad; el total de cada caja equivale al precio por unidad multiplicado por las unidades por caja.
• Pueden variar sin previo aviso.

Medios de pago aceptados:

• Efectivo.
• Transferencia bancaria.

El pago se realiza de forma presencial al momento del retiro del pedido en bodega. ${EMPRESA} no procesa pagos en línea a través del Sitio.`,
      },
    ],
  },
  {
    roman: "III",
    title: "Perfeccionamiento del Contrato",
    items: [
      {
        num: "7",
        title: "Proceso de Perfeccionamiento",
        content: `La venta se perfecciona cuando:

• El cliente acepta los términos.
• El cliente reserva su pedido para retiro en bodega.
• ${EMPRESA} envía confirmación electrónica.

El pago se efectúa al momento del retiro, en efectivo o por transferencia. Hasta ese momento, la orden es una reserva de compra.

${EMPRESA} podrá rechazar pedidos por:

• Error manifiesto de precio.
• Sospecha de fraude.
• Falta de stock.`,
      },
    ],
  },
  {
    roman: "IV",
    title: "Precios y Errores Evidentes",
    items: [
      {
        num: null,
        title: null,
        content: `En caso de error tipográfico evidente:

• ${EMPRESA} podrá dejar sin efecto la orden.
• Se devolverá íntegramente el monto pagado.
• No procederán indemnizaciones adicionales.`,
      },
    ],
  },
  {
    roman: "V",
    title: "Retiro en Bodega y Cumplimiento",
    items: [
      {
        num: "8",
        title: "Modalidad de Entrega: Retiro en Bodega",
        content: `La única modalidad de entrega es el retiro presencial en nuestra bodega. No se realiza despacho a domicilio.

Lugar de retiro:

• En la bodega de ${EMPRESA}. La dirección se informa al confirmar el pedido.

El retiro se realiza dentro del horario y plazo informados al cliente una vez que su pedido se encuentre preparado.`,
      },
      {
        num: "9",
        title: "Riesgo y Transferencia",
        content: `El riesgo del producto se transfiere al cliente al momento del retiro presencial del pedido en la bodega.

El cliente debe revisar los productos al momento del retiro.`,
      },
      {
        num: "10",
        title: "Disponibilidad",
        content: `${EMPRESA} preparará los pedidos para su retiro en bodega según la disponibilidad de stock informada en el Sitio.`,
      },
      {
        num: "11",
        title: "Plazos de Preparación",
        content: `Los plazos de preparación para retiro estarán de acuerdo con:

• Los informados al momento de la compra.
• La disponibilidad de stock al momento de preparar el pedido.
• Condiciones operativas propias de la bodega.

${EMPRESA} avisará al cliente cuando su pedido esté listo para ser retirado.`,
      },
      {
        num: "12",
        title: "Retiro del Pedido",
        content: `El cliente debe:

• Retirar su pedido en bodega dentro del plazo informado.
• Presentar la confirmación de su orden al momento del retiro.
• Pagar de forma presencial, en efectivo o por transferencia, al momento del retiro.
• Revisar los productos al momento del retiro.

Si el cliente no retira su pedido dentro del plazo informado, ${EMPRESA} podrá liberar el stock y anular la orden según corresponda.`,
      },
      {
        num: "13",
        title: "Pago al Retirar",
        content: `El pago de los pedidos se realiza de forma presencial, al momento del retiro en bodega, mediante:

• Efectivo.
• Transferencia bancaria.

${EMPRESA} no procesa pagos en línea ni cobra costos de envío, por cuanto la única modalidad de entrega es el retiro presencial en bodega.`,
      },
    ],
  },
  {
    roman: "VI",
    title: "Productos Perecibles y Cadena de Frío",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} cumple con:

• Reglamento Sanitario de los Alimentos (DS 977/96).
• Normativa de cadena de frío.
• Exigencias de almacenamiento y manipulación.

${EMPRESA} garantiza:

• Almacenamiento en condiciones adecuadas.
• Control de temperatura.
• Manipulación conforme DS 977/96.

El cliente debe revisar al momento del retiro:

• Integridad.
• Temperatura.
• Estado visible.

Los productos perecibles:

• No están sujetos a derecho a retracto, conforme al art. 3 bis letra b) de la Ley 19.496.
• Deben conservarse según indicaciones del envase.
• Reclamos por productos perecibles deberán realizarse dentro de 6 horas desde el retiro.`,
      },
    ],
  },
  {
    roman: "VII",
    title: "Derecho a Retracto",
    items: [
      {
        num: null,
        title: null,
        content: `Aplica dentro de 10 días para productos no perecibles. En compras electrónicas, el cliente podrá ejercer derecho a retracto dentro de 10 días desde la recepción.

No aplica para:

• Alimentos frescos.
• Productos abiertos o manipulados.
• Bienes personalizados.
• Productos de higiene personal.`,
      },
    ],
  },
  {
    roman: "VIII",
    title: "Garantía Legal",
    items: [
      {
        num: null,
        title: null,
        content: `En caso de producto defectuoso, el cliente podrá optar por:

• Cambio.
• Reparación.
• Devolución del dinero.

Dentro de los 6 meses siguientes a la recepción, conforme Ley 19.496.`,
      },
    ],
  },
  {
    roman: "IX",
    title: "Sustitución de Productos",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} podrá sustituir productos por:

• Marca equivalente.
• Calidad similar o superior.
• Igual o mayor gramaje.

En caso de quiebre de stock, ${EMPRESA} podrá:

• Contactar al cliente para ofrecer reemplazo equivalente.
• Reembolsar el monto correspondiente.

Si el cliente no acepta, se reembolsará la diferencia.`,
      },
    ],
  },
  {
    roman: "X",
    title: "Responsabilidad y Limitación de Responsabilidad",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} no será responsable por:

• Pérdidas indirectas.
• Lucro cesante.
• Retrasos por causas externas.
• Eventos de fuerza mayor.
• Eventos climáticos extremos.
• Deterioro posterior a la entrega por mal almacenamiento del cliente.
• Fallas de terceros no atribuibles a ${EMPRESA}.

La responsabilidad total máxima estará limitada al valor del pedido.

${EMPRESA} será responsable conforme a la normativa vigente por:

• Incumplimientos contractuales.
• Entrega defectuosa imputable al proveedor.`,
      },
      {
        num: "16",
        title: "Protección de Datos Personales",
        content: `Los datos personales serán tratados conforme a la Ley 19.628.

Finalidades:

• Procesar compras.
• Emitir documentos tributarios.
• Gestión logística.
• Comunicaciones comerciales (previo consentimiento).

El cliente podrá solicitar acceso, rectificación o eliminación, y revocar consentimiento en cualquier momento.`,
      },
    ],
  },
  {
    roman: "XI",
    title: "Protección de Datos",
    items: [
      {
        num: null,
        title: null,
        content: `Los datos podrán utilizarse para:

• Procesamiento de órdenes.
• Facturación electrónica.
• Marketing con consentimiento.
• Análisis comercial.
• Registro comercial.

El cliente podrá ejercer derechos ARCO (Acceso, Rectificación, Cancelación y Oposición).`,
      },
    ],
  },
  {
    roman: "XII",
    title: "Facturación Electrónica y Documentos Tributarios",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} emitirá documentos tributarios electrónicos conforme a la normativa del SII. El cliente es responsable de proporcionar datos correctos para efectos de facturación.`,
      },
    ],
  },
  {
    roman: "XIII",
    title: "Membresías y Programas de Ahorro",
    items: [
      {
        num: null,
        title: null,
        content: `Los beneficios:

• No son acumulables salvo indicación expresa.
• Pueden modificarse con aviso previo.
• No generan derecho adquirido permanente.

Las condiciones específicas de membresías, incluyendo beneficios, descuentos, vigencia y requisitos, serán informadas separadamente y podrán modificarse con aviso previo.`,
      },
    ],
  },
  {
    roman: "XIV",
    title: "Retiro Sanitario (Recall)",
    items: [
      {
        num: null,
        title: null,
        content: `En caso de alerta sanitaria:

• ${EMPRESA} notificará a clientes afectados.
• Coordinará retiro del producto.
• Procederá a reembolso o reemplazo.`,
      },
    ],
  },
  {
    roman: "XV",
    title: "Propiedad Intelectual",
    items: [
      {
        num: null,
        title: null,
        content: `Todo contenido del sitio es propiedad de ${EMPRESA}. Queda prohibida su reproducción sin autorización escrita previa.`,
      },
    ],
  },
  {
    roman: "XVI",
    title: "Modificaciones",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} podrá modificar estos términos. Las nuevas versiones serán publicadas en el Sitio con fecha de actualización.`,
      },
    ],
  },
  {
    roman: "XVII",
    title: "Legislación Aplicable y Jurisdicción",
    items: [
      {
        num: null,
        title: null,
        content: `Estos términos se rigen por la legislación chilena, por lo que cualquier controversia será sometida a los Tribunales ordinarios de justicia de Santiago de Chile, sin perjuicio del derecho del consumidor a recurrir al SERNAC.`,
      },
    ],
  },
  {
    roman: "XVIII",
    title: "Resolución de Controversias",
    items: [
      {
        num: null,
        title: null,
        content: `• Mediación voluntaria ante SERNAC.
• Tribunales ordinarios de Santiago.`,
      },
    ],
  },
  {
    roman: "XIX",
    title: "Fuerza Mayor",
    items: [
      {
        num: null,
        title: null,
        content: `Incluye:

• Huelgas.
• Restricciones sanitarias.
• Desastres naturales.
• Fallas sistémicas de telecomunicaciones.`,
      },
    ],
  },
  {
    roman: "XX",
    title: "Contacto",
    items: [
      {
        num: null,
        title: null,
        content: `Para consultas, reclamos o solicitudes:

📧 ${EMAIL}
📞 +56 9 3244 5772
${DOMICILIO_LINEA}`,
      },
    ],
  },
  {
    roman: "XXI",
    title: "Cláusula de Integridad Contractual",
    items: [
      {
        num: null,
        title: null,
        content: `Si una disposición es declarada nula, el resto mantiene plena vigencia.`,
      },
    ],
  },
  {
    roman: "XXII",
    title: "Aceptación Digital",
    items: [
      {
        num: null,
        title: null,
        content: `El cliente declara haber leído y aceptado íntegramente estos términos al marcar la casilla correspondiente antes de pagar.`,
      },
    ],
  },
  {
    roman: "XXIII",
    title: "Función de la Plataforma",
    items: [
      {
        num: null,
        title: null,
        content: `${EMPRESA} pone a disposición del usuario una plataforma tecnológica que permite:

• Visualizar los productos ofrecidos.
• Realizar pedidos por caja.
• Reservar pedidos para su retiro en bodega.

${EMPRESA} actúa como vendedor directo de los productos ofrecidos en el Sitio. La entrega se realiza exclusivamente mediante retiro presencial en bodega y el pago se efectúa al momento del retiro, en efectivo o por transferencia. ${EMPRESA} no opera despacho a domicilio ni procesa pagos en línea a través del Sitio.`,
      },
    ],
  },
];

// ─── Componentes ─────────────────────────────────────────────────────────────

function RomanBadge({ roman }) {
  return (
    <View style={{
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
      marginBottom: 10,
    }}>
      <AppText style={{ fontSize: 11, fontWeight: "900", color: "#fff", letterSpacing: 1 }}>
        {roman}
      </AppText>
    </View>
  );
}

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
      {/* Encabezado de sección */}
      <RomanBadge roman={section.roman} />
      <AppText style={{
        fontSize: 16,
        fontWeight: "900",
        color: colors.text,
        marginBottom: 16,
        letterSpacing: 0.2,
      }}>
        {section.title}
      </AppText>

      {/* Items dentro de la sección */}
      {section.items.map((item, i) => (
        <View key={i} style={[
          i < section.items.length - 1 && {
            borderBottomWidth: 1,
            borderColor: colors.border,
            paddingBottom: 16,
            marginBottom: 16,
          },
        ]}>
          {/* Número + título del artículo (si existe) */}
          {item.num && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: `${colors.primary}15`,
                borderWidth: 1,
                borderColor: `${colors.primary}28`,
                justifyContent: "center",
                alignItems: "center",
                flexShrink: 0,
              }}>
                <AppText style={{ fontSize: 11, fontWeight: "900", color: colors.primary }}>
                  {item.num}
                </AppText>
              </View>
              <AppText style={{ fontSize: 14, fontWeight: "800", color: colors.text, flex: 1 }}>
                {item.title}
              </AppText>
            </View>
          )}

          <AppText style={{ fontSize: 13, color: colors.muted, lineHeight: 22 }}>
            {item.content}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function TermsScreen() {
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
              <Ionicons name="document-text-outline" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 2 }}>
                Términos y Condiciones
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.muted }}>
                Condiciones de uso que rigen tu experiencia en nuestro sitio.
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
              {RAZON_SOCIAL}
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>RUT: 78.245.061-1</AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>
              {hasAddress() ? brand.address.one_line : `RUT: ${RUT}`}
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>📧 {EMAIL}</AppText>
            <AppText style={{ fontSize: 12, color: colors.muted }}>📞 +56 9 3244 5772</AppText>
          </View>

          {/* Fecha */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            alignSelf: "flex-start",
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
            © 2026 {RAZON_SOCIAL} — Todos los derechos reservados
          </AppText>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
