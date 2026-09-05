// ============================================
// RestaurantOS — Vitest Configuration
// Unit + integration testing
// ============================================
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Testni fajli so v mapi tests/ in .test.ts ob vsaki komponenti
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],

    // Environment — jsdom za React komponente, node za utilityje
    environment: 'jsdom',

    // Suppress unhandled errors from PGlite connection attempts in unit tests
    // (PGlite tries to connect when @/lib/db is imported, but unit tests use mocks)
    dangerouslyIgnoreUnhandledErrors: true,

    globals: true,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.d.ts',
        'src/**/_helpers/**',
        'src/**/index.ts',
      ],
      thresholds: {
        // Dvignjeno v PR #7 (prej 40/30/35/40, sedaj 55/45/50/55)
        // Cilj: po PR #8+ dvigni na 70/60/65/70
        statements: 55,
        branches: 45,
        functions: 50,
        lines: 55,
      },
    },

    // Setup
    setupFiles: ['./tests/setup.ts'],

    // Mock-iraj Prisma client v testih (glej tests/setup.ts)
    server: {
      deps: {
        inline: [/@prisma\/client/],
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
