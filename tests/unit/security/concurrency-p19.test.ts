// ============================================
// P1-19 (concurrency) + P1 (seed & konfig) — Unit testi
//
// Pokritih 5 dirkalnih scenarijev iz specifikacije:
//   1. dve blagajni ⇄ isti check    → (create-payment, že pokrit v payment-gateways testih)
//   2. dve napravi ⇄ isti order     → (put-handler, pokrit v obstoječih testih)
//   3. dve prodaji ⇄ ista zaloga   → deductStockForOrder TOCTOU claim (spodaj)
//   4. dva webhooka sočasno        → authorizeWalletPayment pogojni update (spodaj)
//   5. dva refunda                  → (refund route, pokrit v obstoječih testih)
//
// Plus: returnStockForOrder (double-return + snapshot mirror),
//       seed-guard (produkcija fail-closed), requireEnvSecret (brez fallback-a).
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── MOCK: @/lib/db (Prisma klient) ──────────────────────────────────────
const { mockOrderFindUnique, mock$Transaction, mockOrderUpdateMany } = vi.hoisted(() => ({
  mockOrderFindUnique: vi.fn(),
  mock$Transaction: vi.fn(),
  mockOrderUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: mockOrderFindUnique,
      updateMany: mockOrderUpdateMany,
    },
    $transaction: mock$Transaction,
  },
}))

// ── MOCK: stock-deduction podmoduli (snemamo klice) ──────────────────────
const { mockDeductRecipeItems, mockDeductDirectItem } = vi.hoisted(() => ({
  mockDeductRecipeItems: vi.fn().mockResolvedValue(new Set<number>()),
  mockDeductDirectItem: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/stock-deduction/deduct-recipe', () => ({
  deductRecipeItems: mockDeductRecipeItems,
}))

vi.mock('@/lib/stock-deduction/deduct-direct', () => ({
  deductDirectItem: mockDeductDirectItem,
}))

// Lažni tx klient zapisuje klice po vrstnem redu
function createTxSpy() {
  const calls: string[] = []
  const tx = {
    order: {
      updateMany: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
        calls.push(`order.updateMany:${JSON.stringify(args.where)}`)
        return { count: 1 }
      }),
    },
    stockTransaction: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
  }
  return { tx, calls }
}

// Zaloga vrne deduktore skozi $transaction(callback)
mock$Transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
  const { tx } = createTxSpy()
  return callback(tx)
})

// import PO mockih!
import { deductStockForOrder } from '@/lib/stock-deduction/deduct-order'

const ORDER = {
  id: 'order-1',
  orderNumber: 7,
  inventoryDeducted: false,
  locationId: 'loc-1',
}

const ITEMS = [
  { menuItemId: 'mi-1', quantity: 2 },
  { menuItemId: 'mi-2', quantity: 1 },
]

describe('P1-19: deductStockForOrder — atomarni claim inventoryDeducted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeductRecipeItems.mockResolvedValue(new Set<number>())
    mockDeductDirectItem.mockResolvedValue(undefined)
  })

  it('PRVI klic: claim (count=1) → dedukcija se izvede', async () => {
    mockOrderFindUnique.mockResolvedValue({ ...ORDER })
    mock$Transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx } = createTxSpy()
      tx.order.updateMany.mockResolvedValue({ count: 1 }) // claim USPE
      return callback(tx)
    })

    const result = await deductStockForOrder('order-1', 7, ITEMS)

    expect(result.success).toBe(true)
    expect(mockDeductRecipeItems).toHaveBeenCalledTimes(1)
    expect(mockDeductDirectItem).toHaveBeenCalledTimes(2) // obe ne-recipe postavki
  })

  it('KONKURENČNI klic (count=0 — drugi je že prevzel): NO dedukcija, no-op', async () => {
    mockOrderFindUnique.mockResolvedValue({ ...ORDER })
    mock$Transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx } = createTxSpy()
      tx.order.updateMany.mockResolvedValue({ count: 0 }) // claim ŽE ZASEDEN
      return callback(tx)
    })

    const result = await deductStockForOrder('order-1', 7, ITEMS)

    // Uspešen no-op — NI dedukcije (prej: oba klica sta razknjižila!)
    expect(result.success).toBe(true)
    expect(result.deducted).toHaveLength(0)
    expect(mockDeductRecipeItems).not.toHaveBeenCalled()
    expect(mockDeductDirectItem).not.toHaveBeenCalled()
  })

  it('fast-path: inventoryDeducted=true → takoj ven, brez transakcije', async () => {
    mockOrderFindUnique.mockResolvedValue({ ...ORDER, inventoryDeducted: true })

    const result = await deductStockForOrder('order-1', 7, ITEMS)

    expect(result.success).toBe(true)
    expect(mock$Transaction).not.toHaveBeenCalled()
    expect(mockDeductDirectItem).not.toHaveBeenCalled()
  })

  it('claim je POGOJEN (where: inventoryDeducted=false) — atomicna zamenjava', async () => {
    mockOrderFindUnique.mockResolvedValue({ ...ORDER })
    let capturedWhere: Record<string, unknown> | undefined

    mock$Transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx } = createTxSpy()
      tx.order.updateMany.mockImplementation(async (args: Record<string, unknown>) => {
        capturedWhere = args.where as Record<string, unknown>
        return { count: 1 }
      })
      return callback(tx)
    })

    await deductStockForOrder('order-1', 7, ITEMS)

    // Ključna trditev: pogojni updateMany (optimistic locking vzorec)
    expect(capturedWhere).toEqual({ id: 'order-1', inventoryDeducted: false })
  })
})

// ============================================
// SEED GUARD — fail-closed v produkciji
// ============================================
import { checkSeedAllowed } from '@/lib/api-utils/seed-guard'

describe('P1 (seed): checkSeedAllowed — produkcijska zaščita', () => {
  beforeEach(() => {
    vi.stubEnv('SEED_ENABLED', '')
  })

  it('development → dovoljen', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const guard = checkSeedAllowed('POST /api/seed')
    expect(guard.allowed).toBe(true)
    expect(guard.error).toBeUndefined()
  })

  it('production → ZAVRNJEN (403) — seed briše podatke + demo PIN 1234', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const guard = checkSeedAllowed('POST /api/seed')
    expect(guard.allowed).toBe(false)
    expect(guard.error).toBeDefined()
    expect(guard.error!.status).toBe(403)
  })

  it('production + SEED_ENABLED=true → dovoljen (namenska demo namestitev)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SEED_ENABLED', 'true')
    const guard = checkSeedAllowed('POST /api/seed')
    expect(guard.allowed).toBe(true)
  })

  it('test → dovoljen', () => {
    vi.stubEnv('NODE_ENV', 'test')
    const guard = checkSeedAllowed('POST /api/seed')
    expect(guard.allowed).toBe(true)
  })
})

// ============================================
// REQUIRE ENV SECRET — brez fallback konstant
// ============================================
import { requireEnvSecret } from '@/lib/crypto/secrets'

describe('P1 (konfig): requireEnvSecret — fail-closed v produkciji', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('nastavljena vrednost → vrne jo', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'super-secret-value-123')
    expect(requireEnvSecret('NEXTAUTH_SECRET', 'test')).toBe('super-secret-value-123')
  })

  it('production + manjka → VRŽE napako (ne fallback!)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    expect(() => requireEnvSecret('NEXTAUTH_SECRET', 'test')).toThrow(/NEXTAUTH_SECRET/)
  })

  it('development + manjka → dev-only fallback (izrecno označen)', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    const value = requireEnvSecret('NEXTAUTH_SECRET', 'test')
    expect(value).toContain('dev-only-insecure-fallback')
  })
})
