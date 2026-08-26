'use client'

import { memo } from 'react'
import { AlertCircle } from 'lucide-react'

// =====================================================================
// Prikaz napake pri rezervaciji
// =====================================================================

interface ErrorViewProps {
  onRetry: () => void
}

export const ErrorView = memo(function ErrorView({ onRetry }: ErrorViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-400 mb-2">Napaka pri rezervaciji</h2>
        <p className="text-muted-foreground mb-4">Prišlo je do napake. Poskusite znova ali nas kontaktirajte telefon.</p>
        <button onClick={onRetry} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors">
          Poskusi znova
        </button>
      </div>
    </div>
  )
})
