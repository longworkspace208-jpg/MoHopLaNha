import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 3 màu nhận diện chính: Deep Forest Green, Warm Ivory, Coral Orange + trung tính
        forest: {
          DEFAULT: "#173F32",
          dark: "#0E2920",
        },
        ivory: "#F5F0E6",
        coral: {
          DEFAULT: "#F26A38",
          hover: "#D95322",
        },
        ink: "#12211B",
        muted: "#4A5651",
        rule: "#DDD5C6",
        // Legacy aliases preserved for admin routes
        brand: {
          50: "#EEF4F1",
          100: "#D5E3DC",
          500: "#205947",
          600: "#173F32",
          700: "#13352A",
          800: "#0E2920",
          950: "#091B15",
        },
        cream: "#F5F0E6",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "6px",
      },
      boxShadow: {
        soft: "0 2px 10px rgba(23, 63, 50, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
