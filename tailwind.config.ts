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
        bg: "#FBF3E4",
        surface: "#F7E9CE",
        surface2: "#EDE1C8",
        border: "#E7D5AE",
        accent: "#A8632E",
        "accent-light": "#C98A4E",
        "accent-dark": "#7A481F",
        text: "#2C2015",
        "text-dim": "#8A7355",
        "text-muted": "#B8A582",
        danger: "#B8452F",
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "'Noto Serif JP'", "serif"],
        sans: ["'Noto Sans KR'", "'Noto Sans JP'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
