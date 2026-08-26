// --- Sinhronizacija in validacija ---

/** Rezultat sinhronizacije */
export interface SyncResultRow {
  success: boolean
  message?: string
  error?: string
  results?: SyncResultItem[]
  [key: string]: unknown
}

export interface SyncResultItem {
  id?: string
  status: string
  message?: string
  targetLocationName?: string
  menusCreated?: number
  categoriesCreated?: number
  itemsCreated?: number
  itemsUpdated?: number
  [key: string]: unknown
}

/** Validacijska napaka (FURS) */
export interface ValidationErrorRow {
  field: string
  message: string
  code?: string
  [key: string]: unknown
}
