import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Nati-style palette
        cream: "#FAF3E4",
        creamdark: "#F2E6CC",
        paper: "#FFFDF6",
        chili: "#B4371E",
        chilidark: "#8F2A15",
        turmeric: "#E9A319",
        turmerick: "#C07F08",
        greenburn: "#24403A", // deep green-black for text
        ink: "#2B2A24",
        soft: "#6B6250", // muted warm grey
        line: "#D9CDB2", // fine borders
        ok: "#3E7A4E",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(43,42,36,0.06), 0 8px 24px -12px rgba(43,42,36,0.18)",
        lift: "0 2px 6px rgba(43,42,36,0.10), 0 18px 40px -18px rgba(43,42,36,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;