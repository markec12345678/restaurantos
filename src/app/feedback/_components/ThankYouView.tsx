'use client'

import { memo } from 'react'
import { Star, CheckCircle2 } from 'lucide-react'

interface ThankYouViewProps {
  avgRating: number
}

export const ThankYouView = memo(function ThankYouView({ avgRating }: ThankYouViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Hvala za vaše mnenje!</h1>
        <p className="text-muted-foreground">Vaše povratne informacije nam pomagajo izboljšati storitev. Veseli bomo vašega naslednjega obiska!</p>
        <div className="flex items-center justify-center gap-1 mt-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} className={`h-6 w-6 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
          ))}
        </div>
      </div>
    </div>
  )
})
