// tailwind.config.ts
import type { Config } from "tailwindcss";

export const TailwindConfig: Config = {
  darkMode: ["class", '[data-mode="dark"]'],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,css}", // Your app files
    "./.storybook/**/*.{js,ts,jsx,tsx}", // ← Storybook stories
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
};

// export TailwindConfig;
