'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, FileText } from 'lucide-react'
import { categoryConfig } from './constants'

interface HaccpEmptyStateProps {
  activeTab: string
  onCreate: (_category?: string) => void
}

export const HaccpEmptyState = memo(function HaccpEmptyState({
  activeTab,
  onCreate,
}: HaccpEmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Ni HACCP vnosov</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
        {activeTab !== 'all'
          ? `Za kategorijo "${categoryConfig[activeTab]?.label || activeTab}" ni vnosov. Dodajte nov vnos ali spremenite filter.`
          : 'Za izbrano obdobje ni vnosov. Dodajte nov vnos ali spremenite filter.'}
      </p>
      <Button onClick={() => onCreate(activeTab !== 'all' ? activeTab : undefined)}>
        <Plus className="h-4 w-4 mr-2" />
        Dodaj HACCP vnos
      </Button>
    </div>
  )
})
