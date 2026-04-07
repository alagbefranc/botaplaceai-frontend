import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bota: {
          teal: "#17DEBC",
          hover: "#13C4A5",
          dark: "#151515",
          bg: "#FFFDF5",
          border: "#E8E6DB",
          gray: "#5A5A5A",
          light: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "sans-serif"],
        heading: ['"Space Grotesk"', "sans-serif"],
      },
      fontSize: {
        body: "18px",
        h2: ["48px", "1.1"],
        h1: ["64px", "1.05"],
      },
      borderRadius: {
        md: "8px",
        sm: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
