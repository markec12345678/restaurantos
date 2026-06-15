'use client'

import { memo } from 'react'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Action Buttons Component
// =====================================================================

interface ActionButtonsProps {
  onReset: () => void
}

export const ActionButtons = memo(function ActionButtons({
  onReset,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onReset}
        className="flex-1 py-3 rounded-xl font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
      >
        Iskanje novega naročila
      </button>
      <a
        href="/order"
        className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white text-center hover:bg-blue-700 transition"
      >
        Naroči znova
      </a>
    </div>
  )
})
