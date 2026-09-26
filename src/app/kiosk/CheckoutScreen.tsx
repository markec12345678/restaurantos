'use client'

import { memo } from 'react'
import type { KioskCartItem } from './types'
import { formatEUR } from '@/lib/safe-format'
import { lineAmounts } from './useKioskCart'

// =====================================================================
// CHECKOUT zaslon — način servisiranja + plačilo + oddaja.
//  - dine-in (+ številka mize ≤10, obvezna) ALI takeout
//  - plačilo: kartica (privzeto) ALI gotovina → "Plačilo pri blagajni"
//  - oddaja: POST z idempotencyKey; napaka → banner + "Poskusi znova"
//    (ISTI ključ — retry istega submissiona; nova oddaja → nov ključ)
// =====================================================================

interface CheckoutScreenProps {
  cart: KioskCartItem[]
  total: number
  itemCount: number
  diningOption: 'dine-in' | 'takeout'
  setDiningOption: (_opt: 'dine-in' | 'takeout') => void
  tableNumber: string
  setTableNumber: (_table: string) => void
  paymentMethod: 'card' | 'cash'
  setPaymentMethod: (_method: 'card' | 'cash') => void
  submitting: boolean
  submitError: string
  unavailableNames: string[]
  onSubmit: () => void
  onBackToCart: () => void
}

export const CheckoutScreen = memo(function CheckoutScreen({
  cart, total, itemCount, diningOption, setDiningOption, tableNumber, setTableNumber,
  paymentMethod, setPaymentMethod, submitting, submitError, unavailableNames,
  onSubmit, onBackToCart,
}: CheckoutScreenProps) {
  const tableMissing = diningOption === 'dine-in' && tableNumber.trim().length === 0
  const canSubmit = !submitting && !tableMissing && itemCount > 0

  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-4 space-y-5">
      <h2 className="text-2xl font-bold">Zaključek naročila</h2>

      {unavailableNames.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800" role="alert">
          <p className="font-bold">Nekateri artikli so žal izprodani in so odstranjeni:</p>
          <p className="mt-1">{unavailableNames.join(', ')}</p>
        </div>
      )}

      {/* Način servisiranja */}
      <section aria-label="Način servisiranja" className="space-y-3">
        <h3 className="text-lg font-semibold">Kje boste jedli?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setDiningOption('dine-in')}
            aria-pressed={diningOption === 'dine-in'}
            className={`min-h-[80px] rounded-2xl border-2 text-xl font-bold transition active:scale-[0.98] touch-manipulation ${
              diningOption === 'dine-in'
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            🍽 V lokalu
          </button>
          <button
            onClick={() => setDiningOption('takeout')}
            aria-pressed={diningOption === 'takeout'}
            className={`min-h-[80px] rounded-2xl border-2 text-xl font-bold transition active:scale-[0.98] touch-manipulation ${
              diningOption === 'takeout'
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            🥡 S seboj
          </button>
        </div>

        {diningOption === 'dine-in' && (
          <div>
            <label htmlFor="kiosk-table" className="block text-base font-semibold text-gray-700 mb-2">
              Številka mize
            </label>
            <input
              id="kiosk-table"
              type="text"
              inputMode="numeric"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value.slice(0, 10))}
              maxLength={10}
              placeholder="npr. 12"
              className="w-full min-h-[64px] px-4 rounded-2xl text-2xl font-bold text-center bg-white border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
            />
            {tableMissing && (
              <p className="mt-2 text-sm font-semibold text-amber-600">Vnesite številko mize.</p>
            )}
          </div>
        )}
      </section>

      {/* Način plačila */}
      <section aria-label="Način plačila" className="space-y-3">
        <h3 className="text-lg font-semibold">Način plačila</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMethod('card')}
            aria-pressed={paymentMethod === 'card'}
            className={`min-h-[80px] rounded-2xl border-2 text-xl font-bold transition active:scale-[0.98] touch-manipulation ${
              paymentMethod === 'card'
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            💳 Kartica
          </button>
          <button
            onClick={() => setPaymentMethod('cash')}
            aria-pressed={paymentMethod === 'cash'}
            className={`min-h-[80px] rounded-2xl border-2 text-xl font-bold transition active:scale-[0.98] touch-manipulation ${
              paymentMethod === 'cash'
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            💵 Gotovina
          </button>
        </div>
        {paymentMethod === 'cash' && (
          <p className="text-base text-gray-600 bg-blue-50 border border-blue-200 rounded-xl p-3">
            Plačilo pri blagajni.
          </p>
        )}
      </section>

      {/* Povzetek */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
        {cart.map((item, idx) => {
          const la = lineAmounts(item)
          return (
            <div key={`${item.menuItemId}-${idx}`} className="flex justify-between text-base">
              <span className="text-gray-700">
                {item.quantity}× {item.name}
                {item.modifiers.length > 0 && (
                  <span className="text-gray-400"> ({item.modifiers.map(m => m.name).join(', ')})</span>
                )}
              </span>
              <span className="tabular-nums">{formatEUR(la.total)}</span>
            </div>
          )
        })}
        <div className="flex justify-between font-bold text-xl pt-2 border-t">
          <span>Skupaj ({itemCount} izdelkov)</span>
          <span className="text-blue-700 tabular-nums">{formatEUR(total)}</span>
        </div>
      </div>

      {submitError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-800" role="alert">
          <p className="font-bold">{submitError}</p>
          <p className="text-sm mt-1">Pritisnite &quot;Oddaj naročilo&quot; za ponovni poskus.</p>
        </div>
      )}

      {/* Oddaja */}
      <div className="flex flex-col gap-3 pb-4">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`w-full min-h-[80px] rounded-2xl text-2xl font-bold transition touch-manipulation ${
            canSubmit
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting
            ? 'Oddajam naročilo...'
            : tableMissing
              ? 'Vnesite številko mize'
              : <>Oddaj naročilo · {formatEUR(total)}</>}
        </button>
        <button
          onClick={onBackToCart}
          disabled={submitting}
          className="w-full min-h-[64px] rounded-2xl bg-gray-100 text-gray-700 text-lg font-semibold hover:bg-gray-200 disabled:opacity-50 active:scale-[0.98] transition touch-manipulation"
        >
          ← Košarica
        </button>
      </div>
    </main>
  )
})
