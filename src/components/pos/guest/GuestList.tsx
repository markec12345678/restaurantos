'use client'

import { memo } from 'react'
import { type GuestData, parseJsonField } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// --- Props ---

interface GuestListProps {
  guests: GuestData[]
  selectedGuestId: string | null
  tab: 'list' | 'detail'
  onSelectGuest: (_id: string) => void
}

// --- Komponenta: Seznam gostov ---

export const GuestList = memo(function GuestList({
  guests,
  selectedGuestId,
  tab,
  onSelectGuest,
}: GuestListProps) {
  return (
    <div className={`${tab === 'detail' ? 'w-1/3 border-r' : 'w-full'} overflow-y-auto`}>
      {guests.map(guest => (
        <div
          key={guest.id}
          onClick={() => onSelectGuest(guest.id)}
          className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition ${
            selectedGuestId === guest.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectGuest(guest.id) } }}
        >
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
              guest.isVip ? 'bg-amber-500' : 'bg-gray-400'
            }`}>
              {guest.isVip ? '👑' : (guest.firstName?.[0] || '') + (guest.lastName?.[0] || '')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm truncate">
                  {guest.firstName} {guest.lastName}
                </span>
                {guest.isVip && <span className="text-amber-500 text-xs">VIP</span>}
              </div>
              <div className="text-xs text-gray-500">
                {guest.totalVisits} obiskov • €{safeToFixed(guest.totalSpent, 0)} skupaj
              </div>
            </div>
            {guest.lastVisitAt && (
              <span className="text-[10px] text-gray-500">
                {new Date(guest.lastVisitAt).toLocaleDateString('sl-SI')}
              </span>
            )}
          </div>
          {/* Hitri zaznamki — alergeni in preference */}
          <div className="flex flex-wrap gap-1 mt-1 ml-11">
            {parseJsonField(guest.allergens).length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠️ Alergeni</span>
            )}
            {parseJsonField(guest.dietaryPrefs).map((p: string) => (
              <span key={p} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{p}</span>
            ))}
          </div>
        </div>
      ))}
      {guests.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <p className="text-3xl mb-2">👥</p>
          <p>Ni gostov. Dodajte prvega!</p>
        </div>
      )}
    </div>
  )
})
