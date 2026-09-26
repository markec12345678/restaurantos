'use client'

import { memo, useState } from 'react'
import type { KioskCartItem } from './types'
import { formatEUR } from '@/lib/safe-format'
import { lineAmounts } from './useKioskCart'

// =====================================================================
// CART zaslon — urejanje količin, odstranjevanje, opombe per postavka.
// Prikazane so SAMO strankine informacije: artikel, količina, cena,
// vmesna vsota, DDV (opcionalen razčlen, P1-11 privacy canon) in skupaj.
// Brez stroškov, brez staff podatkov, brez notranjih opomb.
// =====================================================================

interface CartScreenProps {
  cart: KioskCartItem[]
  subtotalNet: number
  vat: number
  total: number
  unavailableNames: string[]
  onUpdateQuantity: (_index: number, _delta: number) => void
  onRemove: (_index: number) => void
  onSetNote: (_index: number, _note: string) => void
  onBackToMenu: () => void
  onCheckout: () => void
}

export const CartScreen = memo(function CartScreen({
  cart, subtotalNet, vat, total, unavailableNames,
  onUpdateQuantity, onRemove, onSetNote, onBackToMenu, onCheckout,
}: CartScreenProps) {
  // Katera postavka ima odprto okno za opombo (indeks vrstice)
  const [notesOpenFor, setNotesOpenFor] = useState<number | null>(null)

  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-2xl font-bold">Košarica</h2>

      {unavailableNames.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800" role="alert">
          <p className="font-bold">Nekateri artikli so žal izprodani in so odstranjeni:</p>
          <p className="mt-1">{unavailableNames.join(', ')}</p>
          <p className="text-sm mt-1">Meni je bil osvežen.</p>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-6xl mb-3" aria-hidden="true">🛒</p>
          <p className="text-xl text-gray-500">Košarica je prazna</p>
          <button
            onClick={onBackToMenu}
            className="mt-6 min-h-[64px] px-8 rounded-2xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 active:scale-[0.98] transition touch-manipulation"
          >
            Nazaj na meni
          </button>
        </div>
      ) : (
        <>
          {cart.map((item, idx) => {
            const la = lineAmounts(item)
            const notesOpen = notesOpenFor === idx
            return (
              <div key={`${item.menuItemId}-${idx}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg" title={item.name}>{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        + {item.modifiers.map(m => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && !notesOpen && (
                      <p className="text-sm italic text-gray-400 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <span className="font-bold text-lg text-right tabular-nums">{formatEUR(la.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(idx, -1)}
                      aria-label={`Zmanjšaj količino: ${item.name}`}
                      className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center text-2xl font-bold touch-manipulation active:scale-95 transition"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-bold text-xl tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(idx, 1)}
                      aria-label={`Povečaj količino: ${item.name}`}
                      className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold touch-manipulation active:scale-95 transition"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNotesOpenFor(notesOpen ? null : idx)}
                      className="min-h-[64px] px-4 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 active:scale-95 transition touch-manipulation"
                      aria-expanded={notesOpen}
                    >
                      {item.notes ? '✏ Opomba' : '＋ Opomba'}
                    </button>
                    <button
                      onClick={() => { onRemove(idx); setNotesOpenFor(null) }}
                      aria-label={`Odstrani ${item.name} iz košarice`}
                      className="w-16 h-16 rounded-2xl text-red-500 hover:bg-red-50 flex items-center justify-center text-2xl touch-manipulation active:scale-95 transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {notesOpen && (
                  <textarea
                    value={item.notes}
                    onChange={e => onSetNote(idx, e.target.value)}
                    rows={2}
                    maxLength={200}
                    placeholder="Opomba za to postavko (neobvezno)..."
                    className="mt-3 w-full px-4 py-3 rounded-xl text-base bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  />
                )}
              </div>
            )
          })}

          {/* Povzetek — samo strankine informacije (privacy canon) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <div className="flex justify-between text-base">
              <span className="text-gray-500">Vmesna vsota</span>
              <span className="tabular-nums">{formatEUR(subtotalNet)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-500">DDV</span>
              <span className="tabular-nums">{formatEUR(vat)}</span>
            </div>
            <div className="flex justify-between font-bold text-xl pt-2 border-t">
              <span>Skupaj</span>
              <span className="text-blue-700 tabular-nums">{formatEUR(total)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onBackToMenu}
              className="flex-1 min-h-[64px] rounded-2xl bg-gray-100 text-gray-700 text-lg font-semibold hover:bg-gray-200 active:scale-[0.98] transition touch-manipulation"
            >
              ← Meni
            </button>
            <button
              onClick={onCheckout}
              className="flex-1 min-h-[64px] rounded-2xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 active:scale-[0.98] transition touch-manipulation"
            >
              Nadaljuj →
            </button>
          </div>
        </>
      )}
    </main>
  )
})
