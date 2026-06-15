'use client'

import { memo } from 'react'

interface QuickActionsProps {
  onSelect: (_prompt: string) => void
}

const QUICK_ACTIONS = [
  { icon: '📊', label: 'Optimizacija menija', prompt: 'Analiziraj moj meni in predlagaj optimizacije. Kateri artikli so zvezde in kateri psi?' },
  { icon: '📦', label: 'Zaloga', prompt: 'Kaj moram naročiti pri dobaviteljih? Katera zaloga je nizka?' },
  { icon: '📈', label: 'Napoved prodaje', prompt: 'Kakšna bo prodaja naslednji teden glede na zgodovinske podatke?' },
  { icon: '👥', label: 'Kadrovska', prompt: 'Koliko osebja potrebujem za naslednji teden?' },
  { icon: '💰', label: 'Food cost', prompt: 'Kakšen je moj povprečni food cost % in kje ga lahko znižam?' },
  { icon: '🎯', label: 'Promocije', prompt: 'Predlagaj promocije za povečanje obiska v mirnejših dneh.' },
]

export const QuickActionsBar = memo(function QuickActionsBar({ onSelect }: QuickActionsProps) {
  return (
    <div className="p-3 border-b bg-violet-50/50">
      <p className="text-xs text-gray-500 mb-2 px-1">Hitra vprašanja:</p>
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => onSelect(action.prompt)}
            className="text-left px-2 py-1.5 rounded-lg bg-white border border-violet-100 hover:bg-violet-50 text-xs transition"
          >
            {action.icon} {action.label}
          </button>
        ))}
      </div>
    </div>
  )
})

export const WELCOME_MESSAGE = 'Pozdravljeni! Kako vam lahko pomagam?'
