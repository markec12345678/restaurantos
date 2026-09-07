'use client'

import { memo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ─── Časovnik z barvnim badge-om (Toast KDS inspired) ─────────
// FIX P12: Barvni badge z ozadjem namesto samo barvnega teksta.
// Zelena (safe) → Rumena (warn) → Rdeča (danger) z pulse animacijo.

interface ElapsedTimerProps {
  startTime: string | null
  warnAt?: number
  dangerAt?: number
  /** Show as inline text (default) or badge with background */
  variant?: 'text' | 'badge'
}

export const ElapsedTimer = memo(function ElapsedTimer({
  startTime,
  warnAt = 15,
  dangerAt = 25,
  variant = 'badge',
}: ElapsedTimerProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  if (!startTime) return <span className="text-muted-foreground text-xs">--:--</span>

  const elapsed = Math.floor((now - new Date(startTime).getTime()) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const isDanger = elapsed >= dangerAt * 60
  const isWarning = elapsed >= warnAt * 60 && !isDanger

  // Text variant (legacy — for inline use in small spaces)
  if (variant === 'text') {
    const colorClass = isDanger
      ? 'text-red-500 animate-pulse'
      : isWarning
        ? 'text-amber-500'
        : 'text-emerald-500'
    return (
      <span className={cn('font-mono text-sm font-bold', colorClass)}>
        {timeStr}
      </span>
    )
  }

  // Badge variant (default — Toast KDS style with background)
  const badgeClass = isDanger
    ? 'kds-timer-danger animate-pulse-glow-red'
    : isWarning
      ? 'kds-timer-warn animate-pulse-glow-amber'
      : 'kds-timer-safe'

  return (
    <span className={cn('kds-timer-badge', badgeClass)}>
      {timeStr}
    </span>
  )
})
