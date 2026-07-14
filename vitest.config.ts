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
        // Začetne meje — dvigni, ko bo več testov
        statements: 40,
        branches: 30,
        functions: 35,
        lines: 40,
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
