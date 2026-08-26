'use client'

import { memo } from 'react'
import { type WaitlistStatsBarProps } from './constants'

// Vrstica s statistiko čakalne vrste
export const WaitlistStatsBar = memo(function WaitlistStatsBar({ waitingCount, notifiedCount, totalGuests }: WaitlistStatsBarProps) {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 border-b">
      <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
        <span className="font-bold text-orange-600">{waitingCount}</span>
        <span className="text-xs text-gray-500 ml-1">čakajo</span>
      </div>
      <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
        <span className="font-bold text-blue-600">{notifiedCount}</span>
        <span className="text-xs text-gray-500 ml-1">obveščeni</span>
      </div>
      <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
        <span className="font-bold text-gray-500">{totalGuests}</span>
        <span className="text-xs text-gray-500 ml-1">gostov</span>
      </div>
    </div>
  )
})
