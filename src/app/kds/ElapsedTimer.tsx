'use client'

import { memo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ─── Časovnik ──────────────────────────────────────────────────

interface ElapsedTimerProps {
  startTime: string | null
  warnAt?: number
  dangerAt?: number
}

export const ElapsedTimer = memo(function ElapsedTimer({ startTime, warnAt = 15, dangerAt = 25 }: ElapsedTimerProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])
  if (!startTime) return <span className="text-muted-foreground text-xs">--:--</span>
  const elapsed = Math.floor((now - new Date(startTime).getTime()) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const colorClass = elapsed >= dangerAt * 60
    ? 'text-red-500 animate-pulse'
    : elapsed >= warnAt * 60
      ? 'text-amber-500'
      : 'text-emerald-500'
  return (
    <span className={cn('font-mono text-sm font-bold', colorClass)}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
})
