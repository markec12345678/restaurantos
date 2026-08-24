'use client'

import { memo, useState, useMemo } from 'react'
import type { OrderType, DeliveryDetails, TakeoutDetails, DeliveryZoneInfo } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { validateDeliveryDetails, validateTakeoutDetails } from './validation'

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
  // FIX: lokalno stanje `touched` — error se prikaže šele, ko uporabnik
  // zapusti polje ali poskusi nadaljevati. Prejšnja koda ni imela validacije
  // formatov — samo boolean isValid preverjanje praznih polj.
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const deliveryErrors = useMemo(
    () => validateDeliveryDetails(deliveryDetails),
    [deliveryDetails]
  )
  const takeoutErrors = useMemo(
    () => validateTakeoutDetails(takeoutDetails),
    [takeoutDetails]
  )

  const deliveryValid = Object.keys(deliveryErrors).length === 0 && !!deliveryZone
  const takeoutValid = Object.keys(takeoutErrors).length === 0
  const canProceed = orderType === 'delivery' ? deliveryValid : takeoutValid

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }))
  const markAllTouched = () => {
    if (orderType === 'delivery') {
      setTouched({ 'delivery.fullName': true, 'delivery.phone': true, 'delivery.email': true, 'delivery.address': true, 'delivery.city': true, 'delivery.postCode': true })
    } else {
      setTouched({ 'takeout.fullName': true, 'takeout.phone': true, 'takeout.email': true, 'takeout.preferredTime': true })
    }
  }

  const showDeliveryError = (field: keyof typeof deliveryErrors) => touched[`delivery.${field}`] && deliveryErrors[field]
  const showTakeoutError = (field: keyof typeof takeoutErrors) => touched[`takeout.${field}`] && takeoutErrors[field]

  const fieldClass = (hasError: boolean) =>
    `px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} ${hasError ? 'border-red-500 focus:ring-red-500/50' : 'focus:ring-blue-500/50'} border focus:ring-2 focus:outline-none`

  return (
    <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold">{orderType === 'delivery' ? '📦 Podatki za dostavo' : '🛍 Podatki za prevzem'}</h2>

      {orderType === 'delivery' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Ime in priimek *"
                value={deliveryDetails.fullName}
                onChange={e => setDeliveryDetails(p => ({ ...p, fullName: e.target.value }))}
                onBlur={() => markTouched('delivery.fullName')}
                aria-invalid={!!showDeliveryError('fullName')}
                aria-describedby={showDeliveryError('fullName') ? 'delivery-fullName-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('fullName'))} w-full`}
              />
              {showDeliveryError('fullName') && <p id="delivery-fullName-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.fullName}</p>}
            </div>
            <div>
              <input
                type="tel"
                placeholder="Telefon *"
                value={deliveryDetails.phone}
                onChange={e => setDeliveryDetails(p => ({ ...p, phone: e.target.value }))}
                onBlur={() => markTouched('delivery.phone')}
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={!!showDeliveryError('phone')}
                aria-describedby={showDeliveryError('phone') ? 'delivery-phone-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('phone'))} w-full`}
              />
              {showDeliveryError('phone') && <p id="delivery-phone-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.phone}</p>}
            </div>
            <div>
              <input
                type="email"
                placeholder="E-pošta"
                value={deliveryDetails.email}
                onChange={e => setDeliveryDetails(p => ({ ...p, email: e.target.value }))}
                onBlur={() => markTouched('delivery.email')}
                inputMode="email"
                autoComplete="email"
                aria-invalid={!!showDeliveryError('email')}
                aria-describedby={showDeliveryError('email') ? 'delivery-email-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('email'))} w-full`}
              />
              {showDeliveryError('email') && <p id="delivery-email-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.email}</p>}
            </div>
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Naslov *"
                value={deliveryDetails.address}
                onChange={e => setDeliveryDetails(p => ({ ...p, address: e.target.value }))}
                onBlur={() => markTouched('delivery.address')}
                autoComplete="street-address"
                aria-invalid={!!showDeliveryError('address')}
                aria-describedby={showDeliveryError('address') ? 'delivery-address-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('address'))} w-full`}
              />
              {showDeliveryError('address') && <p id="delivery-address-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.address}</p>}
            </div>
            <div>
              <input
                type="text"
                placeholder="Mesto *"
                value={deliveryDetails.city}
                onChange={e => { setDeliveryDetails(p => ({ ...p, city: e.target.value })); if (deliveryDetails.postCode) checkDeliveryZone(deliveryDetails.postCode, e.target.value) }}
                onBlur={() => markTouched('delivery.city')}
                autoComplete="address-level2"
                aria-invalid={!!showDeliveryError('city')}
                aria-describedby={showDeliveryError('city') ? 'delivery-city-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('city'))} w-full`}
              />
              {showDeliveryError('city') && <p id="delivery-city-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.city}</p>}
            </div>
            <div>
              <input
                type="text"
                placeholder="Poštna št. *"
                value={deliveryDetails.postCode}
                onChange={e => { setDeliveryDetails(p => ({ ...p, postCode: e.target.value })); if (e.target.value.length >= 4) checkDeliveryZone(e.target.value, deliveryDetails.city) }}
                onBlur={() => markTouched('delivery.postCode')}
                inputMode="numeric"
                autoComplete="postal-code"
                aria-invalid={!!showDeliveryError('postCode')}
                aria-describedby={showDeliveryError('postCode') ? 'delivery-postCode-error' : undefined}
                className={`${fieldClass(!!showDeliveryError('postCode'))} w-full`}
              />
              {showDeliveryError('postCode') && <p id="delivery-postCode-error" role="alert" className="text-xs text-red-500 mt-1">{deliveryErrors.postCode}</p>}
            </div>
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
          <textarea placeholder="Opombe za dostavo (zvonec, nadstropje...)" value={deliveryDetails.notes} onChange={e => setDeliveryDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full ${fieldClass(false)}`} />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="Ime in priimek *"
              value={takeoutDetails.fullName}
              onChange={e => setTakeoutDetails(p => ({ ...p, fullName: e.target.value }))}
              onBlur={() => markTouched('takeout.fullName')}
              aria-invalid={!!showTakeoutError('fullName')}
              aria-describedby={showTakeoutError('fullName') ? 'takeout-fullName-error' : undefined}
              className={`${fieldClass(!!showTakeoutError('fullName'))} w-full`}
            />
            {showTakeoutError('fullName') && <p id="takeout-fullName-error" role="alert" className="text-xs text-red-500 mt-1">{takeoutErrors.fullName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="tel"
                placeholder="Telefon *"
                value={takeoutDetails.phone}
                onChange={e => setTakeoutDetails(p => ({ ...p, phone: e.target.value }))}
                onBlur={() => markTouched('takeout.phone')}
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={!!showTakeoutError('phone')}
                aria-describedby={showTakeoutError('phone') ? 'takeout-phone-error' : undefined}
                className={`${fieldClass(!!showTakeoutError('phone'))} w-full`}
              />
              {showTakeoutError('phone') && <p id="takeout-phone-error" role="alert" className="text-xs text-red-500 mt-1">{takeoutErrors.phone}</p>}
            </div>
            <div>
              <input
                type="email"
                placeholder="E-pošta"
                value={takeoutDetails.email}
                onChange={e => setTakeoutDetails(p => ({ ...p, email: e.target.value }))}
                onBlur={() => markTouched('takeout.email')}
                inputMode="email"
                autoComplete="email"
                aria-invalid={!!showTakeoutError('email')}
                aria-describedby={showTakeoutError('email') ? 'takeout-email-error' : undefined}
                className={`${fieldClass(!!showTakeoutError('email'))} w-full`}
              />
              {showTakeoutError('email') && <p id="takeout-email-error" role="alert" className="text-xs text-red-500 mt-1">{takeoutErrors.email}</p>}
            </div>
          </div>
          <div>
            <input
              type="time"
              placeholder="Želen čas prevzema"
              value={takeoutDetails.preferredTime}
              onChange={e => setTakeoutDetails(p => ({ ...p, preferredTime: e.target.value }))}
              onBlur={() => markTouched('takeout.preferredTime')}
              className={`${fieldClass(!!showTakeoutError('preferredTime'))} w-full`}
            />
            {showTakeoutError('preferredTime') && <p role="alert" className="text-xs text-red-500 mt-1">{takeoutErrors.preferredTime}</p>}
          </div>
          <textarea placeholder="Opombe" value={takeoutDetails.notes} onChange={e => setTakeoutDetails(p => ({ ...p, notes: e.target.value }))} rows={2} className={`w-full ${fieldClass(false)}`} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setStep('cart')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          ← Košarica
        </button>
        <button
          onClick={() => { if (!canProceed) { markAllTouched(); return } setStep('payment') }}
          disabled={!canProceed}
          className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Plačilo →
        </button>
      </div>
    </main>
  )
})
