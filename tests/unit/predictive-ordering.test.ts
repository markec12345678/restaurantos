// ============================================
// Predictive Ordering — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import {
  calculateDaysUntilEmpty,
  type TriggerType,
  type ReorderRecommendation,
} from '@/lib/predictive-ordering'

// --- Testi za calculateDaysUntilEmpty ---

describe('calculateDaysUntilEmpty', () => {
  it('brez porabe → Infinity', () => {
    expect(calculateDaysUntilEmpty(100, 0)).toBe(Infinity)
  })

  it('z negativno porabo → Infinity', () => {
    expect(calculateDaysUntilEmpty(100, -5)).toBe(Infinity)
  })

  it('100 enot, 5/dan → 20 dni', () => {
    expect(calculateDaysUntilEmpty(100, 5)).toBe(20)
  })

  it('50 enot, 2.5/dan → 20 dni', () => {
    expect(calculateDaysUntilEmpty(50, 2.5)).toBe(20)
  })

  it('0 enot, 5/dan → 0 dni', () => {
    expect(calculateDaysUntilEmpty(0, 5)).toBe(0)
  })

  it('10 enot, 3/dan → 3 dni (floor)', () => {
    expect(calculateDaysUntilEmpty(10, 3)).toBe(3)
  })

  it('1 enota, 0.5/dan → 2 dni', () => {
    expect(calculateDaysUntilEmpty(1, 0.5)).toBe(2)
  })

  it('majhna zaloga z visoko porabo → 0 dni', () => {
    expect(calculateDaysUntilEmpty(2, 10)).toBe(0)
  })
})

// --- Trigger types ---

describe('TriggerType', () => {
  it('vsi 4 tipi definirani', () => {
    const types: TriggerType[] = ['min_qty', 'forecast_7d', 'forecast_14d', 'manual']
    expect(types.length).toBe(4)
  })
})

// --- Urgency classification ---

describe('Urgency classification (heuristic)', () => {
  function classifyUrgency(
    daysUntilEmpty: number,
    leadTimeDays: number,
    currentQty: number,
    minQty: number,
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (currentQty <= 0) return 'critical'
    if (daysUntilEmpty <= leadTimeDays) return 'critical'
    if (currentQty <= minQty / 2) return 'high'
    if (daysUntilEmpty <= 7) return 'high'
    if (daysUntilEmpty <= 14) return 'medium'
    return 'low'
  }

  it('currentQty ≤ 0 → critical', () => {
    expect(classifyUrgency(0, 2, 0, 10)).toBe('critical')
    expect(classifyUrgency(0, 2, -5, 10)).toBe('critical')
  })

  it('daysUntilEmpty ≤ leadTimeDays → critical', () => {
    expect(classifyUrgency(1, 2, 5, 10)).toBe('critical')
    expect(classifyUrgency(2, 2, 5, 10)).toBe('critical')
  })

  it('currentQty ≤ minQty/2 → high', () => {
    expect(classifyUrgency(10, 2, 5, 10)).toBe('high')
    expect(classifyUrgency(15, 2, 4, 10)).toBe('high')
  })

  it('daysUntilEmpty ≤ 7 → high', () => {
    expect(classifyUrgency(5, 2, 20, 10)).toBe('high')
    expect(classifyUrgency(7, 2, 20, 10)).toBe('high')
  })

  it('daysUntilEmpty 8-14 → medium', () => {
    expect(classifyUrgency(10, 2, 30, 10)).toBe('medium')
    expect(classifyUrgency(14, 2, 30, 10)).toBe('medium')
  })

  it('daysUntilEmpty > 14 → low', () => {
    expect(classifyUrgency(20, 2, 50, 10)).toBe('low')
    expect(classifyUrgency(100, 2, 500, 10)).toBe('low')
  })
})

// --- Recommendation structure ---

describe('ReorderRecommendation structure', () => {
  it('ima vsa obvezna polja', () => {
    const rec: ReorderRecommendation = {
      inventoryItemId: 'inv-1',
      itemName: 'Test',
      currentQty: 10,
      unit: 'kg',
      avgDailyConsumption: 2,
      forecastedConsumption7d: 14,
      forecastedConsumption14d: 28,
      daysUntilEmpty: 5,
      recommendedQty: 30,
      triggerType: 'min_qty',
      triggerReason: 'Below threshold',
      estimatedCost: 150,
      leadTimeDays: 2,
      urgency: 'high',
      hasPendingOrder: false,
    }

    expect(rec).toHaveProperty('inventoryItemId')
    expect(rec).toHaveProperty('itemName')
    expect(rec).toHaveProperty('currentQty')
    expect(rec).toHaveProperty('avgDailyConsumption')
    expect(rec).toHaveProperty('forecastedConsumption7d')
    expect(rec).toHaveProperty('forecastedConsumption14d')
    expect(rec).toHaveProperty('daysUntilEmpty')
    expect(rec).toHaveProperty('recommendedQty')
    expect(rec).toHaveProperty('triggerType')
    expect(rec).toHaveProperty('triggerReason')
    expect(rec).toHaveProperty('estimatedCost')
    expect(rec).toHaveProperty('leadTimeDays')
    expect(rec).toHaveProperty('urgency')
    expect(rec).toHaveProperty('hasPendingOrder')
  })
})

// --- Forecast logic (heuristic test) ---

describe('Forecast logic (heuristic)', () => {
  // Simulacija forecast-a z day-of-week vzorci
  function simpleForecast(dailyAvg: number, days: number): number {
    return Math.round(dailyAvg * days * 10) / 10
  }

  it('2 enote/dan × 7 dni = 14', () => {
    expect(simpleForecast(2, 7)).toBe(14)
  })

  it('2.5 enote/dan × 14 dni = 35', () => {
    expect(simpleForecast(2.5, 14)).toBe(35)
  })

  it('0 porabe → 0 forecast', () => {
    expect(simpleForecast(0, 7)).toBe(0)
  })

  it('forecast raste linearno z dnevi', () => {
    const f7 = simpleForecast(3, 7)
    const f14 = simpleForecast(3, 14)
    expect(f14).toBeGreaterThan(f7)
    expect(f14 / f7).toBeCloseTo(2, 1)
  })
})

// --- Safety stock calculation ---

describe('Safety stock calculation', () => {
  const SAFETY_STOCK_DAYS = 2

  function calculateSafetyStock(avgDaily: number): number {
    return avgDaily * SAFETY_STOCK_DAYS
  }

  it('5 enot/dan → 10 safety stock', () => {
    expect(calculateSafetyStock(5)).toBe(10)
  })

  it('0 porabe → 0 safety', () => {
    expect(calculateSafetyStock(0)).toBe(0)
  })

  it('2.5 enote/dan → 5 safety', () => {
    expect(calculateSafetyStock(2.5)).toBe(5)
  })
})

// --- Reorder quantity calculation ---

describe('Reorder quantity calculation', () => {
  function calcReorderQty(
    forecast14d: number,
    avgDaily: number,
    currentQty: number,
    minOrderQty: number,
  ): number {
    const SAFETY_STOCK_DAYS = 2
    const needed = forecast14d + avgDaily * SAFETY_STOCK_DAYS - currentQty
    return Math.max(minOrderQty, Math.ceil(needed * 10) / 10)
  }

  it('potreba > minOrder → vrne potrebo', () => {
    expect(calcReorderQty(28, 2, 5, 10)).toBe(27) // 28 + 4 - 5 = 27
  })

  it('potreba < minOrder → vrne minOrder', () => {
    expect(calcReorderQty(5, 0.5, 10, 20)).toBe(20) // 5 + 1 - 10 = -4 → max(20, ceil(-4))
  })

  it('brez porabe → minOrder', () => {
    expect(calcReorderQty(0, 0, 100, 10)).toBe(10)
  })

  it('zaloga 0, visoka poraba → veliko naročilo', () => {
    expect(calcReorderQty(70, 5, 0, 10)).toBe(80) // 70 + 10 - 0 = 80
  })
})
