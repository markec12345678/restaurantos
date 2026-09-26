'use client'

import { memo } from 'react'

// =====================================================================
// Status badge voznika (R137-c). BUG-04 kanon: NIČ dinamičnih Tailwind
// razredov (bg-${color}-500 ne deluje v produkciji) — celoten razred je
// LITERAL v tej mapi (display StatusBadge vzor).
//
// Barvna pariteta: display tabla kanon (StatusBadge.tsx R136-c:
// pending=blue, in-progress=amber, ready=emerald). DeliveryTracker ima
// SAMO nevtralen secondary Badge s surovim statusom (DeliveryCard.tsx:21)
// — barvnega precedenta za dostavne vmesne statuse NI, zato extension po
// logiki napredovanja: assigned=blue (dodeljeno) → picked_up=amber (v delu)
// → on_the_way=sky (pod pogojem) → arriving=violet (skoraj tam) →
// delivered=emerald (uspeh) / failed=red (destruktivno).
// =====================================================================

interface StatusBadgeConfig {
  label: string
  className: string
}

const DRIVER_STATUS_BADGES: Record<string, StatusBadgeConfig> = {
  assigned:   { label: 'Dodeljeno',   className: 'bg-blue-500 text-white' },
  picked_up:  { label: 'Prevzeto',    className: 'bg-amber-500 text-white' },
  on_the_way: { label: 'Na poti',     className: 'bg-sky-500 text-white' },
  arriving:   { label: 'Prihajam',    className: 'bg-violet-500 text-white' },
  delivered:  { label: 'Dostavljeno', className: 'bg-emerald-500 text-white' },
  failed:     { label: 'Napaka',      className: 'bg-red-500 text-white' },
}

/** Neznani status — nevtralna siva (defenzivno; brez uhajanja notranjih vrednosti) */
const UNKNOWN_BADGE: StatusBadgeConfig = {
  label: 'Neznano',
  className: 'bg-gray-500 text-white',
}

export const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const cfg = DRIVER_STATUS_BADGES[status] || UNKNOWN_BADGE
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
})
