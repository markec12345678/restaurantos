'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// =====================================================================
// Idle reset kioska (epic #115 P1-11 — timeout/reset)
//  - 90 s neaktivnosti na MENU/CART/CHECKOUT → modal "Ste še tam?"
//  - modal: 20 s odštevanje; konec odštevanja ALI "Zaključi" → reset na
//    ATTRACT + prazna košarica; "Sem še tu" → nadaljuj (timer se resetira)
//  - vsak dotik (pointerdown/touchstart/keydown/wheel) resetira 90s timer
//    (med odprtim modalom odločitev eksplicitna prek gumbov — javna naprava,
//    naključni dotik ob tujcu ne sme podaljšati seje; interpretacija
//    "modal close → reset" = gumb "Zaključi")
// =====================================================================

const IDLE_TIMEOUT_MS = 90_000
const PROMPT_COUNTDOWN_S = 20

export interface IdleResetApi {
  promptVisible: boolean
  secondsLeft: number
  /** "Sem še tu" — nadaljuj sejo (timer se resetira) */
  keepWorking: () => void
  /** "Zaključi" — takojšnji reset (ATTRACT + prazna košarica) */
  endNow: () => void
}

export function useKioskIdleReset(opts: { enabled: boolean; onExpired: () => void }): IdleResetApi {
  const { enabled } = opts
  const [promptRequested, setPromptRequested] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(PROMPT_COUNTDOWN_S)
  const lastActivityRef = useRef(0)

  // Izpeljana vidnost modala: ko flow ni aktiven (attract/confirmation/fatal)
  // je prompt vedno skrit — brez setState v effect body
  // (react-hooks/set-state-in-effect kanon).
  const promptVisible = promptRequested && enabled

  // onExpired prek ref-a — brez re-subscriba listenerjev na vsak render
  const onExpiredRef = useRef(opts.onExpired)
  useEffect(() => {
    onExpiredRef.current = opts.onExpired
  }, [opts.onExpired])

  const keepWorking = useCallback(() => {
    lastActivityRef.current = Date.now()
    setPromptRequested(false)
    // Reset števca za naslednje odprtje modala (sicer 250 ms pokaže staro vrednost)
    setSecondsLeft(PROMPT_COUNTDOWN_S)
  }, [])

  const endNow = useCallback(() => {
    setPromptRequested(false)
    onExpiredRef.current()
  }, [])

  // Sledenje aktivnosti + 90s inactivity check (samo kadar je flow aktiven).
  // setState izključno znotraj interval callbacka (subscription pattern).
  useEffect(() => {
    if (!enabled) return
    lastActivityRef.current = Date.now()
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchstart', 'keydown', 'wheel']
    const markActivity = () => {
      lastActivityRef.current = Date.now()
    }
    for (const ev of events) {
      document.addEventListener(ev, markActivity, { passive: true })
    }
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        setPromptRequested(true)
      }
    }, 1000)
    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, markActivity)
      }
      window.clearInterval(interval)
    }
  }, [enabled])

  // 20s odštevanje v modalu — endAt absolutna meja, tick izračuna sekunde;
  // konec odštevanja → zapri modal + reset (vse znotraj tick callbacka)
  useEffect(() => {
    if (!promptVisible) return
    const endAt = Date.now() + PROMPT_COUNTDOWN_S * 1000
    const interval = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        window.clearInterval(interval)
        setPromptRequested(false)
        onExpiredRef.current()
      }
    }, 250)
    return () => window.clearInterval(interval)
  }, [promptVisible])

  return { promptVisible, secondsLeft, keepWorking, endNow }
}

/** Modal "Ste še tam?" — veliki gumbi, visok kontrast, z-60 nad vsemi dialogi */
export function IdleResetModal(props: { secondsLeft: number; onContinue: () => void; onEnd: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Ste še tam?"
        className="relative bg-white rounded-3xl shadow-2xl p-8 mx-4 max-w-md w-full text-center"
      >
        <p className="text-3xl font-bold text-gray-900 mb-2">Ste še tam?</p>
        <p className="text-lg text-gray-600 mb-6">
          Zaradi neaktivnosti bomo čez{' '}
          <span className="font-bold text-blue-700 tabular-nums">{props.secondsLeft}</span> s
          ponastavili kiosk. Košarica bo izpraznjena.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={props.onContinue}
            className="w-full min-h-[64px] rounded-2xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition"
          >
            Sem še tu
          </button>
          <button
            onClick={props.onEnd}
            className="w-full min-h-[64px] rounded-2xl bg-gray-100 text-gray-700 text-lg font-semibold hover:bg-gray-200 active:scale-[0.98] transition"
          >
            Zaključi
          </button>
        </div>
      </div>
    </div>
  )
}
