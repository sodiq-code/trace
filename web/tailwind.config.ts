import type { Config } from "tailwindcss";

// Tailwind v4 is configured via CSS (@import "tailwindcss" in globals.css with
// @theme inline). This JS config is kept minimal for editor tooling only.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
