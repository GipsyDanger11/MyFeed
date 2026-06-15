/**
 * Reusable ambient gradient background.
 * Two large soft-blurred radial gradients float over a deep base.
 * Used as the root background of every screen.
 */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Gradients } from "@/constants/colors";

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={Gradients.background as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient blobs */}
      <View pointerEvents="none" style={[styles.blob, { top: -80, left: -60, width: 320, height: 320, backgroundColor: Gradients.blob1[0] as string }]} />
      <View pointerEvents="none" style={[styles.blob, { top: 120, right: -100, width: 360, height: 360, backgroundColor: Gradients.blob2[0] as string }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: -80, left: 60, width: 300, height: 300, backgroundColor: Gradients.blob3[0] as string }]} />
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  blob: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.55,
  },
});
