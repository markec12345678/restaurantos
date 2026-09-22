'use client'

import { useEffect, useRef } from 'react'
import {
  KDS_REMINDER_CHECK_MS,
  KDS_DANGER_MINUTES,
  shouldRemind,
} from '@/lib/kds-reminder'

// ─── R64: opomnik nevarne cone (eskalacijski zvok) ────────────
// Naročila ≥ 25 min (rdeča cona OrderCard) dobijo zvočni opomnik
// vsakih 60 s, dokler ostajajo nebumpirana. Pregled na 15-s tiktaku
// (odzvno, poceni), interval pa nadzoruje shouldRemind (lib).
//
// ZAKAJ ref za getElapsed: session tiktaka `now` vsako SEKUNDO →
// getElapsed se tokstavljа vsako sekundo → če bi bil dep effecta,
// bi se 15-s interval RESTAL vsako sekundo in NIKOLI ne stekel.
// Ref drži svežo funkcijo, effect pa teče enkrat (vzorec iz
// use-kds-orders za WebSocket callback).
//
// Spoštuje preferenco zvoka (R63): isEnabled() se preverja ob vsakem
// pregledu — utišan zaslon ne opominja (in ne prekinja intervala).

interface ReminderOrder {
  firedAt: string | null
}

export function useKDSReminder(
  orders: ReminderOrder[],
  getElapsed: (dateStr: string | null) => number,
  isSoundEnabled: () => boolean,
  playReminder: () => void
) {
  const ordersRef = useRef(orders)
  const getElapsedRef = useRef(getElapsed)
  const lastRemindRef = useRef(0)

  useEffect(() => { ordersRef.current = orders }, [orders])
  useEffect(() => { getElapsedRef.current = getElapsed }, [getElapsed])

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsedList = ordersRef.current.map(o => getElapsedRef.current(o.firedAt))
      let danger = 0
      for (const m of elapsedList) {
        if (m >= KDS_DANGER_MINUTES) danger++
      }
      const now = Date.now()
      if (shouldRemind(now, lastRemindRef.current, danger, isSoundEnabled())) {
        lastRemindRef.current = now
        playReminder()
      }
    }, KDS_REMINDER_CHECK_MS)
    return () => clearInterval(iv)
  }, [isSoundEnabled, playReminder])
}
