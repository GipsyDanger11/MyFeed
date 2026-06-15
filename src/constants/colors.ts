/**
 * MyFeed color palette
 * Purple/pink vibrant gradient theme for glassmorphism UI
 */

export const Colors = {
  // Brand gradient stops
  pink: "#FF4FB6",
  pinkSoft: "#FF89C7",
  purple: "#8B5CF6",
  purpleSoft: "#A78BFA",
  violet: "#7C3AED",
  indigo: "#6366F1",
  blue: "#3B82F6",

  // Surfaces
  background: "#0B0820",
  backgroundDeep: "#070414",
  surface: "rgba(255, 255, 255, 0.06)",
  surfaceStrong: "rgba(255, 255, 255, 0.10)",
  border: "rgba(255, 255, 255, 0.12)",
  borderStrong: "rgba(255, 255, 255, 0.20)",

  // Text
  text: "#FFFFFF",
  textMuted: "rgba(255, 255, 255, 0.65)",
  textSubtle: "rgba(255, 255, 255, 0.45)",

  // Status
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",

  // Boost / Reduce (chips)
  boost: "#22C55E",
  boostBg: "rgba(34, 197, 94, 0.15)",
  reduce: "#EF4444",
  reduceBg: "rgba(239, 68, 68, 0.15)",
} as const;

/**
 * Reusable gradient definitions for LinearGradient
 * Each gradient goes from one color to another (top → bottom by default)
 */
export const Gradients = {
  primary: [Colors.pink, Colors.purple, Colors.violet] as const,
  primarySoft: [Colors.pinkSoft, Colors.purpleSoft] as const,
  background: [Colors.backgroundDeep, Colors.background] as const,
  hero: [Colors.purple, Colors.pink] as const,
  success: [Colors.success, "#0EA5E9"] as const,
  // Background ambient blobs
  blob1: ["rgba(255, 79, 182, 0.35)", "rgba(255, 79, 182, 0)"] as const,
  blob2: ["rgba(124, 58, 237, 0.35)", "rgba(124, 58, 237, 0)"] as const,
  blob3: ["rgba(99, 102, 241, 0.30)", "rgba(99, 102, 241, 0)"] as const,
} as const;
