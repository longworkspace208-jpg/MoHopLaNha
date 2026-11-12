import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { brand: { 50: "#effbf4", 100: "#d9f4e4", 500: "#25844d", 600: "#176b3b", 700: "#115331", 950: "#092c1b" }, cream: "#fbfaf5", ink: "#20342b" },
      fontFamily: { sans: ["var(--font-be-vietnam-pro)", "Arial", "sans-serif"] },
      borderRadius: { card: "1.5rem" },
      boxShadow: { soft: "0 10px 30px rgba(9, 44, 27, .08)" }
    }
  },
  plugins: []
} satisfies Config;
