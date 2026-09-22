// ============================================
// RestaurantOS — Vitest Integration Config
// ============================================
// Ločen config za integracijske teste (prava DB, brez mockov):
//   bunx vitest run tests/integration --config vitest.config.integration.ts
//   (ali: bun run test:integration)
//
// Razlike od vitest.config.ts (unit):
//   - include: SAMO tests/integration/** (glavni config jih izključuje)
//   - environment: node (PGlite/Prisma ne delujeta v jsdom)
//   - setup ohranjen (ENCRYPTION_KEY env + server-only stub alias)
//
// FIX R78: ekspliciten PGLITE_DATA_DIR za teste — Vitest (Vite) namreč samodejno
// naloži projektni .env (kjer dev strežnik lahko override-a dir, npr.
// PGLITE_DATA_DIR=.pglite-qa). Testi potem odprejo ISTI dir kot živi dev strežnik
// → PGlite concurrent open → WASM "Aborted()" crash vseh 9 testov. test.env ima
// prednost pred .env — testi so izolirani (dir: /tmp/pglite-data-it; shema:
// `PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs`).
// ============================================
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],

    environment: 'node',

    // FIX R78: glej komentar zgoraj — izolacija od dev strežnikovega PGlite dira
    env: {
      PGLITE_DATA_DIR: '/tmp/pglite-data-it',
    },

    globals: true,

    setupFiles: ['./tests/setup.ts'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' guard stub (enako kot unit config)
      'server-only': path.resolve(__dirname, './tests/mocks/server-only-stub.ts'),
    },
  },
})
