'use client'

import { memo, useEffect, useState } from 'react'
import type { KioskOrderResult } from './types'
import { formatEUR } from '@/lib/safe-format'

// =====================================================================
// CONFIRMATION zaslon — velika številka naročila #N (giant), znesek,
// "Prevzem naročila na pulti", način plačila, avtomatski reset čez 30 s
// + gumb "Zaključi". Reset → ATTRACT, košarica prazna (že počistena
// ob uspehu). Strežniški total je avtoriteten (kanon P1-8).
// =====================================================================

const CONFIRMATION_COUNTDOWN_S = 30

interface ConfirmationScreenProps {
  result: KioskOrderResult
  onFinish: () => void
}

export const ConfirmationScreen = memo(function ConfirmationScreen({ result, onFinish }: ConfirmationScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(CONFIRMATION_COUNTDOWN_S)

  // Avtomatski reset čez 30 s (kiosk mora povrniti ATTRACT za naslednjo stranko)
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft(s => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (secondsLeft === 0) onFinish()
  }, [secondsLeft, onFinish])

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-green-50 to-emerald-50 text-gray-900 px-6">
      <div className="max-w-lg w-full text-center bg-white rounded-3xl shadow-2xl p-10">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-green-700 mb-4">Naročilo sprejeto!</h1>
        <p className="text-lg text-gray-600">Številka naročila:</p>
        <p className="text-8xl font-mono font-extrabold text-blue-700 my-4 tabular-nums">#{result.orderNumber}</p>
        <p className="text-2xl font-bold text-gray-900">Skupaj: {formatEUR(result.total)}</p>
        <p className="text-lg text-gray-600 mt-4">Prevzem naročila na pulti</p>
        <p className="text-base text-gray-500 mt-1">
          {result.paymentMethod === 'gotovina' ? 'Plačilo pri blagajni' : 'Plačilo s kartico'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onFinish}
            className="w-full min-h-[64px] rounded-2xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition touch-manipulation"
          >
            Zaključi
          </button>
          <p className="text-sm text-gray-400">
            Kiosk se samodejno ponastavi čez{' '}
            <span className="font-bold tabular-nums">{secondsLeft}</span> s
          </p>
        </div>
      </div>
    </div>
  )
})
