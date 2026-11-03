import type { Config } from "tailwindcss";

/** Maps a CSS variable holding an "R G B" triplet to a colour that supports `/opacity` modifiers. */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        track: token("track"),
        line: token("line"),
        "line-soft": token("line-soft"),
        "line-strong": token("line-strong"),
        ink: token("ink"),
        "ink-2": token("ink-2"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        "accent-soft": token("accent-soft"),
        "on-accent": token("on-accent"),
        success: token("success"),
        "success-soft": token("success-soft"),
        warn: token("warn"),
        "warn-soft": token("warn-soft"),
        danger: token("danger"),
        "danger-soft": token("danger-soft"),
        info: token("info"),
        "info-soft": token("info-soft"),
        violet: token("violet"),
        "violet-soft": token("violet-soft"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(22 32 46 / 0.04)",
        pop: "0 12px 32px -8px rgb(22 32 46 / 0.18), 0 2px 6px rgb(22 32 46 / 0.06)",
        pill: "0 1px 2px rgb(22 32 46 / 0.12)",
      },
      ringColor: {
        DEFAULT: "rgb(var(--c-accent) / 0.45)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
