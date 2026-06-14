'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Calendar } from 'lucide-react'
import type { EmployeeHeaderProps } from './constants'

// ============================================
// GLAVA ZAPOSLENIH — Naslov z gumbi za dodajanje
// ============================================

export const EmployeeHeader = memo(function EmployeeHeader({ onOpenCreate, onOpenShiftDialog }: EmployeeHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">Zaposleni</h2>
        <p className="text-muted-foreground">Upravljajte osebje in urnike</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onOpenShiftDialog}>
          <Calendar className="h-4 w-4 mr-2" />
          Dodaj izmeno
        </Button>
        <Button onClick={onOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj zaposlenega
        </Button>
      </div>
    </div>
  )
})
