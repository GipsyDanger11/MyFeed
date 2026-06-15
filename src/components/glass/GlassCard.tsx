/**
 * GlassCard — frosted glass surface used everywhere in the app.
 * Uses a semi-transparent fill + subtle border + optional glow shadow.
 */
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import { Colors, Gradients } from "@/constants/colors";
import { Radius, Shadow, Spacing } from "@/constants/spacing";

interface GlassCardProps extends ViewProps {
  children: ReactNode;
  variant?: "default" | "strong" | "outline";
  padding?: keyof typeof Spacing | number;
  radius?: keyof typeof Radius;
  glow?: boolean;
  style?: ViewStyle;
  /** Show a soft gradient accent strip along the top edge. */
  accent?: boolean;
}

export function GlassCard({
  children,
  variant = "default",
  padding = 5,
  radius = "2xl",
  glow = false,
  accent = false,
  style,
  ...rest
}: GlassCardProps) {
  const paddingValue = typeof padding === "number" ? padding : Spacing[padding];
  const backgroundColor =
    variant === "strong"
      ? Colors.surfaceStrong
      : variant === "outline"
        ? "rgba(255,255,255,0.02)"
        : Colors.surface;
  const borderColor = variant === "outline" ? Colors.borderStrong : Colors.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          borderRadius: Radius[radius],
          padding: paddingValue,
        },
        glow ? Shadow.glow : Shadow.card,
        style,
      ]}
      {...rest}
    >
      {accent && (
        <LinearGradient
          colors={Gradients.hero as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.accent, { borderTopLeftRadius: Radius[radius], borderTopRightRadius: Radius[radius] }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: Platform.OS === "ios" ? 0.5 : 1,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
