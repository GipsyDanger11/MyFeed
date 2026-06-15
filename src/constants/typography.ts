/**
 * Typography scale for the app
 */
export const Typography = {
  display: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800" as const,
    letterSpacing: -1,
  },
  h1: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  bodyBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    fontFamily: "monospace",
  },
} as const;
