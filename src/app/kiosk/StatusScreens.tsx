'use client'

import { memo } from 'react'

// =====================================================================
// Celozaslonska stanja kioska izven običajnega toka:
//  - KioskSplash: nalaganje menija
//  - ConfigErrorScreen: manjkajoč/neveljaven kontekst (loc+t), 404 GET/POST
//  - MenuErrorScreen: omrežna/strežniška napaka GET → "Poskusi znova"
//  - ClosedScreen: 403 (restavracija zaprta) → "Poskusi znova" (re-fetch menija)
//  - RateLimitScreen: 429 → "Preveč poskusov, počakajte trenutek"
// Vse: prijazne, celozaslonske, visok kontrast, 64px+ gumbi. Brez tehničnih
// detajlov in brez notranjih podatkov (P1-11 privacy canon).
// =====================================================================

export const KioskSplash = memo(function KioskSplash() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold">Nalagam meni...</p>
      </div>
    </div>
  )
})

/** Manjkajoč loc+t ALI 404 (neznana/tuja/neaktivna lokacija, rotiran token) */
export const ConfigErrorScreen = memo(function ConfigErrorScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 text-gray-900 px-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-10">
        <span className="text-6xl mb-6 block" aria-hidden="true">🛠</span>
        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          Kiosk ni pravilno nastavljen — kontaktirajte osebje
        </h1>
        <p className="text-lg text-gray-600">
          Prosimo, obvestite osebje restavracije.
        </p>
      </div>
    </div>
  )
})

export const MenuErrorScreen = memo(function MenuErrorScreen(props: { onRetry: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900 px-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-10">
        <span className="text-6xl mb-6 block" aria-hidden="true">📡</span>
        <h1 className="text-2xl font-bold mb-3">Napaka pri nalaganju menija</h1>
        <p className="text-lg text-gray-600 mb-8">Preverite povezavo in poskusite znova.</p>
        <button
          onClick={props.onRetry}
          className="w-full min-h-[64px] rounded-2xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition"
        >
          Poskusi znova
        </button>
      </div>
    </div>
  )
})

/** 403 — restavracija zaprta; retry ponovno naloži meni (kanon briefa) */
export const ClosedScreen = memo(function ClosedScreen(props: { onRetry: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900 px-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-10">
        <span className="text-6xl mb-6 block" aria-hidden="true">🔒</span>
        <h1 className="text-2xl font-bold mb-3">Trenutno zaprto</h1>
        <p className="text-lg text-gray-600 mb-8">
          Restavracija je trenutno zaprta. Naročila niso mogoča.
        </p>
        <button
          onClick={props.onRetry}
          className="w-full min-h-[64px] rounded-2xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition"
        >
          Poskusi znova
        </button>
      </div>
    </div>
  )
})

export const RateLimitScreen = memo(function RateLimitScreen(props: { onRetry: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900 px-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-10">
        <span className="text-6xl mb-6 block" aria-hidden="true">⏳</span>
        <h1 className="text-2xl font-bold mb-3">Preveč poskusov, počakajte trenutek</h1>
        <p className="text-lg text-gray-600 mb-8">Poskusite znova čez kratek čas.</p>
        <button
          onClick={props.onRetry}
          className="w-full min-h-[64px] rounded-2xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition"
        >
          Nadaljuj
        </button>
      </div>
    </div>
  )
})
