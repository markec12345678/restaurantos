// ============================================
// RestaurantOS — Test Setup
// Teče PRED vsakim testom
// ============================================
import { vi, afterAll } from 'vitest'
import { TextEncoder, TextDecoder } from 'util'

// Next.js server components pričakujejo TextEncoder/TextDecoder
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TextEncoder = TextEncoder as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TextDecoder = TextDecoder as any
}

// ── Mock Prisma Client ───────────────────────────
// Vsi testi dobijo mock-iran db client. Za vsak test se resetira.
const mockDb = {
  // Generični mock helper — klici lahko overrideajo v posameznem testu
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: vi.fn(async (fn: any) => fn(mockDb)),
  $disconnect: vi.fn(),
}

// Avtomatsko mock-iraj @/lib/db (Prisma client + helpers)
vi.mock('@/lib/db', () => ({
  db: new Proxy(mockDb, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(target: any, prop: string) {
      if (prop in target) return target[prop as keyof typeof target]
      // Za vsako tabelo vrni mock objekt s prisma methodami
      return {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      }
    },
  }),
  // Mock tudi ostale export-e iz @/lib/db (ki jih aplikacija uporablja)
  enableWalMode: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// ── Mock next/headers (cookies, headers) ─────────
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Headers()),
}))

// ── Mock next/navigation ─────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}))

// ── Čiščenje po vsakem testu ─────────────────────
afterAll(() => {
  vi.restoreAllMocks()
})
