import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d17",
          soft: "#11142a",
          card: "#171a35",
          line: "#252a4d"
        },
        brand: {
          DEFAULT: "#7c5cff",
          400: "#9d8aff",
          500: "#7c5cff",
          600: "#5b3df0",
          700: "#4528c2"
        },
        accent: {
          pink: "#ff4d8d",
          cyan: "#22d3ee",
          lime: "#a3e635",
          orange: "#fb923c"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg,#9d8aff 0%, #7c5cff 50%, #5b3df0 100%)",
        "fun-gradient":
          "linear-gradient(120deg,#ff4d8d 0%,#7c5cff 40%,#22d3ee 80%)"
      },
      boxShadow: {
        card: "0 10px 30px -10px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(124,92,255,0.4), 0 20px 60px -20px rgba(124,92,255,0.6)"
      },
      animation: {
        "spin-slow": "spin 18s linear infinite",
        "float": "float 6s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
