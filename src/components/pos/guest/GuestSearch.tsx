'use client'

import { memo } from 'react'

// --- Props ---

interface GuestSearchProps {
  value: string
  onChange: (_value: string) => void
}

// --- Komponenta: Iskalna vrstica za goste ---

export const GuestSearch = memo(function GuestSearch({
  value,
  onChange,
}: GuestSearchProps) {
  return (
    <div className="p-4 border-b">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="🔍 Išči po imenu, telefonu, emailu..."
        aria-label="Išči po gostih"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
})
