// ============================================
// RestaurantOS — Playwright E2E Configuration
// Testira ključne poteze v realnem browser-ju
// ============================================
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // POS testi so sekvenčni (delijo bazo)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // En worker — POS ima stanje (košarica, računi)
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // ── Setup: seed testne baze ──────────────────
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // ── Chromium (desktop POS) ───────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // ── Mobile (QR menu, guest flow) ─────────────
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],

  // ── Avtomatski zagon dev strežnika ─────────────
  // P1-deps: Bun je edini package manager — prej je tukaj bil `npm run dev`
  // (inconsistent z Bun-only politiko). P1-testiranje (točka 2): pred zagonom
  // inicializiramo PGlite bazo s seed podatki (idempotentno — ON CONFLICT DO
  // NOTHING), da E2E teče tudi na svežem okolju brez ročnega `db:init-pglite`.
  // FIX: timeout 180s za bolj zanesljiv zagon (init + prvi next dev compile)
  webServer: process.env.CI
    ? undefined  // V CI uporabljamo standalone server (ne webServer)
    : {
        command: 'node scripts/init-e2e-db.mjs && bun run dev',
        url: `${BASE_URL}/api/health`,  // FIX: Health endpoint namesto root
        reuseExistingServer: true,
        timeout: 240_000,  // ⬆️ init-e2e-db + next dev prvi compile (4 minute)
        env: {
          DATABASE_URL: '',
          PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-e2e-data',
          FURS_ENV: 'test',
          FURS_ALLOW_SIMULATION: 'true',
          NEXTAUTH_SECRET: 'e2e-test-secret-only',
          WS_BROADCAST_SECRET: 'e2e-test-secret-only',
          // P1-testiranje: E2E niz nareda ~80+ API klicev/min — dvignemo
          // splošno rate limit mejo (produkcija obdrži privzetih 60/min)
          API_RATE_LIMIT_MAX: '600',
        },
      },
})
