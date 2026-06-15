/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./App.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand gradient stops
        brand: {
          pink: "#FF4FB6",
          purple: "#8B5CF6",
          violet: "#7C3AED",
          indigo: "#6366F1",
        },
        // Surface colors (glassmorphism)
        surface: {
          50: "#FFFFFF",
          100: "#F8F7FF",
          900: "#0B0820",
          950: "#070414",
        },
        // Status
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: "Spline Sans",
        body: "Inter",
      },
    },
  },
  plugins: [],
};
