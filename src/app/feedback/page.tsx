'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Javna stran za mnenja gostov
// Toast POS + SevenRooms + OpenTable standard
// QR kiosk za ocenjevanje, brez avtentikacije
// ═══════════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { FeedbackForm } from './FeedbackForm'

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <FeedbackForm />
    </Suspense>
  )
}
