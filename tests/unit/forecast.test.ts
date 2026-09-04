// ============================================
// Forecast Engine — Unit testi
// ============================================
// Testira vse 4 metode forecasting-a + auto-select
// ============================================

import { describe, it, expect } from 'vitest'
import {
  linearRegressionForecast,
  movingAverageForecast,
  dayOfWeekForecast,
  ensembleForecast,
  autoForecast,
  MIN_POINTS,
  RECOMMENDED_POINTS,
  HIGH_CONFIDENCE_POINTS,
  type TimeSeriesPoint,
} from '@/lib/forecast'

// Helper: generiraj time series z določenim številom točk
function generateSeries(count: number, baseValue = 100, trend = 0): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = []
  const today = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    points.push({
      period: date.toISOString().split('T')[0],
      value: baseValue + trend * (count - i) + Math.random() * 10,
    })
  }
  return points
}

// Helper: generiraj series z day-of-week vzorcem (vikend višji)
function generateWeeklyPattern(weeks: number): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = []
  const today = new Date()
  const totalDays = weeks * 7
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dow = date.getDay()
    // Vikend (5, 6, 0) ima višji promet
    const baseValue = dow === 5 || dow === 6 || dow === 0 ? 200 : 100
    points.push({
      period: date.toISOString().split('T')[0],
      value: baseValue + Math.random() * 20,
    })
  }
  return points
}

// --- Konstante ---

describe('Forecast constants', () => {
  it('MIN_POINTS = 7', () => {
    expect(MIN_POINTS).toBe(7)
  })

  it('RECOMMENDED_POINTS = 30', () => {
    expect(RECOMMENDED_POINTS).toBe(30)
  })

  it('HIGH_CONFIDENCE_POINTS = 90', () => {
    expect(HIGH_CONFIDENCE_POINTS).toBe(90)
  })
})

// --- LINEARNA REGRESIJA ---

describe('linearRegressionForecast', () => {
  it('vrne insufficientData za < 7 točk', () => {
    const points = generateSeries(5)
    const result = linearRegressionForecast(points, 7)
    expect(result.insufficientData).toBe(true)
    expect(result.forecast).toHaveLength(0)
    expect(result.confidence).toBe('low')
  })

  it('vrne forecast za >= 7 točk', () => {
    const points = generateSeries(14, 100, 0)
    const result = linearRegressionForecast(points, 7)
    expect(result.insufficientData).toBeUndefined()
    expect(result.forecast).toHaveLength(7)
    expect(result.method).toBe('linear_regression')
  })

  it('pravilno zazna naraščajoč trend (slope > 0)', () => {
    const points = generateSeries(30, 100, 2) // rast 2/dan
    const result = linearRegressionForecast(points, 7)
    expect(result.slope).toBeGreaterThan(0)
  })

  it('pravilno zazna padajoč trend (slope < 0)', () => {
    const points = generateSeries(30, 200, -2) // padec 2/dan
    const result = linearRegressionForecast(points, 7)
    expect(result.slope).toBeLessThan(0)
  })

  it('confidence = low za 7-29 točk', () => {
    const points = generateSeries(14)
    const result = linearRegressionForecast(points, 7)
    expect(result.confidence).toBe('low')
  })

  it('confidence = medium za 30-89 točk', () => {
    const points = generateSeries(50)
    const result = linearRegressionForecast(points, 7)
    expect(result.confidence).toBe('medium')
  })

  it('confidence = high za >= 90 točk', () => {
    const points = generateSeries(95)
    const result = linearRegressionForecast(points, 7)
    expect(result.confidence).toBe('high')
  })

  it('forecast vrednosti so >= 0 (Math.max(0, ...))', () => {
    const points = generateSeries(14, 100, -10) // močno padajoč
    const result = linearRegressionForecast(points, 7)
    for (const f of result.forecast) {
      expect(f.value).toBeGreaterThanOrEqual(0)
    }
  })

  it('izračuna MAPE in RMSE metrike', () => {
    const points = generateSeries(30)
    const result = linearRegressionForecast(points, 7)
    expect(result.metrics).toBeDefined()
    expect(result.metrics?.mape).toBeDefined()
    expect(result.metrics?.rmse).toBeDefined()
    expect(result.metrics!.mape!).toBeGreaterThanOrEqual(0)
    expect(result.metrics!.rmse!).toBeGreaterThanOrEqual(0)
  })

  it('handling degeneriranih podatkov (vsi x enaki) — ne crash-a', () => {
    const points: TimeSeriesPoint[] = Array(10).fill({ period: '2026-01-01', value: 100 })
    const result = linearRegressionForecast(points, 7)
    // Bodisi insufficientData (degenerirani) bodisi forecast z vrednostmi
    expect(result.insufficientData === true || result.forecast.length === 7).toBe(true)
  })
})

// --- MOVING AVERAGE ---

describe('movingAverageForecast', () => {
  it('vrne insufficientData za < 7 točk', () => {
    const points = generateSeries(5)
    const result = movingAverageForecast(points, 7)
    expect(result.insufficientData).toBe(true)
  })

  it('vrne forecast za >= 7 točk', () => {
    const points = generateSeries(14)
    const result = movingAverageForecast(points, 7)
    expect(result.forecast).toHaveLength(7)
    expect(result.method).toBe('moving_average')
  })

  it('forecast je blizu povprečja zadnjih N točk', () => {
    const points = generateSeries(14, 100, 0)
    const result = movingAverageForecast(points, 7, 7)
    const avgLast7 = points.slice(-7).reduce((s, p) => s + p.value, 0) / 7
    // Weighted average bo blizu preprostega povprečja (znotraj 10% tolerance)
    expect(Math.abs(result.forecast[0].value - avgLast7)).toBeLessThan(avgLast7 * 0.1)
  })

  it('uporablja effective window če je manjši od default', () => {
    const points = generateSeries(10) // manj kot windowSize=7
    const result = movingAverageForecast(points, 7, 20)
    expect(result.forecast).toHaveLength(7)
  })
})

// --- DAY-OF-WEEK ---

describe('dayOfWeekForecast', () => {
  it('vrne insufficientData za < 7 točk', () => {
    const points = generateSeries(5)
    const result = dayOfWeekForecast(points, 7)
    expect(result.insufficientData).toBe(true)
  })

  it('vrne forecast za >= 7 točk (1 teden)', () => {
    const points = generateSeries(14)
    const result = dayOfWeekForecast(points, 7)
    expect(result.forecast).toHaveLength(7)
    expect(result.method).toBe('day_of_week')
  })

  it('upošteva vikend vzorce (višji promet)', () => {
    const points = generateWeeklyPattern(4) // 4 tedne
    const result = dayOfWeekForecast(points, 7)
    // Vikend (petek=5, sobota=6, nedelja=0) mora imeti višje vrednosti
    const weekendForecast = result.forecast.filter(f => {
      const dow = new Date(f.period).getDay()
      return dow === 5 || dow === 6 || dow === 0
    })
    const weekdayForecast = result.forecast.filter(f => {
      const dow = new Date(f.period).getDay()
      return dow !== 5 && dow !== 6 && dow !== 0
    })
    const weekendAvg = weekendForecast.reduce((s, f) => s + f.value, 0) / weekendForecast.length
    const weekdayAvg = weekdayForecast.reduce((s, f) => s + f.value, 0) / weekdayForecast.length
    expect(weekendAvg).toBeGreaterThan(weekdayAvg)
  })

  it('confidence = high ko imamo 90+ dni in vse dneve pokrite', () => {
    const points = generateWeeklyPattern(13) // 91 dni
    const result = dayOfWeekForecast(points, 7)
    expect(result.confidence).toBe('high')
  })
})

// --- ENSEMBLE ---

describe('ensembleForecast', () => {
  it('vrne insufficientData za < 7 točk', () => {
    const points = generateSeries(5)
    const result = ensembleForecast(points, 7)
    expect(result.insufficientData).toBe(true)
  })

  it('vrne forecast za >= 7 točk', () => {
    const points = generateSeries(30)
    const result = ensembleForecast(points, 7)
    expect(result.forecast).toHaveLength(7)
    expect(result.method).toBe('ensemble')
  })

  it('confidence je najvišja od vseh metod', () => {
    const points = generateSeries(95)
    const result = ensembleForecast(points, 7)
    expect(result.confidence).toBe('high')
  })

  it('izračuna povprečje MAPE/RMSE vseh metod', () => {
    const points = generateSeries(30)
    const result = ensembleForecast(points, 7)
    expect(result.metrics).toBeDefined()
    expect(result.metrics?.mape).toBeDefined()
    expect(result.metrics?.rmse).toBeDefined()
  })

  it('fallback na remaining methods če ena fails', () => {
    // Samo 7 točk — linear regression bo deloval, day-of-week tudi
    const points = generateSeries(7)
    const result = ensembleForecast(points, 7)
    expect(result.forecast.length).toBeGreaterThan(0)
  })
})

// --- AUTO FORECAST ---

describe('autoForecast', () => {
  it('za < 30 točk uporabi day_of_week', () => {
    const points = generateSeries(14)
    const result = autoForecast(points, 7)
    expect(result.method).toBe('day_of_week')
  })

  it('za >= 30 točk uporabi ensemble', () => {
    const points = generateSeries(40)
    const result = autoForecast(points, 7)
    expect(result.method).toBe('ensemble')
  })

  it('uporabi preferredMethod če je podan', () => {
    const points = generateSeries(14)
    const result = autoForecast(points, 7, 'linear_regression')
    expect(result.method).toBe('linear_regression')
  })

  it('uporabi moving_average če je podan', () => {
    const points = generateSeries(14)
    const result = autoForecast(points, 7, 'moving_average')
    expect(result.method).toBe('moving_average')
  })

  it('vrne insufficientData za < 7 točk', () => {
    const points = generateSeries(5)
    const result = autoForecast(points, 7)
    expect(result.insufficientData).toBe(true)
  })
})

// --- EDGE CASES ---

describe('Edge cases', () => {
  it('prazen array → insufficientData', () => {
    const result = linearRegressionForecast([], 7)
    expect(result.insufficientData).toBe(true)
  })

  it('vse vrednosti 0 → slope = 0', () => {
    const points: TimeSeriesPoint[] = Array.from({ length: 14 }, (_, i) => ({
      period: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
      value: 0,
    }))
    const result = linearRegressionForecast(points, 7)
    expect(result.slope).toBe(0)
  })

  it('ena točka z visoko vrednostjo ne crash-a', () => {
    const points: TimeSeriesPoint[] = Array.from({ length: 14 }, (_, i) => ({
      period: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
      value: i === 7 ? 10000 : 100,
    }))
    const result = linearRegressionForecast(points, 7)
    expect(result.forecast).toHaveLength(7)
  })

  it('negativne vrednosti so clamp-ane na 0 v forecast', () => {
    const points: TimeSeriesPoint[] = Array.from({ length: 14 }, (_, i) => ({
      period: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
      value: 100 - i * 20, // močno padajoč
    }))
    const result = linearRegressionForecast(points, 7)
    for (const f of result.forecast) {
      expect(f.value).toBeGreaterThanOrEqual(0)
    }
  })
})
