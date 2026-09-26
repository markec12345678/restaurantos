'use client'

import { memo } from 'react'

// =====================================================================
// Status badge display tabele (R136-c).
// BUG-04 kanon: NIČ dinamičnih Tailwind razredov (bg-${color}-500 ne deluje
// v produkciji) — celoten razred je LITERAL v tej mapi.
// Barvna pariteta: src/app/order-status/[orderId]/constants.ts
// (STEP_COLORS/STATUS_STEPS — dejanski mapping constants.ts: pending → blue,
// in-progress → amber, ready → emerald; consistency > lastna izbira).
// Neznani status → nevtralna siva (defenzivno; brez uhajanja notranjih vrednosti).
// =====================================================================

interface StatusBadgeConfig {
  label: string
  className: string
}

const STATUS_BADGES: Record<string, StatusBadgeConfig> = {
  'pending': {
    label: 'Oddano',
    className: 'bg-blue-500 text-white',
  },
  'in-progress': {
    label: 'V pripravi',
    className: 'bg-amber-500 text-white',
  },
  'ready': {
    label: 'Pripravljeno za prevzem',
    className: 'bg-emerald-500 text-white',
  },
}

/** Neznani status — nevtralna siva, visok kontrast (AA za velik tekst) */
const UNKNOWN_BADGE: StatusBadgeConfig = {
  label: 'Neznano',
  className: 'bg-gray-500 text-white',
}

export const StatusBadge = memo(function StatusBadge({ status }: { status?: string }) {
  const cfg = (status !== undefined && STATUS_BADGES[status]) || UNKNOWN_BADGE
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-lg font-bold leading-none ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
})
