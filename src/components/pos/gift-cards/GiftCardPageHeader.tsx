'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, Download, Plus } from 'lucide-react'

// --- Props ---

interface GiftCardPageHeaderProps {
  onOpenNewCard: () => void
  /** RUNDA 56: izvoz registra kartic (CSV) — samo ko podatki so naloženi. */
  onExportRegistry?: () => void
  exportRegistryDisabled?: boolean
}

// --- Komponenta za glavo strani ---

export const GiftCardPageHeader = memo(function GiftCardPageHeader({
  onOpenNewCard,
  onExportRegistry,
  exportRegistryDisabled = false,
}: GiftCardPageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Darilne kartice
        </h2>
        <p className="text-muted-foreground">Upravljanje darilnih kartic in bonov</p>
      </div>
      {/* RUNDA 56: dvojni CTA — izvoz registra (sekundarni, outline) ob
          "Nova kartica" (primarni). aria-label razloži obseg izvoza. */}
      <div className="flex items-center gap-2">
        {onExportRegistry && (
          <Button
            variant="outline"
            onClick={onExportRegistry}
            disabled={exportRegistryDisabled}
            className="gap-2 border-border/70 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors touch-manipulation"
            aria-label="Izvozi registrirane kartice kot CSV datoteko"
          >
            <Download className="h-4 w-4" aria-hidden />
            Izvozi register
          </Button>
        )}
        <Button onClick={onOpenNewCard}>
          <Plus className="h-4 w-4 mr-2" />
          Nova kartica
        </Button>
      </div>
    </div>
  )
})
