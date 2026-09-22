// ============================================
// P0-C4 PER-LOCATION LOYALTY CONFIG — Unit testi
//
// Preverjamo:
// - resolveLoyaltyConfig: Location override (loyaltyEnabled=true) → lokacijske vrednosti
// - resolveLoyaltyConfig: Location.loyaltyEnabled=false → global fallback (backward compat)
// - resolveLoyaltyConfig: brez locationId → global (single-tenant)
// - resolveLoyaltyConfig: location lookup odpade → global fallback (odpornost na drift)
// - handleLoyaltyEarn: točke po lokacijskem pointsPerEuro
// - handleLoyaltyEarn: global fallback ko lokacija ni vkloplila programa
// - handleLoyaltyEarn: izklopljen povsod → brez pridobivanja
// - handleLoyaltyPointsDeduction: fraud-check uporablja lokacijski pointsValue
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

import {
  resolveLoyaltyConfig,
  handleLoyaltyEarn,
  handleLoyaltyPointsDeduction,
} from '@/app/api/payments/_helpers/loyalty'
import type { PaymentInput } from '@/app/api/payments/_helpers/types'

// Suppress logger.warn v testih (resilience scenarij logira)
vi.spyOn(console, 'warn').mockImplementation(() => {})

// ─── Mock transakcijski klient (helperji prejmejo tx kot parameter) ───
const mockSettingsFindFirst = vi.fn()
const mockLocationFindUnique = vi.fn()
const mockLoyaltyAccountFindUnique = vi.fn()
const mockLoyaltyAccountUpdateMany = vi.fn()
const mockLoyaltyTransactionCreate = vi.fn()

const tx = {
  restaurantSettings: { findFirst: mockSettingsFindFirst },
  location: { findUnique: mockLocationFindUnique },
  loyaltyAccount: {
    findUnique: mockLoyaltyAccountFindUnique,
    updateMany: mockLoyaltyAccountUpdateMany,
  },
  loyaltyTransaction: { create: mockLoyaltyTransactionCreate },
} as unknown as Prisma.TransactionClient

const GLOBAL_ON = {
  loyaltyEnabled: true,
  loyaltyPointsPerEuro: 3,
  loyaltyPointsValue: 0.02,
}
const GLOBAL_OFF = {
  loyaltyEnabled: false,
  loyaltyPointsPerEuro: 1,
  loyaltyPointsValue: 0.01,
}

const basePayment = (overrides: Partial<PaymentInput>): PaymentInput => ({
  checkId: 'check-1',
  amount: 10,
  tipAmount: 0,
  type: 'card',
  alternatePaymentTypeId: null,
  cardType: null,
  cardLast4: null,
  authorizationCode: null,
  giftCardId: null,
  loyaltyAccountId: 'la-1',
  loyaltyPointsUsed: 0,
  employeeId: null,
  idempotencyKey: null,
  locationId: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockLoyaltyAccountUpdateMany.mockResolvedValue({ count: 1 })
  mockLoyaltyTransactionCreate.mockResolvedValue({})
})

// ─── resolveLoyaltyConfig ────────────────────────────────────

describe('resolveLoyaltyConfig — P0-C4 veriga (Location → RestaurantSettings)', () => {
  it('lokacija z vklopljenim programom prevzame konfiguracijo', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_OFF)
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyPointsPerEuro: 2,
      loyaltyPointsValue: 0.05,
    })

    const config = await resolveLoyaltyConfig(tx, 'loc-1')

    expect(config).toEqual({
      enabled: true,
      pointsPerEuro: 2,
      pointsValue: 0.05,
      source: 'location',
    })
    expect(mockLocationFindUnique).toHaveBeenCalledWith({
      where: { id: 'loc-1' },
      select: {
        loyaltyEnabled: true,
        loyaltyPointsPerEuro: true,
        loyaltyPointsValue: true,
      },
    })
  })

  it('lokacija BREZ programa (default false) → global fallback (backward compat)', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_ON)
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: false,
      loyaltyPointsPerEuro: 1,
      loyaltyPointsValue: 0.01,
    })

    const config = await resolveLoyaltyConfig(tx, 'loc-1')

    expect(config).toEqual({
      enabled: true,
      pointsPerEuro: 3,
      pointsValue: 0.02,
      source: 'global',
    })
  })

  it('brez locationId → global (single-tenant)', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_ON)

    const config = await resolveLoyaltyConfig(tx, null)

    expect(config).toEqual({
      enabled: true,
      pointsPerEuro: 3,
      pointsValue: 0.02,
      source: 'global',
    })
    expect(mockLocationFindUnique).not.toHaveBeenCalled()
  })

  it('location lookup odpade (shema-drift) → global fallback, brez meta', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_ON)
    mockLocationFindUnique.mockRejectedValue(new Error('Unknown column "loyaltyEnabled"'))

    const config = await resolveLoyaltyConfig(tx, 'loc-1')

    expect(config).toEqual({
      enabled: true,
      pointsPerEuro: 3,
      pointsValue: 0.02,
      source: 'global',
    })
  })

  it('neveljavne lokacijske vrednosti (0) → global vrednosti', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_ON)
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyPointsPerEuro: 0,
      loyaltyPointsValue: 0,
    })

    const config = await resolveLoyaltyConfig(tx, 'loc-1')

    expect(config.pointsPerEuro).toBe(3)
    expect(config.pointsValue).toBe(0.02)
    expect(config.source).toBe('location')
  })
})

// ─── handleLoyaltyEarn — pridobivanje točk ───────────────────

describe('handleLoyaltyEarn — per-location pridobivanje točk', () => {
  it('lokacijski program: točke po lokacijskem pointsPerEuro', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_OFF) // global IZKLOPLJEN
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyPointsPerEuro: 2,
      loyaltyPointsValue: 0.01,
    })

    // 10 EUR × 2 točki/EUR = 20 točk
    await handleLoyaltyEarn(tx, basePayment({ amount: 10, locationId: 'loc-1' }), 'order-1')

    expect(mockLoyaltyAccountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'la-1', isActive: true },
      data: { pointsBalance: { increment: 20 }, lifetimePoints: { increment: 20 } },
    })
    expect(mockLoyaltyTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'earn', points: 20 }),
      }),
    )
  })

  it('global fallback: lokacija brez programa uporabi globalne nastavitve', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_ON) // global VKLOPLJEN, 3 točke/EUR
    mockLocationFindUnique.mockResolvedValue({ loyaltyEnabled: false })

    // 10 EUR × 3 točke/EUR = 30 točk
    await handleLoyaltyEarn(tx, basePayment({ amount: 10, locationId: 'loc-1' }), 'order-1')

    expect(mockLoyaltyAccountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'la-1', isActive: true },
      data: { pointsBalance: { increment: 30 }, lifetimePoints: { increment: 30 } },
    })
  })

  it('izklopljen povsod (global off + lokacija off) → brez pridobivanja', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_OFF)
    mockLocationFindUnique.mockResolvedValue({ loyaltyEnabled: false })

    await handleLoyaltyEarn(tx, basePayment({ amount: 10, locationId: 'loc-1' }), 'order-1')

    expect(mockLoyaltyAccountUpdateMany).not.toHaveBeenCalled()
    expect(mockLoyaltyTransactionCreate).not.toHaveBeenCalled()
  })

  it('napitnina se odšteje od osnove za točke', async () => {
    mockSettingsFindFirst.mockResolvedValue({ ...GLOBAL_ON, loyaltyPointsPerEuro: 1 })
    mockLocationFindUnique.mockResolvedValue({ loyaltyEnabled: false })

    // (10 EUR − 2.50 napitnina) × 1 = 7 točk (floor)
    await handleLoyaltyEarn(
      tx,
      basePayment({ amount: 10, tipAmount: 2.5, locationId: null }),
      'order-1',
    )

    expect(mockLoyaltyAccountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'la-1', isActive: true },
      data: { pointsBalance: { increment: 7 }, lifetimePoints: { increment: 7 } },
    })
  })
})

// ─── handleLoyaltyPointsDeduction — fraud-check z lokacijskim pointsValue ──

describe('handleLoyaltyPointsDeduction — per-location pointsValue', () => {
  const deductionPayment = (overrides: Partial<PaymentInput>) =>
    basePayment({
      type: 'loyalty',
      loyaltyPointsUsed: 100,
      ...overrides,
    })

  it('fraud-check uporablja LOKACIJSKI pointsValue (0.10 → 100 točk = 10 EUR max)', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_OFF) // global 0.01
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyPointsPerEuro: 1,
      loyaltyPointsValue: 0.1,
    })
    mockLoyaltyAccountFindUnique.mockResolvedValue({ isActive: true, pointsBalance: 500 })

    // 15 EUR > 100 × 0.10 = 10 EUR → zavrnjeno
    await expect(
      handleLoyaltyPointsDeduction(
        tx,
        deductionPayment({ amount: 15, locationId: 'loc-1' }),
        'order-1',
      ),
    ).rejects.toThrow('presega vrednost točk')

    expect(mockLoyaltyAccountUpdateMany).not.toHaveBeenCalled()
  })

  it('veljavno unovčenje pod lokacijskim limitom uspe', async () => {
    mockSettingsFindFirst.mockResolvedValue(GLOBAL_OFF)
    mockLocationFindUnique.mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyPointsPerEuro: 1,
      loyaltyPointsValue: 0.1,
    })
    mockLoyaltyAccountFindUnique.mockResolvedValue({ isActive: true, pointsBalance: 500 })

    // 10 EUR ≤ 100 × 0.10 = 10 EUR → OK
    await handleLoyaltyPointsDeduction(
      tx,
      deductionPayment({ amount: 10, locationId: 'loc-1' }),
      'order-1',
    )

    expect(mockLoyaltyAccountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'la-1', pointsBalance: { gte: 100 } },
      data: { pointsBalance: { decrement: 100 } },
    })
    expect(mockLoyaltyTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'redeem', points: -100 }),
      }),
    )
  })

  it('brez locationId uporablja global pointsValue (0.01)', async () => {
    mockSettingsFindFirst.mockResolvedValue({ ...GLOBAL_OFF, loyaltyPointsValue: 0.01 })
    mockLoyaltyAccountFindUnique.mockResolvedValue({ isActive: true, pointsBalance: 500 })

    // 2 EUR > 100 × 0.01 = 1 EUR → zavrnjeno
    await expect(
      handleLoyaltyPointsDeduction(tx, deductionPayment({ amount: 2, locationId: null }), 'order-1'),
    ).rejects.toThrow('presega vrednost točk')
  })
})
