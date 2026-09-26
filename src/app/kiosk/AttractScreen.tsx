'use client'

import { memo } from 'react'

// =====================================================================
// ATTRACT zaslon — celozaslonska pozivnica "Dotaknite se za začetek".
// Celoten zaslon je dotik (64px+ pravilo trivialno izpolnjeno).
// Prikaze ime menija, če je na voljo (GET /api/public/kiosk ne vrača
// imena lokacije — samo menije; P1-11 privacy canon: brez notranjih podatkov).
// =====================================================================

interface AttractScreenProps {
  menuName?: string
  onStart: () => void
}

export const AttractScreen = memo(function AttractScreen({ menuName, onStart }: AttractScreenProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Dotaknite se za začetek naročanja"
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onStart()
        }
      }}
      className="min-h-dvh w-full flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900 px-6 cursor-pointer select-none touch-manipulation"
    >
      <span className="text-7xl mb-6" aria-hidden="true">🍽</span>
      <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-3">Samopostrežni kiosk</h1>
      {menuName && (
        <p className="text-xl md:text-2xl text-blue-700 font-semibold text-center mb-8">{menuName}</p>
      )}
      <div className="mt-8 w-56 h-56 md:w-64 md:h-64 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold text-center px-6 shadow-2xl shadow-blue-600/30 animate-pulse">
        Dotaknite se za začetek
      </div>
      <p className="mt-10 text-lg text-gray-500 text-center">
        Naročilo prevzamete na pulti
      </p>
    </div>
  )
})
