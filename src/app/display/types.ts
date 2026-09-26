// =====================================================================
// Tipi display tabele (R136-c, epic #115 P1-12) — kontrakt R136-b:
// GET /api/public/display?locationId=<id>
//   → 200 { orders: [{ orderNumber, status, type, tableNumber, createdAt }],
//           timestamp }
//   → 404 { error } (fail-closed lokacija), 429 { error } (rate limit), 500
// PII whitelist na serverju — UI nikoli ne prejema imen/telefonov/cen/opomb
// (guest-safe kanon P1-12). Cache-Control: no-store (realno-časovni statusi).
// =====================================================================

/** Wire shape (R136-b kontrakt) — pred normalizacijo na meji hook-a */
export interface RawDisplayOrder {
  orderNumber: number | string
  status?: string
  type?: string
  tableNumber?: number | string | null
  createdAt?: string
}

export interface RawDisplayBoardResponse {
  orders?: RawDisplayOrder[]
  timestamp?: string
}

/** Normaliziran status — 'unknown' je obrambni fallback (nevtralna siva) */
export type DisplayOrderStatus = 'pending' | 'in-progress' | 'ready' | 'unknown'

export interface DisplayOrder {
  /** Številka naročila kot string (#N) — server pošlje number|string */
  orderNumber: string
  status: DisplayOrderStatus
  /** Servisiranje: 'dine-in' | 'takeout' | 'delivery' (validations/orders.ts) */
  type: string
  /** Številka mize ali null (takeout/delivery) */
  tableNumber: number | null
  /** ISO timestamp oddaje */
  createdAt: string
}
