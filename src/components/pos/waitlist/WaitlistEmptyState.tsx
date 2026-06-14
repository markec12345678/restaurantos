'use client'

import { memo } from 'react'
import { type WaitlistEmptyStateProps } from './constants'

// Prazno stanje čakalne vrste
export const WaitlistEmptyState = memo(function WaitlistEmptyState(_props: WaitlistEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <p className="text-sm">Čakalna vrsta je prazna</p>
    </div>
  )
})
