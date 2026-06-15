/**
 * GradientText — text filled with a horizontal/vertical linear gradient.
 * Uses expo-linear-gradient + mask for crisp gradient text.
 */
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

interface GradientTextProps {
  text: string;
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
}

export function GradientText({ text, colors, style }: GradientTextProps) {
  const flatStyle = StyleSheet.flatten(style) as TextStyle;
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

// Stub fallback if MaskedView is not yet installed.
export function GradientTextSafe(props: GradientTextProps & { fallbackTextStyle?: TextStyle }) {
  try {
    return <GradientText {...props} />;
  } catch {
    return <Text style={[props.style as TextStyle, props.fallbackTextStyle]}>{props.text}</Text>;
  }
}

const styles = StyleSheet.create({});
