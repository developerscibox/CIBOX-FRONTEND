import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import ScreenContainer from "../components/ScreenContainer";
import { colors, spacing } from "../constants/theme";
import AppText from "../components/AppText";

const BACKEND_HOST = "api.cibox.cl";
const SUCCESS_PATH = "/orders/success";
const FAILED_PATH = "/orders/failed";
// Esquema nuevo + legado: el backend redirige con MOBILE_DEEP_LINK, que puede
// seguir siendo myapp:// hasta que se actualice su .env
const APP_SCHEMES = ["cibox://", "myapp://"];
const startsWithScheme = (url, path = "") =>
  APP_SCHEMES.some((scheme) => url.startsWith(scheme + path));

export default function WebpayScreen({ route, navigation }) {
  const { orderId, paymentToken, paymentUrl } = route.params || {};
  const alreadyHandledRef = useRef(false);

  const html = `
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
        <form id="webpayForm" action="${paymentUrl}" method="POST">
          <input type="hidden" name="token_ws" value="${paymentToken}" />
        </form>
        <script>
          setTimeout(function() {
            document.getElementById("webpayForm").submit();
          }, 300);
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!paymentToken || !paymentUrl) return;

    // Usar form dinámico en vez de document.write() (deprecado y bloqueado por CSP)
    const form = document.createElement("form");
    form.method = "POST";
    form.action = paymentUrl;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token_ws";
    input.value = paymentToken;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }, [paymentToken, paymentUrl]);

  const goToSuccess = (finalOrderId) => {
    if (alreadyHandledRef.current) return;
    alreadyHandledRef.current = true;
    navigation.replace("OrderSuccess", {
      orderId: finalOrderId || orderId,
    });
  };

  const goToFailed = (finalOrderId, status = "rejected") => {
    if (alreadyHandledRef.current) return;
    alreadyHandledRef.current = true;
    navigation.replace("OrderFailed", {
      orderId: finalOrderId || orderId,
      status,
    });
  };

  const inspectUrl = (url) => {
    if (!url || alreadyHandledRef.current) return;

    console.log("WEBPAY URL:", url);

    try {
      const parsed = new URL(url);
      const finalOrderId = parsed.searchParams.get("orderId") || orderId;
      const status = parsed.searchParams.get("status") || "rejected";
      const path = parsed.pathname;
      const host = parsed.hostname;

      // Solo reaccionar a URLs propias — ignorar URLs de Transbank
      const isOwnUrl =
        startsWithScheme(url) ||
        host === BACKEND_HOST ||
        host === "www.cibox.cl" ||
        host === "urchin-app-4d3ww.ondigitalocean.app" ||
        host === "localhost";

      if (!isOwnUrl) return;

      if (startsWithScheme(url, "orders/success") || path === SUCCESS_PATH) {
        goToSuccess(finalOrderId);
        return;
      }

      if (startsWithScheme(url, "orders/failed") || path === FAILED_PATH) {
        goToFailed(finalOrderId, status);
        return;
      }
    } catch (error) {
      // URL no parseable — intentar con startsWith
      if (startsWithScheme(url, "orders/success")) {
        goToSuccess(orderId);
        return;
      }
      if (startsWithScheme(url, "orders/failed")) {
        goToFailed(orderId, "rejected");
      }
    }
  };

  const handleMessage = (event) => {
    try {
      const raw = event?.nativeEvent?.data;
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data?.type === "WEBPAY_SUCCESS") {
        goToSuccess(data.orderId);
        return;
      }
      if (data?.type === "WEBPAY_FAILED") {
        goToFailed(data.orderId, data.status || "rejected");
      }
    } catch (error) {
      console.log("WEBPAY MESSAGE ERROR:", error?.message);
    }
  };

  if (Platform.OS === "web") {
    return (
      <ScreenContainer maxWidth={900}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
          <AppText style={{ marginTop: 12, color: colors.muted }}>
            Redirigiendo a Webpay...
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={900}>
      <View style={{ flex: 1 }}>
        <View style={{ paddingVertical: spacing.md }}>
          <AppText style={{ fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 }}>
            Pago con Webpay
          </AppText>
          <AppText style={{ color: colors.muted }}>
            Estamos redirigiéndote al pago.
          </AppText>
        </View>

        <View style={{ flex: 1, overflow: "hidden", borderRadius: 16, backgroundColor: "#fff" }}>
          <WebView
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onMessage={handleMessage}
            onNavigationStateChange={(navState) => {
              inspectUrl(navState?.url || "");
            }}
            renderLoading={() => (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" />
                <AppText style={{ marginTop: 12, color: colors.muted }}>
                  Cargando Webpay...
                </AppText>
              </View>
            )}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}