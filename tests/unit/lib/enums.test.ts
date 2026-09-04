// ============================================
// ENUMS — Unit testi (Issue #41)
//
// Preverjamo:
// - const objects vsebujejo pravilne vrednosti
// - type-guards pravilno prepoznajo veljavne/neveljavne vrednosti
// - ORDER_STATUS_LABELS ima vse statuse
// - enumValues helper
// - getEnumStats vrne pričakovan format
// ============================================

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_STATUS,
  PAYMENT_RESULT_STATUS,
  SHIFT_STATUS,
  STAFF_SHIFT_STATUS,
  SHIFT_TYPE,
  AP_AR_STATUS,
  JOURNAL_ENTRY_STATUS,
  ACCOUNT_TYPE,
  LOCATION_TYPE,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  FURS_ENVIRONMENT,
  ORDER_STATUS_LABELS,
  isOrderStatus,
  isOrderType,
  isPaymentStatus,
  isPaymentResultStatus,
  isShiftStatus,
  isStaffShiftStatus,
  isShiftType,
  isApArStatus,
  isJournalEntryStatus,
  isAccountType,
  isLocationType,
  isSubscriptionPlan,
  isSubscriptionStatus,
  isFursEnvironment,
  enumValues,
  getEnumStats,
} from '@/lib/enums'

describe('Issue #41 — Enum const objects', () => {
  it('ORDER_STATUS vsebuje 6 vrednosti', () => {
    expect(Object.keys(ORDER_STATUS)).toHaveLength(6)
    expect(ORDER_STATUS.PENDING).toBe('pending')
    expect(ORDER_STATUS.CANCELLED).toBe('cancelled')
  })

  it('ORDER_TYPE vsebuje 3 vrednosti (dine-in/takeout/delivery)', () => {
    expect(Object.keys(ORDER_TYPE)).toHaveLength(3)
    expect(ORDER_TYPE.DINE_IN).toBe('dine-in')
  })

  it('PAYMENT_STATUS vsebuje 3 vrednosti', () => {
    expect(Object.keys(PAYMENT_STATUS)).toHaveLength(3)
  })

  it('PAYMENT_RESULT_STATUS vsebuje 3 vrednosti', () => {
    expect(Object.keys(PAYMENT_RESULT_STATUS)).toHaveLength(3)
    expect(PAYMENT_RESULT_STATUS.COMPLETED).toBe('completed')
    expect(PAYMENT_RESULT_STATUS.REFUNDED).toBe('refunded')
    expect(PAYMENT_RESULT_STATUS.VOIDED).toBe('voided')
  })

  it('SHIFT_STATUS vsebuje 4 vrednosti', () => {
    expect(Object.keys(SHIFT_STATUS)).toHaveLength(4)
  })

  it('STAFF_SHIFT_STATUS vsebuje 6 vrednosti (extended)', () => {
    expect(Object.keys(STAFF_SHIFT_STATUS)).toHaveLength(6)
    expect(STAFF_SHIFT_STATUS.NO_SHOW).toBe('no_show')
  })

  it('SHIFT_TYPE vsebuje 6 vrednosti', () => {
    expect(Object.keys(SHIFT_TYPE)).toHaveLength(6)
    expect(SHIFT_TYPE.MORNING).toBe('morning')
  })

  it('AP_AR_STATUS vsebuje 5 vrednosti', () => {
    expect(Object.keys(AP_AR_STATUS)).toHaveLength(5)
  })

  it('JOURNAL_ENTRY_STATUS vsebuje 3 vrednosti', () => {
    expect(Object.keys(JOURNAL_ENTRY_STATUS)).toHaveLength(3)
  })

  it('ACCOUNT_TYPE vsebuje 5 vrednosti', () => {
    expect(Object.keys(ACCOUNT_TYPE)).toHaveLength(5)
    expect(ACCOUNT_TYPE.ASSET).toBe('asset')
    expect(ACCOUNT_TYPE.LIABILITY).toBe('liability')
  })

  it('LOCATION_TYPE vsebuje 5 vrednosti', () => {
    expect(Object.keys(LOCATION_TYPE)).toHaveLength(5)
    expect(LOCATION_TYPE.RESTAURANT).toBe('restaurant')
  })

  it('SUBSCRIPTION_PLAN vsebuje 3 pakete', () => {
    expect(Object.keys(SUBSCRIPTION_PLAN)).toHaveLength(3)
    expect(SUBSCRIPTION_PLAN.STARTER).toBe('starter')
    expect(SUBSCRIPTION_PLAN.ENTERPRISE).toBe('enterprise')
  })

  it('SUBSCRIPTION_STATUS vsebuje 5 statusov', () => {
    expect(Object.keys(SUBSCRIPTION_STATUS)).toHaveLength(5)
  })

  it('FURS_ENVIRONMENT vsebuje 2 okolji', () => {
    expect(Object.keys(FURS_ENVIRONMENT)).toHaveLength(2)
    expect(FURS_ENVIRONMENT.TEST).toBe('test')
    expect(FURS_ENVIRONMENT.PRODUCTION).toBe('production')
  })
})

describe('Issue #41 — Type-guards', () => {
  it('isOrderStatus prepozna veljavne statuse', () => {
    expect(isOrderStatus('pending')).toBe(true)
    expect(isOrderStatus('completed')).toBe(true)
    expect(isOrderStatus('cancelled')).toBe(true)
  })

  it('isOrderStatus zavrne neveljavne statuse (catch typo-je)', () => {
    expect(isOrderStatus('pendig')).toBe(false) // typo
    expect(isOrderStatus('complted')).toBe(false) // typo
    expect(isOrderStatus('')).toBe(false)
    expect(isOrderStatus('PENDING')).toBe(false) // case-sensitive
  })

  it('isOrderType prepozna dine-in/takeout/delivery', () => {
    expect(isOrderType('dine-in')).toBe(true)
    expect(isOrderType('takeout')).toBe(true)
    expect(isOrderType('delivery')).toBe(true)
    expect(isOrderType('dine_in')).toBe(false) // underscore instead of dash
  })

  it('isPaymentStatus prepozna unpaid/partial/paid', () => {
    expect(isPaymentStatus('unpaid')).toBe(true)
    expect(isPaymentStatus('partial')).toBe(true)
    expect(isPaymentStatus('paid')).toBe(true)
    expect(isPaymentStatus('PAID')).toBe(false)
  })

  it('isPaymentResultStatus prepozna completed/refunded/voided', () => {
    expect(isPaymentResultStatus('completed')).toBe(true)
    expect(isPaymentResultStatus('refunded')).toBe(true)
    expect(isPaymentResultStatus('voided')).toBe(true)
    expect(isPaymentResultStatus('pending')).toBe(false)
  })

  it('isShiftStatus prepozna 4 statuse', () => {
    expect(isShiftStatus('scheduled')).toBe(true)
    expect(isShiftStatus('in_progress')).toBe(true)
    expect(isShiftStatus('completed')).toBe(true)
    expect(isShiftStatus('absent')).toBe(true)
    expect(isShiftStatus('no_show')).toBe(false) // StaffShift-only
  })

  it('isStaffShiftStatus prepozna 6 statusov', () => {
    expect(isStaffShiftStatus('scheduled')).toBe(true)
    expect(isStaffShiftStatus('confirmed')).toBe(true)
    expect(isStaffShiftStatus('no_show')).toBe(true)
    expect(isStaffShiftStatus('absent')).toBe(false) // Shift-only
  })

  it('isShiftType prepozna 6 tipov', () => {
    expect(isShiftType('morning')).toBe(true)
    expect(isShiftType('afternoon')).toBe(true)
    expect(isShiftType('evening')).toBe(true)
    expect(isShiftType('night')).toBe(true)
    expect(isShiftType('split')).toBe(true)
    expect(isShiftType('custom')).toBe(true)
  })

  it('isApArStatus prepozna 5 statusov', () => {
    expect(isApArStatus('open')).toBe(true)
    expect(isApArStatus('paid')).toBe(true)
    expect(isApArStatus('overdue')).toBe(true)
  })

  it('isJournalEntryStatus prepozna 3 statuse', () => {
    expect(isJournalEntryStatus('draft')).toBe(true)
    expect(isJournalEntryStatus('posted')).toBe(true)
    expect(isJournalEntryStatus('reversed')).toBe(true)
  })

  it('isAccountType prepozna 5 tipe', () => {
    expect(isAccountType('asset')).toBe(true)
    expect(isAccountType('liability')).toBe(true)
    expect(isAccountType('equity')).toBe(true)
    expect(isAccountType('revenue')).toBe(true)
    expect(isAccountType('expense')).toBe(true)
  })

  it('isLocationType prepozna 5 tipe', () => {
    expect(isLocationType('restaurant')).toBe(true)
    expect(isLocationType('food_truck')).toBe(true)
    expect(isLocationType('cloud_kitchen')).toBe(true)
  })

  it('isSubscriptionPlan prepozna 3 pakete', () => {
    expect(isSubscriptionPlan('starter')).toBe(true)
    expect(isSubscriptionPlan('professional')).toBe(true)
    expect(isSubscriptionPlan('enterprise')).toBe(true)
  })

  it('isSubscriptionStatus prepozna 5 statusov', () => {
    expect(isSubscriptionStatus('trial')).toBe(true)
    expect(isSubscriptionStatus('active')).toBe(true)
    expect(isSubscriptionStatus('past_due')).toBe(true)
    expect(isSubscriptionStatus('cancelled')).toBe(true)
    expect(isSubscriptionStatus('expired')).toBe(true)
  })

  it('isFursEnvironment prepozna 2 okolji', () => {
    expect(isFursEnvironment('test')).toBe(true)
    expect(isFursEnvironment('production')).toBe(true)
    expect(isFursEnvironment('staging')).toBe(false)
  })
})

describe('Issue #41 — ORDER_STATUS_LABELS', () => {
  it('vsebuje vse 6 statuse s slovenskimi labelami', () => {
    expect(Object.keys(ORDER_STATUS_LABELS)).toHaveLength(6)
    expect(ORDER_STATUS_LABELS.pending).toBe('Na čakanju')
    expect(ORDER_STATUS_LABELS.completed).toBe('Zaključeno')
    expect(ORDER_STATUS_LABELS.cancelled).toBe('Preklicano')
  })

  it('ima label za vsak status v ORDER_STATUS', () => {
    for (const status of Object.values(ORDER_STATUS)) {
      expect(ORDER_STATUS_LABELS[status]).toBeDefined()
      expect(typeof ORDER_STATUS_LABELS[status]).toBe('string')
    }
  })
})

describe('enumValues helper', () => {
  it('vrne array vrednosti iz enum objekta', () => {
    const values = enumValues(ORDER_STATUS)
    expect(values).toContain('pending')
    expect(values).toContain('completed')
    expect(values).toHaveLength(6)
  })

  it('deluje tudi z drugim enumom', () => {
    const values = enumValues(FURS_ENVIRONMENT)
    expect(values).toEqual(['test', 'production'])
  })
})

describe('getEnumStats — migracijski dashboard', () => {
  it('vrne strukturo s števci', () => {
    const stats = getEnumStats()

    expect(stats).toHaveProperty('totalEnums')
    expect(stats).toHaveProperty('totalValues')
    expect(stats).toHaveProperty('totalTypeGuards')
    expect(stats).toHaveProperty('usesPrismaEnum')
    expect(stats).toHaveProperty('recommendations')
  })

  it('totalEnums >= 14 (vsi definirani enumi)', () => {
    const stats = getEnumStats()
    expect(stats.totalEnums).toBeGreaterThanOrEqual(14)
  })

  it('totalValues > totalEnums (vsak enum ima >1 vrednost)', () => {
    const stats = getEnumStats()
    expect(stats.totalValues).toBeGreaterThan(stats.totalEnums)
  })

  it('usesPrismaEnum je false (Phase 3 še ni narejen)', () => {
    const stats = getEnumStats()
    expect(stats.usesPrismaEnum).toBe(false)
  })

  it('recommendations vključuje Phase 3 načrt', () => {
    const stats = getEnumStats()
    expect(stats.recommendations.some((r) => r.includes('Phase 3'))).toBe(true)
  })

  it('totalTypeGuards ustreza številu enumov', () => {
    const stats = getEnumStats()
    expect(stats.totalTypeGuards).toBe(stats.totalEnums)
  })
})
