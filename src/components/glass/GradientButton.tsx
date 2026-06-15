/**
 * GradientButton — primary action button with gradient fill + glow.
 * Supports loading and disabled states, scales on press.
 */
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";

import { Colors, Gradients } from "@/constants/colors";
import { Radius, Shadow, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "md" | "lg";
}

export function GradientButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
  textStyle,
  size = "lg",
}: GradientButtonProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const inactive = disabled || loading;

  const height = size === "lg" ? 56 : 48;
  const fontSize = size === "lg" ? 17 : 15;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.wrapper,
        fullWidth && { alignSelf: "stretch" },
        { height, opacity: inactive ? 0.55 : pressed ? 0.9 : 1 },
        isPrimary && Shadow.glow,
        style,
      ]}
    >
      {isPrimary && (
        <LinearGradient
          colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { borderRadius: Radius.xl }]}
        />
      )}
      {isDanger && (
        <LinearGradient
          colors={["#EF4444", "#B91C1C"] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { borderRadius: Radius.xl }]}
        />
      )}
      {isGhost && (
        <View
          style={[
            styles.fill,
            { backgroundColor: Colors.surfaceStrong, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.borderStrong },
          ]}
        />
      )}      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text
              style={[
                Typography.bodyBold,
                { color: isGhost ? Colors.text : "#fff", fontSize, letterSpacing: 0.2 },
                textStyle,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.xl,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[5],
    gap: Spacing[2],
  },
  icon: { marginRight: Spacing[1] },
});
