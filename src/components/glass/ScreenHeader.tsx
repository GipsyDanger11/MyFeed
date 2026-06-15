/**
 * ScreenHeader — large gradient title + optional subtitle for screen tops.
 */
import { ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors, Gradients } from "@/constants/colors";
import { Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

import { GradientText } from "./GradientText";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
}

export function ScreenHeader({ title, subtitle, right, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <GradientText
          text={title}
          colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
          style={Typography.h1}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text style={[Typography.body, { color: Colors.textMuted, marginTop: Spacing[2] }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  right: { marginLeft: Spacing[3] },
});
