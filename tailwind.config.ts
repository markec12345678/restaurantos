import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// NOTE: Tailwind v4 uporablja CSS-first konfiguracijo (glej src/app/globals.css @theme inline blok).
// Ta datoteka je ohranjena samo za:
//   1. Registracijo tailwindcss-animate plugin-a (Tailwind v4 je še ne podpira nativno)
//   2. darkMode: "class" — čeprav next-themes to already nastavi
//
// Color tokens, border-radius, itd. so definirani v globals.css z OKLCH (ne HSL).
// Tu ne nastavljamo barv — to bi povzročilo navidezni konflikt z @theme inline.
const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Theme izpusten — Tailwind v4 bere iz @theme inline v globals.css (OKLCH)
  plugins: [tailwindcssAnimate],
};

export default config;
