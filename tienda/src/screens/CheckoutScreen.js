import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  Platform,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { colors, spacing } from "../constants/theme";
import {
  createOrderFromCart,
  createWebpayTransaction,
} from "../services/orderService";
import { getCart } from "../services/cartService";
import useCartStore from "../store/cartStore";
import {
  getCheckoutAddress,
  saveCheckoutAddress,
} from "../utils/checkoutStorage";
import { showAppAlert } from "../utils/appAlerts";
import AppText from "../components/AppText";
import UnitPrice from "../components/UnitPrice";
import {
  getCheckoutCouponPreview,
  validateCouponCode,
} from "../services/couponService";
import useAuthStore from "../store/authStore";

import {
  DESPACHO_COMUNAS,
  DESPACHO_REGION,
  despacho,
  comunasEnTexto,
  esComunaConReparto,
  tarifaEnTexto,
} from "../constants/delivery";

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const isValidEmail = (email = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));

const normalizePhoneCL = (phone = "") => {
  let value = String(phone).replace(/[^\d+]/g, "");

  if (value.startsWith("56")) value = `+${value}`;
  if (!value.startsWith("+56") && value.length === 9 && value.startsWith("9")) {
    value = `+56${value}`;
  }

  return value;
};

const isValidPhoneCL = (phone = "") =>
  /^\+569\d{8}$/.test(normalizePhoneCL(phone));

const cleanRut = (rut = "") =>
  String(rut).replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();

const formatRut = (rut = "") => {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let out = "";
  let count = 0;

  for (let i = body.length - 1; i >= 0; i--) {
    out = body[i] + out;
    count++;
    if (count === 3 && i !== 0) {
      out = "." + out;
      count = 0;
    }
  }

  return `${out}-${dv}`;
};

const isValidRut = (rut = "") => {
  const cleaned = cleanRut(rut);

  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  let expected = "";

  if (result === 11) expected = "0";
  else if (result === 10) expected = "K";
  else expected = String(result);

  return expected === dv;
};

// Valor del selector de comuna para quien vive fuera de la zona. Está en la
// lista a propósito: si el cliente no encuentra su comuna, tiene dónde decirlo
// y recibe la explicación ahí mismo, en vez de irse sin entender por qué no
// aparece la suya.
const COMUNA_FUERA_DE_ZONA = "__fuera__";

export default function CheckoutScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");

  // Dirección de despacho. La región no se pregunta: repartimos en una sola.
  const [comuna, setComuna] = useState("");
  const [street, setStreet] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [reference, setReference] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [cart, setCart] = useState(null);
  const [loadingCart, setLoadingCart] = useState(true);
  const [loadingSavedAddress, setLoadingSavedAddress] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [autoDiscount, setAutoDiscount] = useState(null);
  const [errors, setErrors] = useState({});
  const { token } = useAuthStore();
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState(null);
  const { loadCartSummary } = useCartStore();

  const formatPrice = (value) => {
    const number = Number(value || 0);
    return `$${number.toLocaleString("es-CL")}`;
  };

  const getBoxItems = (item) => {
    if (Array.isArray(item?.box_items) && item.box_items.length > 0) {
      return item.box_items;
    }

    if (
      Array.isArray(item?.product?.box_items) &&
      item.product.box_items.length > 0
    ) {
      return item.product.box_items;
    }

    return [];
  };

  const isBoxProduct = (item) => {
    return (
      item?.product_type === "box" ||
      item?.product?.product_type === "box" ||
      getBoxItems(item).length > 0
    );
  };

  const cardStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
    minHeight: 52,
  };

  const labelStyle = {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 14,
  };

  const errorTextStyle = {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
  };

  const fetchCart = async () => {
    try {
      setLoadingCart(true);
      const data = await getCart();
      setCart(data);
    } catch (error) {
      console.log(
        "GET CHECKOUT CART ERROR:",
        error?.response?.data || error.message,
      );
      showAppAlert("Error", "No se pudo cargar el resumen del carrito");
    } finally {
      setLoadingCart(false);
    }
  };

  const loadSavedAddress = async () => {
    try {
      setLoadingSavedAddress(true);

      const saved = await getCheckoutAddress();

      if (saved) {
        setFullName(saved.fullName || "");
        setEmail(saved.email || "");
        setPhone(saved.phone || "");
        setRut(saved.rut || "");
        setStreet(saved.street || "");
        setAddressLine2(saved.addressLine2 || "");
        setReference(saved.reference || "");
        // La comuna guardada se acepta solo si sigue teniendo reparto: si un
        // día dejamos de llegar a una comuna, el cliente que ya compró ahí no
        // puede colarse con ella preseleccionada.
        if (esComunaConReparto(saved.comuna)) setComuna(saved.comuna);
      }
    } catch (error) {
      console.log("LOAD SAVED ADDRESS ERROR:", error);
    } finally {
      setLoadingSavedAddress(false);
    }
  };

  useEffect(() => {
    fetchCart();
    loadSavedAddress();
  }, []);

  const discountAmount = couponResult?.valid
    ? Number(couponResult.discount_preview || 0)
    : Number(autoDiscount?.discount_amount || 0);
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const productsTotal = Number(cart?.total || 0);
  // Tarifa plana: el mismo precio para las cuatro comunas y para cualquier
  // peso. Se muestra desde el principio para que el total no cambie al final.
  // Del objeto vivo, no de una constante: el precio lo fija el backend al
  // arrancar la app y es el que se va a cobrar en Webpay.
  const shippingAmount = despacho.tarifa;
  const finalTotal = productsTotal + shippingAmount - discountAmount;

  // El cliente ya dijo que su comuna no está en la lista: no tiene sentido
  // pedirle el resto de los datos, el formulario se detiene ahí.
  const fueraDeZona = comuna === COMUNA_FUERA_DE_ZONA;
  const comunaElegida = esComunaConReparto(comuna);

  const validateForm = () => {
    const nextErrors = {};

    if (!comunaElegida) {
      nextErrors.comuna = "Elige tu comuna para ver si llegamos";
    }
    // 5 caracteres es el mínimo que pide el backend para la dirección.
    if (street.trim().length < 5) {
      nextErrors.street = "Escribe tu calle y número";
    }
    if (!fullName.trim()) nextErrors.fullName = "Ingresa tu nombre completo";
    if (!isValidEmail(email)) nextErrors.email = "Ingresa un correo válido";
    if (!isValidPhoneCL(phone)) {
      nextErrors.phone = "Ingresa un teléfono chileno válido";
    }
    if (!isValidRut(rut)) nextErrors.rut = "Ingresa un RUT válido";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const fetchAutoDiscount = async () => {
    console.log("fetchAutoDiscount");
    try {
      if (!productsTotal) {
        setAutoDiscount(null);
        return;
      }

      const data = await getCheckoutCouponPreview({
        subtotal: productsTotal,
      });

      setAutoDiscount(data?.applies ? data : null);
    } catch (error) {
      console.log(
        "AUTO DISCOUNT PREVIEW ERROR:",
        error?.response?.data || error.message,
      );
      setAutoDiscount(null);
    }
  };
  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    try {
      setCouponLoading(true);
      setCouponResult(null);
      const result = await validateCouponCode({
        code,
        subtotal: productsTotal,
      });
      setCouponResult(result);
    } catch {
      setCouponResult({ valid: false, message: "Error al validar el cupón" });
    } finally {
      setCouponLoading(false);
    }
  };
  useEffect(() => {
    if (!token) return; // ← agregar esta línea
    fetchAutoDiscount();
  }, [productsTotal, token]);

  const handleCheckout = async () => {
    if (!validateForm()) {
      showAppAlert("Revisa tus datos", "Hay campos inválidos en el checkout");
      return;
    }

    if (!termsAccepted) {
      showAppAlert(
        "Términos y condiciones",
        "Debes aceptar los términos y condiciones para continuar.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        customer: {
          fullName: fullName.trim(),
          email: normalizeEmail(email),
          phone: normalizePhoneCL(phone),
          rut: formatRut(rut),
        },
        // Todo pedido se despacha: ya no existe el retiro en bodega.
        delivery: {
          method: "delivery",
        },
        shipping: {
          region: DESPACHO_REGION,
          city: comuna,
          address: street.trim(),
          addressLine2: addressLine2.trim() || null,
          reference: reference.trim() || null,
        },
        // Único medio de pago. Va literal y no en una variable de estado
        // porque no hay nada que elegir; si mañana entra otro medio se agrega
        // aquí y en la tarjeta de pago, no en tres sitios.
        payment: {
          method: "webpay",
          platform: Platform.OS === "web" ? "web" : Platform.OS,
        },
        notes: deliveryNotes.trim() || null,
      };

      if (couponCode.trim()) {
        payload.couponCode = couponCode.trim().toUpperCase();
      }

      const orderResponse = await createOrderFromCart(payload);
      const order =
        orderResponse?.order ||
        orderResponse?.data?.order ||
        orderResponse?.data ||
        orderResponse;

      if (!order?._id) {
        throw new Error("No se pudo obtener la orden creada");
      }

      const guestToken =
        orderResponse?.guest_token || orderResponse?.data?.guest_token || null;

      // La dirección también se guarda: en la segunda compra el cliente no
      // vuelve a escribir dónde vive.
      await saveCheckoutAddress({
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        phone: normalizePhoneCL(phone),
        rut: formatRut(rut),
        comuna,
        street: street.trim(),
        addressLine2: addressLine2.trim(),
        reference: reference.trim(),
      });

      await loadCartSummary();

      // Un solo camino: la orden nace impaga y se paga con tarjeta en Webpay.
      const payment = await createWebpayTransaction({
        orderId: order._id,
        platform: Platform.OS === "web" ? "web" : Platform.OS,
        guestToken,
      });

      if (!payment?.paymentToken || !payment?.paymentUrl) {
        showAppAlert("Error", "No se pudo iniciar el pago con Webpay");
        // A OrderFailed y no al detalle: ahí está el botón de reintentar el
        // pago, que es lo único que el cliente puede hacer en este punto.
        navigation.replace("OrderFailed", { orderId: order._id });
        return;
      }

      navigation.replace("Webpay", {
        orderId: order._id,
        paymentToken: payment.paymentToken,
        paymentUrl: payment.paymentUrl,
      });
    } catch (error) {
      const data = error?.response?.data;
      console.log("CHECKOUT ERROR:", data || error.message);

      // El backend (Zod) devuelve details: [{ path, message }]. Lo traducimos a
      // los campos del formulario para mostrar EXACTAMENTE qué corregir.
      const FIELD_BY_PATH = {
        "customer.fullName": { field: "fullName", label: "Nombre completo" },
        "customer.email": { field: "email", label: "Correo electrónico" },
        "customer.phone": { field: "phone", label: "Teléfono" },
        "customer.rut": { field: "rut", label: "RUT" },
        "shipping.city": { field: "comuna", label: "Comuna" },
        "shipping.address": { field: "street", label: "Dirección" },
        // La región la fija la tienda, pero si el backend la rechaza el error
        // tiene que aterrizar en el selector de comuna: es lo único que el
        // cliente puede corregir.
        "shipping.region": { field: "comuna", label: "Comuna" },
        couponCode: { field: "couponCode", label: "Código de cupón" },
      };
      const details = Array.isArray(data?.details) ? data.details : [];
      const fieldErrors = {};
      const labels = [];
      for (const d of details) {
        const map = FIELD_BY_PATH[d?.path];
        if (map) {
          fieldErrors[map.field] = "Revisa este dato";
          labels.push(map.label);
        }
      }
      if (Object.keys(fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }

      const uniqueLabels = [...new Set(labels)];
      if (uniqueLabels.length) {
        showAppAlert(
          "Revisa tus datos",
          `Hay datos que no son válidos: ${uniqueLabels.join(", ")}. Corrígelos e intenta de nuevo.`,
        );
      } else {
        showAppAlert(
          "Error",
          data?.message || error.message || "No se pudo completar la compra",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCart || loadingSavedAddress) {
    return (
      <ScreenContainer maxWidth={720}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  // Sin items no hay nada que pagar: mostrar estado vacío con CTA al catálogo
  // en vez de un checkout vacío.
  if (!items.length) {
    return (
      <ScreenContainer maxWidth={720}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
          }}
        >
          <AppText
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Tu carrito está vacío
          </AppText>

          <AppText
            style={{
              color: colors.muted,
              marginBottom: 20,
              textAlign: "center",
              maxWidth: 420,
              lineHeight: 22,
            }}
          >
            Agrega productos de Cibox a tu carrito antes de continuar.
          </AppText>

          <AppButton
            title="Ir al catálogo"
            onPress={() => navigation.navigate("Products")}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={720}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <AppText
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: colors.text,
            marginBottom: 6,
          }}
        >
          Finalizar compra
        </AppText>

        <AppText
          style={{
            color: colors.muted,
            marginBottom: spacing.md,
            fontSize: 15,
          }}
        >
          Completa tus datos y revisa tu compra antes de confirmar.
        </AppText>

        {/* ── Dónde lo dejamos ────────────────────────────────────────
            Esta tarjeta va primero, y dentro de ella la comuna va antes que la
            calle: si no llegamos a donde vive el cliente tiene que enterarse
            ahora, no después de escribir nombre, RUT, correo y teléfono. */}
        <View style={cardStyle}>
          <AppText
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 4,
            }}
          >
            Dirección de despacho
          </AppText>

          <AppText style={{ color: colors.muted, marginBottom: 14, fontSize: 14 }}>
            Llevamos tu pedido a domicilio en {comunasEnTexto()}. El despacho
            cuesta {tarifaEnTexto()} por pedido, sin importar cuánto pidas.
          </AppText>

          <AppText style={labelStyle}>Comuna</AppText>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: errors.comuna ? 6 : 14,
            }}
          >
            {DESPACHO_COMUNAS.map((nombre) => {
              const isSelected = comuna === nombre;
              return (
                <Pressable
                  key={nombre}
                  onPress={() => {
                    setComuna(nombre);
                    if (errors.comuna) {
                      setErrors((prev) => ({ ...prev, comuna: "" }));
                    }
                  }}
                  style={{
                    borderWidth: 1.5,
                    // La comuna elegida se pinta con el lima de marca, que es
                    // el color de estado; encima el texto va oscuro.
                    borderColor: isSelected ? colors.accent : colors.border,
                    backgroundColor: isSelected ? colors.accent : "#FFFFFF",
                    borderRadius: 12,
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    minWidth: 104,
                    alignItems: "center",
                  }}
                >
                  <AppText
                    style={{
                      color: isSelected ? colors.accentText : colors.text,
                      fontWeight: "800",
                      fontSize: 14,
                    }}
                  >
                    {nombre}
                  </AppText>
                </Pressable>
              );
            })}

            {/* Salida explicita para quien vive fuera: sin esta opción el
                cliente se queda mirando una lista corta sin saber por qué no
                aparece la suya. */}
            <Pressable
              onPress={() => setComuna(COMUNA_FUERA_DE_ZONA)}
              style={{
                borderWidth: 1.5,
                borderColor: fueraDeZona ? colors.primary : colors.border,
                backgroundColor: fueraDeZona ? `${colors.primary}0A` : "#FFFFFF",
                borderRadius: 12,
                paddingVertical: 11,
                paddingHorizontal: 16,
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  color: fueraDeZona ? colors.primary : colors.muted,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Mi comuna no está
              </AppText>
            </Pressable>
          </View>
          {!!errors.comuna && (
            <AppText style={errorTextStyle}>{errors.comuna}</AppText>
          )}

          {/* El resto de la dirección aparece solo si llegamos a esa comuna. */}
          {comunaElegida ? (
            <>
              <AppText style={labelStyle}>Calle y número</AppText>
              <TextInput
                value={street}
                onChangeText={(value) => {
                  setStreet(value);
                  if (errors.street) {
                    setErrors((prev) => ({ ...prev, street: "" }));
                  }
                }}
                placeholder="Ej: Av. Libertador 1234"
                style={{ ...inputStyle, marginBottom: errors.street ? 0 : 14 }}
                placeholderTextColor="#999"
              />
              {!!errors.street && (
                <AppText style={errorTextStyle}>{errors.street}</AppText>
              )}

              <AppText style={labelStyle}>
                Depto, casa u oficina (opcional)
              </AppText>
              <TextInput
                value={addressLine2}
                onChangeText={setAddressLine2}
                placeholder="Ej: Depto 402, Torre B"
                style={{ ...inputStyle, marginBottom: 14 }}
                placeholderTextColor="#999"
              />

              <AppText style={labelStyle}>
                Referencia para llegar (opcional)
              </AppText>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="Ej: reja negra, frente a la plaza"
                style={inputStyle}
                placeholderTextColor="#999"
              />
            </>
          ) : null}
        </View>

        {/* Fuera de zona: el checkout se detiene aquí. No le pedimos datos a
            alguien a quien no le podemos vender, y le decimos a dónde SÍ
            llegamos por si se equivocó al elegir. */}
        {fueraDeZona ? (
          <View
            style={{
              ...cardStyle,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}0A`,
            }}
          >
            <AppText
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Todavía no llegamos a tu comuna
            </AppText>
            <AppText
              style={{
                color: colors.text,
                fontSize: 14,
                lineHeight: 21,
                marginBottom: 8,
              }}
            >
              Por ahora despachamos solo en {comunasEnTexto()}, en la{" "}
              {DESPACHO_REGION}. Estamos trabajando para llegar a más comunas.
            </AppText>
            <AppText style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              Tu carrito queda guardado: si te equivocaste de comuna, elígela
              arriba y sigues con tu compra.
            </AppText>
          </View>
        ) : (
          <>
        <View style={cardStyle}>
          <AppText
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 14,
            }}
          >
            Contacto
          </AppText>

          <AppText style={labelStyle}>Nombre completo</AppText>
          <TextInput
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              if (errors.fullName) {
                setErrors((prev) => ({ ...prev, fullName: "" }));
              }
            }}
            placeholder="Ej: Claudia Pérez"
            style={{ ...inputStyle, marginBottom: errors.fullName ? 0 : 14 }}
            placeholderTextColor="#999"
          />
          {!!errors.fullName && (
            <AppText style={errorTextStyle}>{errors.fullName}</AppText>
          )}

          <AppText style={labelStyle}>RUT</AppText>
          <TextInput
            value={rut}
            onChangeText={(value) => {
              setRut(formatRut(value));
              if (errors.rut) setErrors((prev) => ({ ...prev, rut: "" }));
            }}
            placeholder="Ej: 12.345.678-5"
            autoCapitalize="characters"
            style={{ ...inputStyle, marginBottom: errors.rut ? 0 : 14 }}
            placeholderTextColor="#999"
          />
          {!!errors.rut && (
            <AppText style={errorTextStyle}>{errors.rut}</AppText>
          )}

          <AppText style={labelStyle}>Correo electrónico</AppText>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
            }}
            placeholder="Ej: correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ ...inputStyle, marginBottom: errors.email ? 0 : 14 }}
            placeholderTextColor="#999"
          />
          {!!errors.email && (
            <AppText style={errorTextStyle}>{errors.email}</AppText>
          )}

          <AppText style={labelStyle}>Teléfono</AppText>
          <TextInput
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
            }}
            placeholder="Ej: +56 9 1234 5678"
            keyboardType="phone-pad"
            style={inputStyle}
            placeholderTextColor="#999"
          />
          {!!errors.phone && (
            <AppText style={errorTextStyle}>{errors.phone}</AppText>
          )}
        </View>

        {/* ── Pago ───────────────────────────────────────────────────
            Se paga con tarjeta y solo con tarjeta, así que esto informa, no
            pregunta: una lista de radio de un solo elemento obliga a hacer clic
            para confirmar lo único que se puede hacer. */}
        <View style={cardStyle}>
          <AppText
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 14,
            }}
          >
            Pago
          </AppText>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: `${colors.primary}0A`,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 14,
            }}
          >
            <AppText style={{ fontSize: 20, lineHeight: 24 }}>💳</AppText>
            <View style={{ flex: 1 }}>
              <AppText
                style={{ color: colors.text, fontWeight: "800", marginBottom: 4 }}
              >
                Tarjeta de crédito o débito
              </AppText>
              <AppText style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                Al confirmar te llevamos a Webpay Plus de Transbank. Los datos de
                tu tarjeta los recibe Transbank: Cibox no los ve ni los guarda.
              </AppText>
            </View>
          </View>
        </View>

        <AppText style={labelStyle}>Código de cupón</AppText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput
            value={couponCode}
            onChangeText={(v) => {
              setCouponCode(v);
              setCouponResult(null);
            }}
            placeholder="Opcional"
            autoCapitalize="characters"
            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
            placeholderTextColor="#999"
          />
          <Pressable
            onPress={handleApplyCoupon}
            disabled={!couponCode.trim() || couponLoading}
            style={{
              backgroundColor: couponCode.trim() ? colors.primary : "#ccc",
              borderRadius: 14,
              paddingHorizontal: 16,
              justifyContent: "center",
              alignItems: "center",
              minWidth: 80,
            }}
          >
            {couponLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <AppText
                style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}
              >
                Aplicar
              </AppText>
            )}
          </Pressable>
        </View>

        {couponResult && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
              padding: 10,
              borderRadius: 10,
              backgroundColor: couponResult.valid ? "#f0fdf4" : "#fef2f2",
              borderWidth: 1,
              borderColor: couponResult.valid ? "#86efac" : "#fca5a5",
            }}
          >
            <AppText style={{ fontSize: 14 }}>
              {couponResult.valid ? "✅" : "❌"}
            </AppText>
            <AppText
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: couponResult.valid ? "#166534" : "#991b1b",
                flex: 1,
              }}
            >
              {couponResult.valid
                ? `Cupón válido — descuento: ${formatPrice(couponResult.discount_preview)}`
                : couponResult.message || "Cupón inválido"}
            </AppText>
          </View>
        )}
        <View style={cardStyle}>
  
          {/* <AppText style={labelStyle}>Código de cupón</AppText>
          <TextInput
            value={couponCode}
            onChangeText={setCouponCode}
            placeholder="Opcional"
            autoCapitalize="characters"
            style={{ ...inputStyle, marginBottom: 14 }}
            placeholderTextColor="#999"
          /> */}
        

          <AppText style={labelStyle}>Notas para la entrega</AppText>
          <TextInput
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            placeholder="Opcional"
            multiline
            textAlignVertical="top"
            style={{
              ...inputStyle,
              minHeight: 100,
              paddingTop: 14,
            }}
            placeholderTextColor="#999"
          />
        </View>

        <View style={cardStyle}>
          <AppText
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 14,
            }}
          >
            Resumen del pedido
          </AppText>

          {!items.length ? (
            <AppText style={{ color: colors.muted }}>
              Tu carrito está vacío.
            </AppText>
          ) : (
            items.map((item, index) => {
              const boxItems = getBoxItems(item);
              const showBoxContents = isBoxProduct(item) && boxItems.length > 0;

              return (
                <View
                  key={item.product_id || item._id || index}
                  style={{
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottomWidth: index === items.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText
                    style={{
                      fontWeight: "800",
                      color: colors.text,
                      marginBottom: 4,
                      fontSize: 15,
                    }}
                  >
                    {item.name}
                  </AppText>

                  <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                    Cantidad: {item.quantity}
                  </AppText>

                  <AppText style={{ color: colors.muted, marginBottom: 4 }}>
                    Precio unitario: {formatPrice(item.unit_price)}
                  </AppText>

                  {/* PPUM — decreto 38/2024, art. 9° */}
                  <UnitPrice product={item} priceSize={14} style={{ marginBottom: 4 }} />

                  <AppText
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                      marginBottom: showBoxContents ? 10 : 0,
                    }}
                  >
                    Subtotal: {formatPrice(item.subtotal)}
                  </AppText>

                  {showBoxContents ? (
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <AppText
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: colors.text,
                          marginBottom: 8,
                        }}
                      >
                        Contiene esta caja
                      </AppText>

                      {boxItems.map((boxItem, boxIndex) => (
                        <AppText
                          key={boxItem?.product_id || boxIndex}
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            lineHeight: 18,
                            marginBottom:
                              boxIndex === boxItems.length - 1 ? 0 : 6,
                          }}
                        >
                          {boxItem?.quantity || 1} x{" "}
                          {boxItem?.name || "Producto"}
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          <View
            style={{
              marginTop: 6,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: 6,
            }}
          >
            <AppText style={{ color: colors.muted }}>
              Total productos: {formatPrice(productsTotal)}
            </AppText>

            {/* El costo va a la vista desde el resumen, no aparece recién
                al final: la tarifa es la misma para toda la zona. */}
            <AppText style={{ color: colors.muted }}>
              Despacho a domicilio: {formatPrice(shippingAmount)}
            </AppText>

            {discountAmount > 0 ? (
              <AppText style={{ color: colors.accent, fontWeight: "800" }}>
                {couponResult?.valid
                  ? `Cupón ${couponResult.code}`
                  : autoDiscount?.label || "Descuento primera compra"}
                : -{formatPrice(discountAmount)}
              </AppText>
            ) : null}

            <AppText
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: colors.text,
                marginTop: 4,
              }}
            >
              Total final: {formatPrice(finalTotal)}
            </AppText>
          </View>
        </View>
        <AppText
          style={{
            color: colors.muted,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 12,
            marginBottom: 16,
          }}
        >
          Al confirmar tu compra, te enviaremos un correo con el resumen del
          pedido y te notificaremos por email cuando el estado cambie.
        </AppText>

        {/* ── Checkbox Términos y Condiciones ── */}
        <Pressable
          onPress={() => setTermsAccepted((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: termsAccepted ? colors.primary : colors.border,
            backgroundColor: termsAccepted ? `${colors.primary}0A` : colors.background,
          }}
        >
          {/* Caja del check */}
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: termsAccepted ? colors.primary : "#C0C0C0",
              backgroundColor: termsAccepted ? colors.primary : "#fff",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {termsAccepted && (
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", lineHeight: 16 }}>
                ✓
              </Text>
            )}
          </View>

          {/* Texto */}
          <AppText style={{ fontSize: 13, color: colors.text, flex: 1, lineHeight: 20 }}>
            He leído y acepto los{" "}
            <AppText
              style={{ color: colors.primary, fontWeight: "700", textDecorationLine: "underline" }}
              onPress={() => navigation.navigate("Terms")}
            >
              Términos y Condiciones
            </AppText>
            {" "}y la{" "}
            <AppText
              style={{ color: colors.primary, fontWeight: "700", textDecorationLine: "underline" }}
              onPress={() => navigation.navigate("Privacy")}
            >
              Política de Privacidad
            </AppText>
            {" "}de Cibox.
          </AppText>
        </Pressable>

        <AppButton
          title={submitting ? "Procesando..." : "Pagar con tarjeta"}
          onPress={handleCheckout}
          disabled={
            submitting || !items.length || !comunaElegida || !termsAccepted
          }
        />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
