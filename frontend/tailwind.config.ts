import type { Config } from "tailwindcss";

/**
 * Design tokens — locked for Session 008.
 *
 * Font sizes: 11 / 13 / 15 / 18 / 24 / 32 px — strict scale.
 * Spacing: Tailwind default 4px grid (1 = 4px).
 * Radius: 4px small, 6px standard, 12px cards.
 * Shadows: none (dark theme uses border for separation).
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontSize: {
      "2xs": ["0.6875rem", { lineHeight: "1rem" }],       // 11px
      xs: ["0.8125rem", { lineHeight: "1.125rem" }],      // 13px
      sm: ["0.9375rem", { lineHeight: "1.375rem" }],      // 15px
      base: ["1.125rem", { lineHeight: "1.625rem" }],     // 18px
      lg: ["1.5rem", { lineHeight: "2rem" }],             // 24px
      xl: ["2rem", { lineHeight: "2.5rem" }],             // 32px
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "0.75rem",   // 12px — cards
        md: "0.375rem",  // 6px — standard
        sm: "0.25rem",   // 4px — small elements
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      keyframes: {
        "border-pulse": {
          "0%, 100%": { borderColor: "hsl(240 3.7% 15.9%)" },  // zinc-800
          "50%": { borderColor: "hsl(240 5.3% 26.1%)" },        // zinc-700
        },
      },
      animation: {
        "border-pulse": "border-pulse 800ms ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
