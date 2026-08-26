// --- Zaposleni in izmene ---

/** Zaposleni */
export interface EmployeeRow {
  id: string
  name: string
  email?: string
  role: string
  status?: string
  pin?: string
  jobs?: EmployeeJobRow[]
  employeeId?: string
  employeeName?: string
  orderCount?: number
  totalRevenue?: number
  totalTips?: number
  avgOrderValue?: number
  itemsSold?: number
  voidedItems?: number
  primaryJob?: string
  [key: string]: unknown
}

/** Funkcija zaposlenega */
export interface EmployeeJobRow {
  id: string
  isPrimary: boolean
  job: JobRow
  [key: string]: unknown
}

/** Delovno mesto */
export interface JobRow {
  id: string
  name: string
  permissions?: string
  basePayRate?: number
  [key: string]: unknown
}

/** Izmena */
export interface ShiftRow {
  id: string
  employeeId: string
  startTime: string
  endTime?: string
  status?: string
  shiftType?: string
  employeeName?: string
  openedAt?: string
  closedAt?: string
  durationMinutes?: number
  startingCash?: number
  closingCash?: number
  cashSales?: number
  cardSales?: number
  totalSales?: number
  totalTips?: number
  cashDifference?: number
  locationId?: string
  [key: string]: unknown
}

/** Časovni vnos */
export interface TimeEntryRow {
  id: string
  employeeId: string
  clockIn: string
  clockOut?: string
  hours?: number
  [key: string]: unknown
}
