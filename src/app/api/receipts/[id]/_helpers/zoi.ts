// ZOI placeholder generator za račune

import crypto from 'crypto'

// ─── ZOI placeholder generator (pravi ZOI potrebuje FURS certifikat in digitalni podpis) ───
// FIX CRITICAL: Determinističen ZOI placeholder — ESM import namesto require('crypto')
export function generateZOIPlaceholder(orderNumber: number, receiptNumber: string): string {
  // Deterministični hash iz številke naročila + številke računa — vedno enak za isti račun
  const hash = crypto.createHash('sha256')
    .update(`ZOI-PLACEHOLDER-${orderNumber}-${receiptNumber}`)
    .digest('hex')
  // Vzamemo prvih 32 hex znakov (16 bajtov) in formatiramo
  return hash.substring(0, 32).toUpperCase()
}
