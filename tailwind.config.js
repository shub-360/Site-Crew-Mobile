/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind uses its own content resolution
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // SiteCrew brand palette (matching web application)
        primary: {
          DEFAULT: "#1E3A5F",
          foreground: "#FFFFFF",
          50: "#E8EDF3",
          100: "#D1DBE7",
          200: "#A3B7CF",
          300: "#7593B7",
          400: "#476F9F",
          500: "#1E3A5F",
          600: "#182E4C",
          700: "#122339",
          800: "#0C1726",
          900: "#060C13",
        },
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
        },
        accent: {
          DEFAULT: "#F1F5F9",
          foreground: "#0F172A",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        success: "#16A34A",
        warning: "#F59E0B",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#1E3A5F",
      },
      fontFamily: {
        sans: ["Inter"],
        heading: ["Inter"],
      },
    },
  },
  plugins: [],
};
