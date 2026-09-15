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
        // Darkened from the original design for elderly-friendly contrast:
        // both now clear WCAG AA (4.5:1) against bg/surface/surface2, where
        // the originals (#8A7355 / #B8A582) fell to ~4.1:1 and ~2.2:1.
        "text-dim": "#6B5636",
        "text-muted": "#75603C",
        danger: "#9C3B27",
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
