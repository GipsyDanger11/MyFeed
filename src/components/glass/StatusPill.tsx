/**
 * StatusPill — small colored badge for the automation status row.
 */
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusPillProps {
  label: string;
  variant: Variant;
  dot?: boolean;
  style?: ViewStyle;
}

const colorMap = {
  success: { fg: Colors.success, bg: "rgba(34,197,94,0.12)" },
  warning: { fg: Colors.warning, bg: "rgba(245,158,11,0.12)" },
  danger: { fg: Colors.danger, bg: "rgba(239,68,68,0.12)" },
  info: { fg: Colors.info, bg: "rgba(59,130,246,0.12)" },
  neutral: { fg: Colors.textMuted, bg: Colors.surfaceStrong },
} as const;

export function StatusPill({ label, variant, dot = true, style }: StatusPillProps) {
  const c = colorMap[variant];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.fg }]} />}
      <Text style={[Typography.caption, { color: c.fg, fontWeight: "700" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1.5],
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
  },
});
