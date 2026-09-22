// ============================================
// RestaurantOS — Vitest Configuration
// Unit + integration testing
// ============================================
import { defineConfig } from 'vitest/config'
import path from 'path'

// Task 23: dva projekta zaradi POOLA:
//   - 'unit-vm'  → pool 'vmThreads': jsdom se ustvari ENKRAT na worker
//     (prej: 82× kreacije = 50s od 71s testa → sedaj ~10s). Per-file izolacija
//     ostane (svež VM context na datoteko).
//   - 'unit-globals' → pool 'forks': datoteke, ki delajo vi.stubGlobal na
//     window/navigator (webauthn, register-sw-override) — v vmThreads je
//     jsdom 'window' non-configurable ("Cannot redefine property: window"),
//     zato tečejo v klasičnem forks poolu.
//
// Skupne opcije živijo na root test nivoju (projects jih podedujejo),
// project-specifične (include/exclude/pool) so v vsakem projektu.
const GLOBAL_STUB_FILES = [
  'tests/unit/auth/webauthn.test.ts',
  'tests/unit/lib/register-sw-override.test.ts',
]

export default defineConfig({
  test: {
    // Environment — jsdom za React komponente, node za utilityje
    environment: 'jsdom',

    // FIX runda 9: DATABASE_URL za teste — @/lib/db (ko ga testi naložijo prek
    // importOriginal) NE sme inicializirati PGlite v jsdom okolju (PGlite zahteva
    // file:// URL pod Node fs → ERR_INVALID_URL_SCHEME unhandled rejections).
    // Z postgres:// URL db.ts vzame zunanji-Postgres branch; PrismaClient je
    // v testih vedno mock-an, tako da ni nobenega resničnega omrežnega klica.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
      // R99-a: WEBAUTHN_ENABLED je v unit okolju privzeto 'true', da je kill
      // switch gate (isWebAuthnEnable, R99-a dodan na device attestation rutah)
      // zaprt samo v testih, ki ga IZRECNO stubajo (vi.stubEnv → 503 matrika v
      // r99-webauthn-gate.test.ts). Brez tega bi R97 endpoint testi (ki gate-a
      // ne mockajo/stubajo — testirajo R97 plasti POD gate-om) padli na 503.
      // tests/unit/auth/webauthn.test.ts upravlja env per-test (setEnv), torej
      // ni prizadet; r81-final-sweep mocka '@/lib/webauthn' barrel, prav tako ne.
      WEBAUTHN_ENABLED: 'true',
    },

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

    projects: [
      {
        test: {
          name: 'unit-vm',
          include: [
            'tests/**/*.test.ts',
            'tests/**/*.test.tsx',
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
          ],
          exclude: [
            'node_modules',
            '.next',
            'tests/e2e/**',
            'tests/integration/**',
            ...GLOBAL_STUB_FILES,
          ],
          pool: 'vmThreads',
        },
      },
      {
        test: {
          name: 'unit-globals',
          include: GLOBAL_STUB_FILES,
          exclude: ['node_modules', '.next', 'tests/e2e/**', 'tests/integration/**'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          pool: 'forks',
        },
      },
    ],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // P1-deps: 'server-only' guard (glej src/lib/db.ts) vrže error izven
      // react-server condicije — v testih uporabimo prazen stub.
      'server-only': path.resolve(__dirname, './tests/mocks/server-only-stub.ts'),
    },
  },
})
