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
// ============================================
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],

    environment: 'node',

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
