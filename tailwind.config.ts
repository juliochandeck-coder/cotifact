import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base neutra
        ink: "#000000",
        paper: "#FAFAFA",
        slate: "#6B7280",
        line: "#E2E2E2",
        borderStrong: "#6B7280",

        // Colores de marca por defecto (el usuario los cambia en Ajustes)
        brand: {
          primary: "#000000",
          secondary: "#666666",
        },

        // Paleta semantica: cada color comunica un tipo de accion
        primary: "#1D4ED8",
        primaryHover: "#1E3A8A",
        success: "#15803D",
        successBg: "#DCFCE7",
        successText: "#166534",
        danger: "#B91C1C",
        dangerBg: "#FEE2E2",
        dangerText: "#991B1B",
        warningBg: "#FEF3C7",
        warningText: "#92400E",

        // Alias retrocompatibles: componentes existentes que usaban estos
        // nombres siguen funcionando, apuntando ahora al color semantico correcto.
        brass: "#92400E",
        brick: "#B91C1C",
        forest: "#15803D",
      },
      fontFamily: {
        display: ["var(--font-body)"],
        title: ["var(--font-body)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
