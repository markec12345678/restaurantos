// ============================================
// AMBIENTNE TIPOVNE DEKLARACIJE
// ============================================
// TypeScript 7 (nativni prevajalnik) preverja tudi side-effect uvoze
// (TS2882) — TS 5.x jih je tiho ignoriral. Ker Next.js omogoča uvoz
// CSS datotek brez deklaracij, jih tukaj ambientno deklariramo.

declare module '*.css'
declare module '*.scss'
