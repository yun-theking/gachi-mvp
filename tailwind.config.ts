import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "#0f0e0c",
        surface: "#1a1815",
        surface2: "#231f1a",
        border: "#2e2922",
        gold: "#c9a96e",
        "gold-light": "#e8c98a",
        "gold-dim": "#7a6240",
        text: "#f0ead8",
        "text-dim": "#8a7f6e",
        "text-muted": "#4a4438",
        danger: "#e05252",
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Noto Sans KR'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
