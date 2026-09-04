// ============================================
// Fraud Detection — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import {
  isFraudRelatedPrompt,
  DEFAULT_THRESHOLDS,
  type FraudSeverity,
  type FraudAlertType,
} from '@/lib/fraud-detection'

// --- Fraud prompt detection ---

describe('isFraudRelatedPrompt', () => {
  it('prepozna "fraud"', () => {
    expect(isFraudRelatedPrompt('show me fraud activity')).toBe(true)
  })

  it('prepozna "suspicious"', () => {
    expect(isFraudRelatedPrompt('any suspicious activity?')).toBe(true)
  })

  it('prepozna "anomaly"', () => {
    expect(isFraudRelatedPrompt('check for anomalies')).toBe(true)
  })

  it('prepozna "theft"', () => {
    expect(isFraudRelatedPrompt('is there any theft?')).toBe(true)
  })

  it('prepozna "manipulation"', () => {
    expect(isFraudRelatedPrompt('cash manipulation detected?')).toBe(true)
  })

  it('prepozna "red flags"', () => {
    expect(isFraudRelatedPrompt('any red flags?')).toBe(true)
  })

  it('prepozna "embezzlement"', () => {
    expect(isFraudRelatedPrompt('embezzlement check')).toBe(true)
  })

  it('prepozna "cash discrepancy"', () => {
    expect(isFraudRelatedPrompt('show cash discrepancies')).toBe(true)
  })

  it('prepozna "after hours activity"', () => {
    expect(isFraudRelatedPrompt('any after hours activity?')).toBe(true)
  })

  it('prepozna "refund pattern"', () => {
    expect(isFraudRelatedPrompt('check refund patterns')).toBe(true)
  })

  it('prepozna "discount abuse"', () => {
    expect(isFraudRelatedPrompt('discount abuse detected?')).toBe(true)
  })

  it('ne prepozna navadnega prompt-a', () => {
    expect(isFraudRelatedPrompt('kakšen je bil promet danes?')).toBe(false)
  })

  it('ne prepozna prompt-a o naročilih', () => {
    expect(isFraudRelatedPrompt('koliko naročil smo imeli?')).toBe(false)
  })

  it('ne prepozna prompt-a o zaposlenih', () => {
    expect(isFraudRelatedPrompt('kdo dela danes?')).toBe(false)
  })

  it('prepozna "who voided the most"', () => {
    expect(isFraudRelatedPrompt('who voided the most orders?')).toBe(true)
  })
})

// --- Thresholds ---

describe('DEFAULT_THRESHOLDS', () => {
  it('maxVoidsPerShift = 5', () => {
    expect(DEFAULT_THRESHOLDS.maxVoidsPerShift).toBe(5)
  })

  it('voidAmountThreshold = €100', () => {
    expect(DEFAULT_THRESHOLDS.voidAmountThreshold).toBe(100)
  })

  it('highDiscountPercent = 50%', () => {
    expect(DEFAULT_THRESHOLDS.highDiscountPercent).toBe(50)
  })

  it('highDiscountAmount = €50', () => {
    expect(DEFAULT_THRESHOLDS.highDiscountAmount).toBe(50)
  })

  it('refundAmountThreshold = €200', () => {
    expect(DEFAULT_THRESHOLDS.refundAmountThreshold).toBe(200)
  })

  it('cashDrawerDiscrepancyThreshold = €10', () => {
    expect(DEFAULT_THRESHOLDS.cashDrawerDiscrepancyThreshold).toBe(10)
  })

  it('afterHoursStart = 23', () => {
    expect(DEFAULT_THRESHOLDS.afterHoursStart).toBe(23)
  })

  it('afterHoursEnd = 6', () => {
    expect(DEFAULT_THRESHOLDS.afterHoursEnd).toBe(6)
  })

  it('employeeRevenueSpikeMultiplier = 3', () => {
    expect(DEFAULT_THRESHOLDS.employeeRevenueSpikeMultiplier).toBe(3)
  })

  it('maxPaymentsPerCheck = 4', () => {
    expect(DEFAULT_THRESHOLDS.maxPaymentsPerCheck).toBe(4)
  })
})

// --- Severity klasifikacija (hevristika) ---

describe('Severity classification', () => {
  function classifySeverity(
    voidCount: number,
    maxVoids: number,
  ): FraudSeverity {
    if (voidCount > maxVoids * 2) return 'high'
    if (voidCount > maxVoids) return 'medium'
    return 'low'
  }

  it('voidCount = 3 (pod threshold) → low', () => {
    expect(classifySeverity(3, 5)).toBe('low')
  })

  it('voidCount = 7 (rahlo nad threshold) → medium', () => {
    expect(classifySeverity(7, 5)).toBe('medium')
  })

  it('voidCount = 15 (2x threshold) → high', () => {
    expect(classifySeverity(15, 5)).toBe('high')
  })

  it('voidCount = 20 (4x threshold) → high', () => {
    expect(classifySeverity(20, 5)).toBe('high')
  })
})

// --- Alert types ---

describe('FraudAlertType', () => {
  it('vsi tipi so definirani', () => {
    const types: FraudAlertType[] = [
      'excessive_voids',
      'high_discount_no_reason',
      'frequent_refunds_same_customer',
      'cash_drawer_discrepancy',
      'after_hours_activity',
      'employee_revenue_spike',
      'split_payment_anomaly',
      'multi_card_same_check',
      'manual_price_override',
      'compromised_refund_pattern',
    ]
    expect(types.length).toBe(10)
  })
})

// --- After hours detection ---

describe('After hours detection', () => {
  function isAfterHours(hour: number, start: number, end: number): boolean {
    return hour >= start || hour < end
  }

  it('23:00 je after hours', () => {
    expect(isAfterHours(23, 23, 6)).toBe(true)
  })

  it('00:00 (polnoč) je after hours', () => {
    expect(isAfterHours(0, 23, 6)).toBe(true)
  })

  it('03:00 je after hours', () => {
    expect(isAfterHours(3, 23, 6)).toBe(true)
  })

  it('05:00 je after hours', () => {
    expect(isAfterHours(5, 23, 6)).toBe(true)
  })

  it('06:00 ni after hours (mejni)', () => {
    expect(isAfterHours(6, 23, 6)).toBe(false)
  })

  it('12:00 ni after hours', () => {
    expect(isAfterHours(12, 23, 6)).toBe(false)
  })

  it('22:00 ni after hours (mejni)', () => {
    expect(isAfterHours(22, 23, 6)).toBe(false)
  })

  it('18:00 ni after hours', () => {
    expect(isAfterHours(18, 23, 6)).toBe(false)
  })
})

// --- Discount analysis ---

describe('Discount analysis', () => {
  function calculateDiscountPercent(discountAmount: number, total: number): number {
    if (total <= 0) return 0
    return (discountAmount / total) * 100
  }

  it('€50 discount na €100 → 50%', () => {
    expect(calculateDiscountPercent(50, 100)).toBe(50)
  })

  it('€25 discount na €100 → 25%', () => {
    expect(calculateDiscountPercent(25, 100)).toBe(25)
  })

  it('€0 discount → 0%', () => {
    expect(calculateDiscountPercent(0, 100)).toBe(0)
  })

  it('total 0 → 0% (prepreči division by zero)', () => {
    expect(calculateDiscountPercent(50, 0)).toBe(0)
  })

  it('100% discount (€100 na €100) → 100%', () => {
    expect(calculateDiscountPercent(100, 100)).toBe(100)
  })
})
