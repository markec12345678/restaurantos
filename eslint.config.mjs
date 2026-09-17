import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
    }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    // LINT RATCHET FIX (QA 2026-09-17): core "no-unused-vars" je OFF —
    // @typescript-eslint/no-unused-vars je strožja in pokrije isti problem.
    // Prej sta OBEMA reportala isto vrstico → DVOSTROJNO ŠTETJE (275 lažnih
    // warningov, skupna številka 1303 je bila mešana). En sam vir resnice:
    "no-unused-vars": "off",
    "no-console": "warn",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // Seed skripte — veliko spremenljivk je deklariranih za referenco
  files: ["src/app/api/seed*/**/*.ts"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
}, {
  // CLI skripte in orodja — console je pričakovan v teh datotekah
  // LINT RATCHET FIX (QA 2026-09-17): tudi tests/ chaos E2E skripte + korenski
  // seed-*.mjs so CLI-opravila (tečejo izven brskalnika, console = njihov I/O).
  // Prej niso bila izvzeta → 849 warningov iz tests/ je onesnaževalo budget.
  files: [
    "scripts/**/*.{js,mjs,ts}",
    "tests/**/*.{js,mjs,ts}",
    "daemon.js",
    "seed-*.mjs",
  ],
  rules: {
    "no-console": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
}, {
  // Logger sam po sebi uporablja console — to je njegova namena
  files: ["src/lib/logger.ts"],
  rules: {
    "no-console": "off",
  },
}, {
  // Service Worker ne more uvoziti modulov — console je edini način logiranja
  files: ["public/sw.js"],
  rules: {
    "no-console": "off",
  },
}, {
  ignores: [
    "node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts",
    "examples/**", "skills/**", "data/**", "server.js", "server-ws-core.js", "ecosystem.config.js",
    "scripts/*.cjs", // CommonJS scripts use require() — not part of Next.js app
    "public/sw.js", // Service Worker — separate execution context
  ]
}];

export default eslintConfig;
