'use client'

import { memo, useState, useEffect } from 'react'
import { Timer } from 'lucide-react'

// ============================================
// KOMPONENTA ZA PRIKAZ ČASA
// ============================================
export const WaitTimer = memo(function WaitTimer({ minutes, urgency }: { minutes: number; urgency: string }) {
  const [elapsed, setElapsed] = useState(minutes)

  // Sinhroniziraj s server podatki, ko se prop spremeni
  useEffect(() => {
    setElapsed(minutes)
  }, [minutes])

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60
  const display = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <div className={`flex items-center gap-1 text-sm font-bold ${
      urgency === 'critical' ? 'text-red-500 animate-pulse' :
      urgency === 'warning' ? 'text-amber-500' :
      'text-muted-foreground'
    }`} role="timer" aria-live="polite" aria-label={`Čas čakanja: ${display}`}>
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {display}
    </div>
  )
})
