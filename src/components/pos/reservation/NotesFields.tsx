'use client'

import { memo } from 'react'
import { Textarea } from '@/components/ui/textarea'

// ============================================
// Notes fields sub-component
// ============================================
interface NotesFieldsProps {
  specialRequests: string
  setSpecialRequests: (_v: string) => void
  notes: string
  setNotes: (_v: string) => void
}

export const NotesFields = memo(function NotesFields({
  specialRequests, setSpecialRequests,
  notes, setNotes,
}: NotesFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opombe</p>
      <div>
        <label htmlFor="res-special-requests" className="text-xs font-medium">Posebne želje</label>
        <Textarea id="res-special-requests" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Otroški stol, ob oknu, rojstnodnevna torta..." className="text-sm min-h-16" aria-label="Otroški stol, ob oknu, rojstnodnevna torta"/>
      </div>
      <div>
        <label htmlFor="res-notes" className="text-xs font-medium">Interne opombe</label>
        <Textarea id="res-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergije, VIP gost, pogosto naroča..." className="text-sm min-h-16" aria-label="Alergije, VIP gost, pogosto naroča"/>
      </div>
    </div>
  )
})
