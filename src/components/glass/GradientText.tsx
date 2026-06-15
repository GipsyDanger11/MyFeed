/**
 * GradientText — text filled with a horizontal/vertical linear gradient.
 * Uses expo-linear-gradient + mask on native. On web, falls back to a
 * solid color (because MaskedView doesn't render in the browser).
 */
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleProp, StyleSheet, Text, TextStyle } from "react-native";

interface GradientTextProps {
  text: string;
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
}

export function GradientText({ text, colors, style }: GradientTextProps) {
  const flatStyle = StyleSheet.flatten(style) as TextStyle;

  // Web fallback: MaskedView doesn't render. Use solid first color
  // (still looks good against the dark background).
  if (Platform.OS === "web") {
    return (
      <Text style={[flatStyle, { color: colors[0] }]} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  // Native: real gradient via mask.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MaskedView = require("@react-native-masked-view/masked-view").default;
  return (
    <MaskedView
      maskElement={
        <Text style={[flatStyle, { backgroundColor: "transparent" }]} numberOfLines={1}>
          {text}
        </Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[flatStyle, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({});
