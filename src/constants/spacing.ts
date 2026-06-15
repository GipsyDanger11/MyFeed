/**
 * 4-pt spacing scale used across the app
 */
import { Platform } from "react-native";

export const Spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const Radius = {
  none: 0,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 4,
  "2xl": 6,
  "3xl": 8,
  "4xl": 12,
  "5xl": 16,
  "6xl": 20,
  full: 4,
  /** Soft ambient blobs in the background — always circular. */
  blob: 9999,
} as const;

export const Shadow = {
  glow: Platform.select({
    web: { boxShadow: "0px 8px 24px rgba(139, 92, 246, 0.45)" },
    default: {
      shadowColor: "#8B5CF6",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 12,
    },
  }),
  card: Platform.select({
    web: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.25)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
  }),
} as const;
