import type { Config } from "tailwindcss";

/**
 * Design tokens.
 *
 * Two palettes coexist:
 * 1. Dark (CSS-variable-based) — powers /demo dashboard and shadcn/ui components.
 * 2. Warm-light (direct hex) — powers the homepage at /. Named tokens below.
 *
 * Font sizes: 11 / 13 / 15 / 18 / 24 / 32 / 48 / 64 px — strict scale.
 * Spacing: Tailwind default 4px grid (1 = 4px).
 * Radius: 4px small, 6px standard, 12px cards.
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
      "2xl": ["3rem", { lineHeight: "3.25rem" }],          // 48px — landing hero
      "3xl": ["4rem", { lineHeight: "4.25rem" }],          // 64px — landing hero large
    },
    extend: {
      colors: {
        /* ── Dark palette (CSS-variable-based, powers /demo + shadcn) ── */
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

        /* ── Warm-light palette (direct hex, powers homepage at /) ── */
        canvas: "#FAFAF7",
        surface: "#FFFFFF",
        hairline: "#E7E5DF",
        "text-primary": "#1A1D1A",
        "text-secondary": "#5C5F5A",
        "text-tertiary": "#8B8E89",
        "accent-forest": { DEFAULT: "#15803D", hover: "#166534" },
        "accent-amber": "#B45309",
        "accent-critical": "#991B1B",
        "hover-warm": "#F4F2EC",
        "highlight-mint": "#ECFDF5",
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
