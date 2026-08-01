import { useEffect, useRef } from "react";
import { Animated, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import useToastStore from "../store/toastStore";
import { colors } from "../constants/theme";
import AppText from "./AppText";

const ICON = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};
const ICON_COLOR = {
  success: colors.primary,
  error: "#f87171",
  info: "#fff",
};
const useNative = Platform.OS !== "web";

export default function Toast() {
  const { visible, message, type } = useToastStore();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: useNative,
    }).start();
  }, [visible, opacity]);

  if (!visible || !message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        // En web, "fixed" ancla el toast al viewport (no al documento scrolleable).
        position: Platform.OS === "web" ? "fixed" : "absolute",
        left: 0,
        right: 0,
        bottom: 36,
        alignItems: "center",
        paddingHorizontal: 16,
        opacity,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "#1f2430",
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 18,
          maxWidth: 440,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Ionicons
          name={ICON[type] || ICON.success}
          size={20}
          color={ICON_COLOR[type] || ICON_COLOR.success}
        />
        <AppText style={{ color: "#fff", fontWeight: "700", fontSize: 14, flexShrink: 1 }}>
          {message}
        </AppText>
      </View>
    </Animated.View>
  );
}
