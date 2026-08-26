'use client'

import { memo } from 'react'
import { type GuestFormRow } from '@/lib/types'
import { DIETARY_OPTIONS } from './constants'

// --- Props ---

interface DietaryPrefsSelectorProps {
  form: GuestFormRow
  onFormChange: (_form: GuestFormRow) => void
}

// --- Izbirnik prehranskih preferenc ---

export const DietaryPrefsSelector = memo(function DietaryPrefsSelector({
  form,
  onFormChange,
}: DietaryPrefsSelectorProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">Prehranske preference</label>
      <div className="flex flex-wrap gap-1 mt-1">
        {DIETARY_OPTIONS.map(pref => {
          const selected = (form.dietaryPrefs || []).includes(pref)
          return (
            <button
              key={pref}
              onClick={() => onFormChange({
                ...form,
                dietaryPrefs: selected
                  ? (form.dietaryPrefs ?? []).filter((x: string) => x !== pref)
                  : [...(form.dietaryPrefs ?? []), pref],
              })}
              className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                selected ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {pref}
            </button>
          )
        })}
      </div>
    </div>
  )
})
