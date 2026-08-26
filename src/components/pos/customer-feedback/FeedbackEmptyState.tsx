'use client'

// ============================================
// PRAZNO STANJE — NI MNENJ
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send } from 'lucide-react'
import type { FeedbackEmptyStateProps } from './constants'

export const FeedbackEmptyState = memo(function FeedbackEmptyState({ onAddClick }: FeedbackEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <MessageSquare className="h-16 w-16 opacity-20" />
      <div className="text-center">
        <p className="text-lg font-medium">Se ni mnenj gostov</p>
        <p className="text-sm">Dodaj prvo mnenje za sledenje kakovosti</p>
      </div>
      <Button onClick={onAddClick} className="gap-1.5">
        <Send className="h-4 w-4" />
        Dodaj mnenje
      </Button>
    </div>
  )
})
