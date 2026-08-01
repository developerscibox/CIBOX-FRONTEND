// src/components/AppText.js
import { Text } from "react-native";
import { typography } from "../constants/theme";

export default function AppText({ style, weight = "regular", ...props }) {
  return (
    <Text
      style={[
        { fontFamily: typography[weight] },
        style,
      ]}
      {...props}
    />
  );
}