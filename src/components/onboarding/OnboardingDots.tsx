/**
 * Onboarding step indicator — small dots that show progress through
 * the 4-screen onboarding flow.
 */
import { StyleSheet, View } from "react-native";

import { Colors, Gradients } from "@/constants/colors";
import { Radius } from "@/constants/spacing";

interface OnboardingDotsProps {
  total: number;
  current: number;
}

export function OnboardingDots({ total, current }: OnboardingDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current ? styles.active : null,
            i < current ? styles.past : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  past: { backgroundColor: Colors.purpleSoft },
  active: {
    width: 28,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Gradients.primary[0] as string,
  },
});
