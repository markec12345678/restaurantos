'use client'

import { memo } from 'react'
import type { OrderType, DeliveryDetails, TakeoutDetails, DeliveryZoneInfo } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// =====================================================================
// PODATKI ZA DOSTAVO / PREVZEM
// =====================================================================

interface DetailsStepProps {
  isDark: boolean
  orderType: OrderType
  deliveryDetails: DeliveryDetails
  setDeliveryDetails: (_fn: DeliveryDetails | ((_prev: DeliveryDetails) => DeliveryDetails)) => void
  takeoutDetails: TakeoutDetails
  setTakeoutDetails: (_fn: TakeoutDetails | ((_prev: TakeoutDetails) => TakeoutDetails)) => void
  deliveryZone: DeliveryZoneInfo | null
  deliveryZoneChecked: boolean
  checkDeliveryZone: (_postCode: string, _city: string) => void
  setStep: (_step: 'menu' | 'cart' | 'details' | 'payment' | 'confirmation') => void
}

export const DetailsStep = memo(function DetailsStep({
  isDark, orderType, deliveryDetails, setDeliveryDetails,
  takeoutDetails, setTakeoutDetails, deliveryZone, deliveryZoneChecked,
  checkDeliveryZone, setStep,
}: DetailsStepProps) {
  const inputClass = `px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`

  return (
    <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold">{orderType === 'delivery' ? '📦 Podatki za dostavo' : '🛍 Podatki za prevzem'}</h2>

      {orderType === 'delivery' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Ime in priimek *" value={deliveryDetails.fullName} onChange={e => setDeliveryDetails(p => ({ ...p, fullName: e.target.value }))} className={`${inputClass} col-span-2`} />
            <input type="tel" placeholder="Telefon *" value={deliveryDetails.phone} onChange={e => setDeliveryDetails(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
            <input type="email" placeholder="E-pošta" value={deliveryDetails.email} onChange={e => setDeliveryDetails(p => ({ ...p, email: e.target.value }))} className={inputClass} />
            <input type="text" placeholder="Naslov *" value={deliveryDetails.address} onChange={e => setDeliveryDetails(p => ({ ...p, address: e.target.value }))} className={`${inputClass} col-span-2`} />
            <input type="text" placeholder="Mesto *" value={deliveryDetails.city} onChange={e => { setDeliveryDetails(p => ({ ...p, city: e.target.value })); if (deliveryDetails.postCode) checkDeliveryZone(deliveryDetails.postCode, e.target.value) }} className={inputClass} />
            <input type="text" placeholder="Poštna št. *" value={deliveryDetails.postCode} onChange={e => { setDeliveryDetails(p => ({ ...p, postCode: e.target.value })); if (e.target.value.length >= 4) checkDeliveryZone(e.target.value, deliveryDetails.city) }} className={inputClass} />
            {deliveryZoneChecked && !deliveryZone && deliveryDetails.postCode.length >= 4 && (
              <div className="col-span-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                ⚠️ Na ta naslov ne dostavljamo. Izberite prevzem na lokaciji.
              </div>
            )}
            {deliveryZone && (
              <div className="col-span-2 p-2 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700">
                ✓ Cona dostave: {deliveryZone.name} — dostava €{safeToFixed(deliveryZone.deliveryFee, 2)} • {deliveryZone.estimatedMinutes} min
              </div>
            )}
          </div>
          <textarea placeholder="Opombe za dostavo (zvonec, nadstropje...)" value={deliveryDetails.notes} onChange={e => setDeliveryDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full ${inputClass}`} />
        </div>
      ) : (
        <div className="space-y-3">
          <input type="text" placeholder="Ime in priimek *" value={takeoutDetails.fullName} onChange={e => setTakeoutDetails(p => ({ ...p, fullName: e.target.value }))} className={`w-full ${inputClass}`} />
          <div className="grid grid-cols-2 gap-3">
            <input type="tel" placeholder="Telefon *" value={takeoutDetails.phone} onChange={e => setTakeoutDetails(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
            <input type="email" placeholder="E-pošta" value={takeoutDetails.email} onChange={e => setTakeoutDetails(p => ({ ...p, email: e.target.value }))} className={inputClass} />
          </div>
          <input type="time" placeholder="Želen čas prevzema" value={takeoutDetails.preferredTime} onChange={e => setTakeoutDetails(p => ({ ...p, preferredTime: e.target.value }))} className={`w-full ${inputClass}`} />
          <textarea placeholder="Opombe" value={takeoutDetails.notes} onChange={e => setTakeoutDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full ${inputClass}`} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setStep('cart')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          ← Košarica
        </button>
        <button
          onClick={() => setStep('payment')}
          disabled={orderType === 'delivery' ? !deliveryDetails.fullName || !deliveryDetails.phone || !deliveryDetails.address || !deliveryDetails.city || (deliveryZoneChecked && !deliveryZone) : !takeoutDetails.fullName || !takeoutDetails.phone}
          className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Plačilo →
        </button>
      </div>
    </main>
  )
})
