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
        // Gachi palette, taken from the logo: ink black and its orange swoosh,
        // on a clean paper white (the app is a book being written). Every
        // text colour clears WCAG AA (4.5:1) on bg, surface and surface2;
        // accent-light (the logo orange) is for graphics only, at >= 3:1.
        bg: "#FBFAF7", // paper
        surface: "#FFFFFF", // cards / pages
        surface2: "#F2EFE9", // quiet fills
        border: "#E2DDD3",
        accent: "#AA4A08", // buttons, links (white text on it: 5.5:1)
        "accent-light": "#D9680F", // logo orange: progress, arcs
        "accent-dark": "#8A3C06", // emphasised text, banners
        text: "#1F1C18", // ink
        "text-dim": "#57524B",
        "text-muted": "#6B655C",
        danger: "#B42318",
      },
      // Font order depends on the page language — see globals.css.
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
};

export default config;
