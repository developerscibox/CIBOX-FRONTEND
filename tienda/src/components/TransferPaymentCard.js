import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import { colors, radius, spacing } from "../constants/theme";
import {
  getTransferInfo,
  uploadTransferReceipt,
} from "../services/orderService";
import { pickReceiptImage } from "../utils/imagePicker";
import { showAppAlert } from "../utils/appAlerts";
import { showToast } from "../store/toastStore";

const CONTACT_FALLBACK =
  "Aún no publicamos los datos bancarios aquí. Escríbenos por la sección Contacto o al WhatsApp de Bodega 12 y te los enviamos al instante.";

/**
 * Tarjeta "Datos para transferir": muestra los datos bancarios (endpoint
 * público /orders/transfer-info) y permite subir el comprobante de la
 * transferencia (multipart → POST /orders/:id/transfer-receipt).
 */
export default function TransferPaymentCard({
  orderId,
  guestToken = null,
  receiptUploaded = false,
  onUploaded,
}) {
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(!!receiptUploaded);

  useEffect(() => {
    setUploaded(!!receiptUploaded);
  }, [receiptUploaded]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getTransferInfo();
        if (alive) setInfo(data);
      } catch {
        if (alive) setInfo(null);
      } finally {
        if (alive) setLoadingInfo(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const folio = "#" + String(orderId || "").slice(-6).toUpperCase();

  const handleUpload = async () => {
    try {
      const asset = await pickReceiptImage();
      if (!asset) return;
      setUploading(true);
      await uploadTransferReceipt({ orderId, asset, guestToken });
      setUploaded(true);
      showToast("Comprobante enviado. Lo revisaremos a la brevedad.");
      if (onUploaded) onUploaded();
    } catch (err) {
      showAppAlert(
        "Error",
        err?.response?.data?.message ||
          err?.message ||
          "No se pudo subir el comprobante. Intenta de nuevo.",
      );
    } finally {
      setUploading(false);
    }
  };

  const infoLines = String(info || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <View style={styles.card}>
      <AppText style={styles.cardTitle}>Datos para transferir</AppText>

      {loadingInfo ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : infoLines.length ? (
        <View style={styles.bankBox}>
          {infoLines.map((line, i) => (
            <AppText key={i} style={styles.bankLine} selectable>
              {line}
            </AppText>
          ))}
        </View>
      ) : (
        <AppText style={styles.mutedLine}>{CONTACT_FALLBACK}</AppText>
      )}

      <AppText style={styles.folioHint}>
        Indica el folio <AppText style={styles.folioBold}>{folio}</AppText> en
        el comentario de la transferencia.
      </AppText>

      {uploaded ? (
        <>
          <View style={styles.reviewBadge}>
            <Ionicons name="time-outline" size={15} color="#1d4ed8" />
            <AppText style={styles.reviewText}>
              Comprobante en revisión — te avisaremos al confirmar el pago.
            </AppText>
          </View>
          <Pressable
            onPress={handleUpload}
            disabled={uploading}
            style={{ alignSelf: "flex-start", paddingVertical: 6 }}
          >
            <AppText style={styles.reUploadText}>
              {uploading ? "Subiendo..." : "Subir otro comprobante"}
            </AppText>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          )}
          <AppText style={styles.uploadText}>
            {uploading ? "Subiendo..." : "Subir comprobante"}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  bankBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  bankLine: { color: colors.text, fontSize: 14, lineHeight: 21 },
  mutedLine: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  folioHint: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  folioBold: { color: colors.text, fontWeight: "800", fontSize: 13 },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  uploadText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  reviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#1d4ed8" },
  reUploadText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
