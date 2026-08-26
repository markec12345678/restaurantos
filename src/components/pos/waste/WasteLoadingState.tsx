'use client'
import { memo } from 'react'

// ============================================
// WASTE LOADING STATE — Podkomponenta
// ============================================
export const WasteLoadingState = memo(function WasteLoadingState() {
  return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  )
})
