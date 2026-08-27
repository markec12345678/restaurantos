// ============================================
// FORECAST ENGINE — AI napovedi z več algoritmi
// ============================================
// Implementirane metode (po vzoru POSR + izboljšave):
//   1. linearRegressionForecast — linearna regresija (math pravilna)
//   2. movingAverageForecast — drseče povprečje (windowSize)
//   3. dayOfWeekForecast — povprečje po dnevih v tednu
//   4. ensembleForecast — kombinacija vseh treh z utežmi
//
// Prednosti kombinacije:
//   - Linearna regresija: zazna trend (rast/padec)
//   - Moving average: gladi šum
//   - Day-of-week: upošteva tedenske vzorce (vikend vs delavnik)
//   - Ensemble: boljša natančnost kot posamezne metode
// ============================================

// --- Tipi ---
export interface TimeSeriesPoint {
  period: string // ISO date ali labela
  value: number
}

export type ForecastMethod = 'linear_regression' | 'moving_average' | 'day_of_week' | 'ensemble'

export interface ForecastResult {
  method: ForecastMethod
  history: TimeSeriesPoint[]
  forecast: TimeSeriesPoint[]
  slope?: number // Samo za linear_regression
  confidence: 'low' | 'medium' | 'high'
  confidenceNote: string
  insufficientData?: boolean
  // Statistika
  metrics?: {
    mape?: number // Mean Absolute Percentage Error
    rmse?: number // Root Mean Square Error
  }
}

// --- Konstante ---
const MIN_POINTS = 7 // Najmanj 7 dni podatkov
const RECOMMENDED_POINTS = 30 // 30 dni za boljšo natančnost
const HIGH_CONFIDENCE_POINTS = 90 // 90 dni za high confidence

// --- 1. LINEARNA REGRESIJA ---
// Matematično pravilna implementacija (po POSR vzoru)
// Formula: y = slope * x + intercept
// slope = (n * Σxy - Σx * Σy) / (n * Σx² - (Σx)²)
// intercept = (Σy - slope * Σx) / n
export function linearRegressionForecast(
  points: TimeSeriesPoint[],
  forecastDays: number,
): ForecastResult {
  if (points.length < MIN_POINTS) {
    return {
      method: 'linear_regression',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: `Premalo podatkov: potrebno vsaj ${MIN_POINTS} točk, dobili ${points.length}.`,
      insufficientData: true,
    }
  }

  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  points.forEach((point, index) => {
    sumX += index
    sumY += point.value
    sumXY += index * point.value
    sumX2 += index * index
  })

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) {
    return {
      method: 'linear_regression',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: 'Degenerirani podatki — vsi x enaki.',
      insufficientData: true,
    }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  const forecast: TimeSeriesPoint[] = []
  for (let i = 1; i <= forecastDays; i++) {
    const projectedValue = Math.max(0, intercept + slope * (n - 1 + i))
    forecast.push({
      period: `forecast+${i}`,
      value: Math.round(projectedValue * 100) / 100,
    })
  }

  const confidence =
    points.length >= HIGH_CONFIDENCE_POINTS ? 'high' :
    points.length >= RECOMMENDED_POINTS ? 'medium' : 'low'

  const confidenceNote =
    points.length >= HIGH_CONFIDENCE_POINTS
      ? `Visoka confidence: ${points.length} dni zgodovine, slope=${slope.toFixed(2)}.`
      : points.length >= RECOMMENDED_POINTS
      ? `Srednja confidence: ${points.length} dni, slope=${slope.toFixed(2)}.`
      : `Nizka confidence: manj kot ${RECOMMENDED_POINTS} dni zgodovine.`

  // Izračunaj MAPE (Mean Absolute Percentage Error) za validacijo
  const metrics = calculateMetrics(points, (x) => intercept + slope * x)

  return {
    method: 'linear_regression',
    history: points,
    forecast,
    slope: Math.round(slope * 100) / 100,
    confidence,
    confidenceNote,
    metrics,
  }
}

// --- 2. MOVING AVERAGE ---
// Drseče povprečje z nastavljivim oknom
export function movingAverageForecast(
  points: TimeSeriesPoint[],
  forecastDays: number,
  windowSize = 7,
): ForecastResult {
  if (points.length < MIN_POINTS) {
    return {
      method: 'moving_average',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: `Premalo podatkov: potrebno vsaj ${MIN_POINTS} točk.`,
      insufficientData: true,
    }
  }

  const effectiveWindow = Math.min(windowSize, points.length)
  // Povprečje zadnjih N točk
  const lastN = points.slice(-effectiveWindow)
  const avg = lastN.reduce((sum, p) => sum + p.value, 0) / effectiveWindow

  // Za napoved uporabimo weighted moving average (novejše točke imajo večjo težo)
  const weights = Array.from({ length: effectiveWindow }, (_, i) => i + 1)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const weightedAvg =
    lastN.reduce((sum, p, i) => sum + p.value * weights[i], 0) / totalWeight

  const forecast: TimeSeriesPoint[] = []
  for (let i = 1; i <= forecastDays; i++) {
    forecast.push({
      period: `forecast+${i}`,
      value: Math.round(weightedAvg * 100) / 100,
    })
  }

  const confidence =
    points.length >= HIGH_CONFIDENCE_POINTS ? 'high' :
    points.length >= RECOMMENDED_POINTS ? 'medium' : 'low'

  return {
    method: 'moving_average',
    history: points,
    forecast,
    confidence,
    confidenceNote: `Moving average (window=${effectiveWindow}), weighted avg=${weightedAvg.toFixed(2)}.`,
    metrics: calculateMetrics(points, () => avg),
  }
}

// --- 3. DAY-OF-WEEK FORECAST ---
// Povprečje po dnevih v tednu (upošteva vikend vzorce)
export function dayOfWeekForecast(
  points: TimeSeriesPoint[],
  forecastDays: number,
): ForecastResult {
  if (points.length < MIN_POINTS) {
    return {
      method: 'day_of_week',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: `Premalo podatkov: potrebno vsaj ${MIN_POINTS} točk (1 teden).`,
      insufficientData: true,
    }
  }

  // Agregiraj po dnevih v tednu (0=nedelja, 6=sobota)
  const dayOfWeekSums: number[] = Array(7).fill(0)
  const dayOfWeekCounts: number[] = Array(7).fill(0)

  for (const point of points) {
    const date = new Date(point.period)
    if (isNaN(date.getTime())) continue
    const dow = date.getDay()
    dayOfWeekSums[dow] += point.value
    dayOfWeekCounts[dow]++
  }

  const dayOfWeekAvg = dayOfWeekSums.map((sum, i) =>
    dayOfWeekCounts[i] > 0 ? sum / dayOfWeekCounts[i] : 0,
  )

  // Generiraj forecast
  const forecast: TimeSeriesPoint[] = []
  const today = new Date()
  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dow = date.getDay()
    forecast.push({
      period: date.toISOString().split('T')[0],
      value: Math.round(dayOfWeekAvg[dow] * 100) / 100,
    })
  }

  // Confidence: koliko dni v tednu ima vsaj 1 podatkov
  const activeDays = dayOfWeekCounts.filter((c) => c > 0).length
  const confidence: 'low' | 'medium' | 'high' =
    activeDays >= 7 && points.length >= HIGH_CONFIDENCE_POINTS ? 'high' :
    activeDays >= 5 && points.length >= RECOMMENDED_POINTS ? 'medium' : 'low'

  return {
    method: 'day_of_week',
    history: points,
    forecast,
    confidence,
    confidenceNote: `Day-of-week povprečje (active days: ${activeDays}/7).`,
  }
}

// --- 4. ENSEMBLE FORECAST ---
// Kombinacija vseh treh metod z utežmi
// Uteži so določene glede na confidence vsake metode
export function ensembleForecast(
  points: TimeSeriesPoint[],
  forecastDays: number,
): ForecastResult {
  if (points.length < MIN_POINTS) {
    return {
      method: 'ensemble',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: `Premalo podatkov za ensemble: potrebno vsaj ${MIN_POINTS} točk.`,
      insufficientData: true,
    }
  }

  const linear = linearRegressionForecast(points, forecastDays)
  const ma = movingAverageForecast(points, forecastDays)
  const dow = dayOfWeekForecast(points, forecastDays)

  // Če katera od metod ni uspela, uporabi preostale
  const methods = [linear, ma, dow].filter((m) => !m.insufficientData)
  if (methods.length === 0) {
    return {
      method: 'ensemble',
      history: points,
      forecast: [],
      confidence: 'low',
      confidenceNote: 'Vse metode stale v podatkih.',
      insufficientData: true,
    }
  }

  // Uteži glede na confidence
  const confidenceWeights = { high: 3, medium: 2, low: 1 }
  const weights = methods.map((m) => confidenceWeights[m.confidence])
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  // Kombiniraj forecast-e (uteženo povprečje)
  const forecast: TimeSeriesPoint[] = []
  for (let i = 0; i < forecastDays; i++) {
    let weightedSum = 0
    for (let j = 0; j < methods.length; j++) {
      const methodForecast = methods[j].forecast[i]
      if (methodForecast) {
        weightedSum += methodForecast.value * weights[j]
      }
    }
    forecast.push({
      period: `forecast+${i + 1}`,
      value: Math.round((weightedSum / totalWeight) * 100) / 100,
    })
  }

  // Skupna confidence = najvišja confidence med metodami
  const confidences = methods.map((m) => m.confidence)
  const overallConfidence: 'low' | 'medium' | 'high' =
    confidences.includes('high') ? 'high' :
    confidences.includes('medium') ? 'medium' : 'low'

  return {
    method: 'ensemble',
    history: points,
    forecast,
    confidence: overallConfidence,
    confidenceNote: `Ensemble ${methods.length} metod (uteženo povprečje).`,
    metrics: {
      mape: methods.reduce((sum, m) => sum + (m.metrics?.mape || 0), 0) / methods.length,
      rmse: methods.reduce((sum, m) => sum + (m.metrics?.rmse || 0), 0) / methods.length,
    },
  }
}

// --- POMOŽNE FUNKCIJE ---

// Izračunaj MAPE in RMSE za validacijo modela
function calculateMetrics(
  points: TimeSeriesPoint[],
  predict: (x: number) => number,
): { mape: number; rmse: number } {
  if (points.length === 0) return { mape: 0, rmse: 0 }

  let sumAbsPctError = 0
  let sumSquaredError = 0
  let count = 0

  points.forEach((point, index) => {
    const predicted = predict(index)
    const actual = point.value
    if (actual !== 0) {
      sumAbsPctError += Math.abs((actual - predicted) / actual) * 100
      count++
    }
    sumSquaredError += Math.pow(actual - predicted, 2)
  })

  return {
    mape: count > 0 ? Math.round((sumAbsPctError / count) * 100) / 100 : 0,
    rmse: Math.round(Math.sqrt(sumSquaredError / points.length) * 100) / 100,
  }
}

// --- GLAVNA IZVOZNA FUNKCIJA ---
// Izbere najboljšo metodo glede na količino podatkov
export function autoForecast(
  points: TimeSeriesPoint[],
  forecastDays: number,
  preferredMethod?: ForecastMethod,
): ForecastResult {
  if (preferredMethod) {
    switch (preferredMethod) {
      case 'linear_regression': return linearRegressionForecast(points, forecastDays)
      case 'moving_average': return movingAverageForecast(points, forecastDays)
      case 'day_of_week': return dayOfWeekForecast(points, forecastDays)
      case 'ensemble': return ensembleForecast(points, forecastDays)
    }
  }

  // Auto-select: če imamo dovolj podatkov, uporabi ensemble
  if (points.length >= RECOMMENDED_POINTS) {
    return ensembleForecast(points, forecastDays)
  }
  // Sicer uporabi day-of-week (najbolj zanesljiv za majhne datasete)
  return dayOfWeekForecast(points, forecastDays)
}

// --- EXPORT konstant ---
export { MIN_POINTS, RECOMMENDED_POINTS, HIGH_CONFIDENCE_POINTS }
