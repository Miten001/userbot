import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#050813",
          soft: "#0b1024",
          deep: "#02030a",
          card: "#0e1430",
        },
        gold: {
          DEFAULT: "#fbbf24",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          glow: "#fde68a",
        },
        royal: {
          DEFAULT: "#8b5cf6",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        emerald2: {
          DEFAULT: "#10b981",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        rose2: {
          DEFAULT: "#f43f5e",
          400: "#fb7185",
          500: "#f43f5e",
        },
        // Legacy tokens (kept for backwards compat with components)
        accent: {
          DEFAULT: "#fbbf24",
          green: "#10b981",
          violet: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient":
          "linear-gradient(135deg, #fde68a 0%, #fbbf24 35%, #f59e0b 65%, #d97706 100%)",
        "royal-gradient":
          "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%)",
        "lux-gradient":
          "linear-gradient(120deg, #fbbf24 0%, #f43f5e 35%, #8b5cf6 70%, #10b981 100%)",
        "noise":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>\")",
      },
      boxShadow: {
        gold: "0 12px 40px -10px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.5)",
        royal: "0 12px 40px -10px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
        emerald: "0 12px 40px -10px rgba(16,185,129,0.55)",
        glass: "0 30px 80px -20px rgba(0,0,0,0.6)",
      },
      animation: {
        "marquee": "marquee 40s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glowPulse 4s ease-in-out infinite",
        "shine": "shine 3s linear infinite",
        "aurora": "aurora 24s ease infinite",
        "spin-slow": "spin 28s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
        shine: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        aurora: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
