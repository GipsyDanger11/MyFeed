/**
 * Chip — used for topic selection on the preferences screen.
 * Two states: boost (green) and reduce (red). Pill-shaped.
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

export type ChipVariant = "boost" | "reduce" | "neutral";

interface ChipProps {
  label: string;
  emoji?: string;
  selected: boolean;
  variant: ChipVariant;
  onPress: () => void;
  style?: ViewStyle;
}

export function Chip({ label, emoji, selected, variant, onPress, style }: ChipProps) {
  const colorMap = {
    boost: { fg: Colors.boost, bg: Colors.boostBg, border: "rgba(34, 197, 94, 0.45)" },
    reduce: { fg: Colors.reduce, bg: Colors.reduceBg, border: "rgba(239, 68, 68, 0.45)" },
    neutral: { fg: Colors.text, bg: Colors.surfaceStrong, border: Colors.borderStrong },
  } as const;
  const c = colorMap[variant];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.bg : "rgba(255,255,255,0.04)",
          borderColor: selected ? c.border : Colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text
        style={[
          Typography.smallBold,
          { color: selected ? c.fg : Colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 16,
  },
});
