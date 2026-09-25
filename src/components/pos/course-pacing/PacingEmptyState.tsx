'use client'

import { memo } from 'react'
import { ChefHat } from 'lucide-react'

// ============================================
// PRAZNO STANJE — NI AKTIVNIH NAROČIL S TOKOVI
// ============================================
export const PacingEmptyState = memo(function PacingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <ChefHat className="h-16 w-16 opacity-20" />
      <div className="text-center">
        <p className="text-lg font-medium">Ni aktivnih naročil s tokovi</p>
        <p className="text-sm">Naročila oddana s prižganimi Tokovi se prikazujejo tukaj</p>
      </div>
    </div>
  )
})
