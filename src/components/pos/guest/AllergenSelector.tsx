'use client'

import { memo } from 'react'
import { type GuestFormRow } from '@/lib/types'
import { ALLERGEN_LIST } from './constants'

// --- Props ---

interface AllergenSelectorProps {
  form: GuestFormRow
  onFormChange: (_form: GuestFormRow) => void
}

// --- Izbirnik alergenov ---

export const AllergenSelector = memo(function AllergenSelector({
  form,
  onFormChange,
}: AllergenSelectorProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">Alergeni</label>
      <div className="flex flex-wrap gap-1 mt-1">
        {ALLERGEN_LIST.map(a => {
          const code = a.split('-')[0]
          const selected = (form.allergens || []).includes(code)
          return (
            <button
              key={code}
              onClick={() => onFormChange({
                ...form,
                allergens: selected
                  ? (form.allergens ?? []).filter((x: string) => x !== code)
                  : [...(form.allergens ?? []), code],
              })}
              className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                selected ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {a}
            </button>
          )
        })}
      </div>
    </div>
  )
})
