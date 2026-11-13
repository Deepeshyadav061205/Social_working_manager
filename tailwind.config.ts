import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Design tokens are defined in app/globals.css and mapped here.
 * Components must use semantic Tailwind classes (bg-background, bg-surface-1,
 * text-foreground, text-yellow, text-blue, …) and never hardcode hex values.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        background: "rgb(var(--rgb-bg) / <alpha-value>)",
        "surface-1": "rgb(var(--rgb-surface-1) / <alpha-value>)",
        "surface-2": "rgb(var(--rgb-surface-2) / <alpha-value>)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        foreground: "rgb(var(--rgb-text) / <alpha-value>)",
        muted: "rgb(var(--rgb-muted) / <alpha-value>)",
        yellow: {
          DEFAULT: "rgb(var(--rgb-yellow) / <alpha-value>)",
          hover: "rgb(var(--rgb-yellow-hover) / <alpha-value>)",
          dim: "var(--yellow-dim)",
        },
        blue: {
          DEFAULT: "rgb(var(--rgb-blue) / <alpha-value>)",
          strong: "rgb(var(--rgb-blue-strong) / <alpha-value>)",
          dim: "var(--blue-dim)",
        },
        success: "rgb(var(--rgb-success) / <alpha-value>)",
        danger: "rgb(var(--rgb-danger) / <alpha-value>)",
        border: "var(--line)",
        input: "var(--line)",
        ring: "rgb(var(--rgb-blue) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        control: "10px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        "glow-yellow": "var(--glow-yellow)",
        "glow-blue": "var(--glow-blue)",
      },
      transitionDuration: { DEFAULT: "175ms" },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
