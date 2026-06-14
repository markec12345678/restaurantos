'use client'

import { memo } from 'react'

// --- Props ---

interface GuestHeaderProps {
  total: number
  vipOnly: boolean
  onVipToggle: () => void
  onNewGuest: () => void
}

// --- Komponenta: Glava z gumbi VIP in Nov gost ---

export const GuestHeader = memo(function GuestHeader({
  total,
  vipOnly,
  onVipToggle,
  onNewGuest,
}: GuestHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">👥 Gost CRM</h2>
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{total} gostov</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onVipToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            vipOnly ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          👑 VIP
        </button>
        <button
          onClick={onNewGuest}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nov gost
        </button>
      </div>
    </div>
  )
})
