import { useEffect, useState } from "react";
import { View, Image, Pressable, ActivityIndicator } from "react-native";
import client from "../api/client";
import useAuthStore from "../store/authStore";
import AppText from "./AppText";
import { colors } from "../constants/theme";

import brand from "../constants/brand";
// PAUSA DE LA TIENDA: el panel de gestión puede pausar la tienda online
// (mantención, inventario, demo). Mientras está pausada, los CLIENTES ven esta
// pantalla en vez de la app; el personal interno (admin/gerente/vendor) entra
// igual. El backend además bloquea el checkout, así que esto es solo la cara
// amable. Se consulta al abrir y se re-consulta cada 60s (reanuda sola).
const STAFF_ROLES = ["admin", "manager", "vendor"];

export default function StorePausedGate({ children }) {
  const { user } = useAuthStore();
  const [status, setStatus] = useState(null); // null = aún no se sabe (no bloquear)
  const [checking, setChecking] = useState(false);

  const consultar = async () => {
    setChecking(true);
    try {
      const r = await client.get("/content/store-status");
      setStatus(r.data?.data || { paused: false });
    } catch {
      // Sin respuesta no se bloquea la tienda: mejor abierta que caída por error nuestro.
      setStatus((s) => s || { paused: false });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    consultar();
    const id = setInterval(consultar, 60000);
    return () => clearInterval(id);
  }, []);

  // Solo por rol (sin exigir token): en web prod el access token NO se persiste al
  // recargar (queda solo user) y exigirlo dejaría al staff fuera sin poder ni
  // loguearse (el gate desmonta el AppStack, incluida la pantalla de Auth). Es solo
  // UI: la validación real la hace el backend (checkout bloqueado + JWT en rutas).
  const isStaff = STAFF_ROLES.includes(user?.role);
  if (!status?.paused || isStaff) return children;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <Image
        source={require("../../assets/logo-cibox.png")}
        style={{ width: 220, height: 66, resizeMode: "contain", marginBottom: 26 }}
      />
      <AppText style={{ fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 10 }}>
        Estamos haciendo mejoras
      </AppText>
      <AppText style={{ fontSize: 16, color: "#6b7280", textAlign: "center", maxWidth: 420, lineHeight: 23, marginBottom: 26 }}>
        {status.message || "La tienda online está en pausa por unos momentos. Vuelve a intentarlo más tarde — ¡gracias por tu paciencia!"}
      </AppText>
      <Pressable
        onPress={consultar}
        disabled={checking}
        style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 34, opacity: checking ? 0.6 : 1 }}
      >
        {checking
          ? <ActivityIndicator color="#fff" />
          : <AppText style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Reintentar</AppText>}
      </Pressable>
      <AppText style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 30 }}>
        {brand.name} · {brand.tagline}
      </AppText>
    </View>
  );
}
