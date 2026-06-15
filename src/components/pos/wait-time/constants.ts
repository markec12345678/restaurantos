// ============================================
// WAIT TIME ESTIMATOR — Skupne konstante in tipi
// ============================================

// --- TIPI ---

export interface TableData {
  id: string
  number: number
  capacity: number
  status: string
  area: string
}

export interface WaitlistData {
  id: string
  customerName: string
  partySize: number
  quotedTime: number
  createdAt: string
  status: string
}

export interface EstimationResult {
  estimatedWait: number
  confidence: 'high' | 'medium' | 'low'
  availableTables: number
  occupiedTables: number
  totalTables: number
  occupancyRate: number
  waitlistCount: number
  avgMealTime: number
  isPeakHour: boolean
  isWeekend: boolean
}

export interface AreaOccupancyItem {
  area: string
  label: string
  occupied: number
  total: number
  pct: number
}

// --- POMOZNE FUNKCIJE ---

export const AREA_LABELS: Record<string, string> = {
  main: 'Glavna dvorana',
  terrace: 'Terasa',
  bar: 'Bar',
  vip: 'VIP',
  garden: 'Vrt',
  private: 'Zasebni prostor',
}

export function formatWait(mins: number): string {
  if (mins === 0) return 'Brez čakanja'
  if (mins < 60) return `~${mins} min`
  return `~${Math.floor(mins / 60)}h ${mins % 60}min`
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface WaitEstimateCardProps {
  estimation: EstimationResult
  partySize: string
  diningType: string
}

export interface StatsGridProps {
  estimation: EstimationResult
}

export interface AreaOccupancyChartProps {
  areaOccupancy: AreaOccupancyItem[]
}

export interface EstimationFactorsProps {
  estimation: EstimationResult
  partySize: string
}

export interface WaitlistQueueProps {
  waitlist: WaitlistData[] | undefined
  waitlistCount: number
}

// Re-export helpers from wait-time-helpers for backward compatibility
export { computeEstimation, computeAreaOccupancy } from './wait-time-helpers'
