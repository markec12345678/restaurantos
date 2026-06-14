'use client'

import { memo } from 'react'
import type { OrderResultRow } from '@/lib/types'
import type { CartItem, OrderType, DeliveryDetails, TakeoutDetails, DeliveryZoneInfo, PromoResult, MenuItem, Modifier, ModifierGroup } from './types'

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
                ✓ Cona dostave: {deliveryZone.name} — dostava €{deliveryZone.deliveryFee.toFixed(2)} • {deliveryZone.estimatedMinutes} min
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

// =====================================================================
// PLAČILO
// =====================================================================

interface PaymentStepProps {
  isDark: boolean
  cart: CartItem[]
  orderType: OrderType
  deliveryZone: DeliveryZoneInfo | null
  getDeliveryFee: () => number
  promoResult: PromoResult | null
  total: number
  promoCode: string
  setPromoCode: (_code: string) => void
  setPromoResult: (_result: PromoResult | null) => void
  promoLoading: boolean
  checkPromoCode: () => void
  paymentMethod: 'card' | 'cash' | 'mobile'
  setPaymentMethod: (_method: 'card' | 'cash' | 'mobile') => void
  orderSending: boolean
  placeOrder: () => void
  setStep: (_step: 'menu' | 'cart' | 'details' | 'payment' | 'confirmation') => void
}

export const PaymentStep = memo(function PaymentStep({
  isDark, cart, orderType, deliveryZone, getDeliveryFee, promoResult, total,
  promoCode, setPromoCode, setPromoResult, promoLoading, checkPromoCode,
  paymentMethod, setPaymentMethod, orderSending, placeOrder, setStep,
}: PaymentStepProps) {
  const inputClass = `px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`

  return (
    <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold">💳 Plačilo</h2>

      {/* Povzetek naročila */}
      <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} rounded-xl border p-4`}>
        <h3 className="font-semibold text-sm mb-2">Povzetek naročila</h3>
        {cart.map((item, idx) => {
          const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0)
          const priceWithVat = (item.menuItem.price + modPrice) * (1 + item.menuItem.vatRate / 100)
          return (
            <div key={idx} className="flex justify-between text-sm py-1">
              <span>{item.quantity}× {item.menuItem.name}</span>
              <span>€{(priceWithVat * item.quantity).toFixed(2)}</span>
            </div>
          )
        })}
        {orderType === 'delivery' && (
          <div className="flex justify-between text-sm py-1 text-gray-500">
            <span>Dostava{deliveryZone ? ` (${deliveryZone.name})` : ''}</span>
            <span>{getDeliveryFee() === 0 ? <span className="text-green-600">Brezplačno</span> : `€${getDeliveryFee().toFixed(2)}`}</span>
          </div>
        )}
        {promoResult?.valid && promoResult.discount && (
          <div className="flex justify-between text-sm py-1 text-green-600">
            <span>🏷 {promoResult.discount.description}</span>
            <span>-€{promoResult.discount.discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t">
          <span>Skupaj</span>
          <span className="text-blue-600">€{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Promo koda */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Promo koda</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Vnesi kodo..." value={promoCode}
            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
            className={`flex-1 ${inputClass}`}
          />
          <button onClick={checkPromoCode} disabled={!promoCode.trim() || promoLoading}
            className="px-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 text-sm"
          >
            {promoLoading ? '...' : 'Uporabi'}
          </button>
        </div>
        {promoResult && (
          <p className={`text-xs ${promoResult.valid ? 'text-green-600' : 'text-red-500'}`}>
            {promoResult.valid ? `✓ ${promoResult.discount?.description} (-€${promoResult.discount?.discountAmount.toFixed(2)})` : `✕ ${promoResult.message}`}
          </p>
        )}
      </div>

      {/* Način plačila */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Način plačila</h3>
        {[
          { value: 'card' as const, label: 'Kartica', icon: '💳', desc: 'Visa, Mastercard, Maestro' },
          { value: 'mobile' as const, label: 'Mobilno plačilo', icon: '📱', desc: 'Apple Pay, Google Pay' },
          { value: 'cash' as const, label: 'Gotovina', icon: '💵', desc: orderType === 'delivery' ? 'Plačilo ob dostavi' : 'Plačilo ob prevzemu' },
        ].map(pm => (
          <button
            key={pm.value}
            onClick={() => setPaymentMethod(pm.value)}
            className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition ${
              paymentMethod === pm.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : `${isDark ? 'border-gray-700' : 'border-gray-200'} hover:border-blue-300`
            }`}
          >
            <span className="text-2xl">{pm.icon}</span>
            <div>
              <p className="font-semibold text-sm">{pm.label}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{pm.desc}</p>
            </div>
            {paymentMethod === pm.value && <span className="ml-auto text-blue-600 font-bold">✓</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep('details')} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          ← Podatki
        </button>
        <button onClick={placeOrder} disabled={orderSending}
          className="flex-1 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
        >
          {orderSending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Pošiljam...
            </span>
          ) : (
            `Potrdi naročilo • €${total.toFixed(2)}`
          )}
        </button>
      </div>
    </main>
  )
})

// =====================================================================
// POTRDITEV NAROČILA
// =====================================================================

interface ConfirmationViewProps {
  isDark: boolean
  orderResult: OrderResultRow | null
  orderType: OrderType
  deliveryDetails: DeliveryDetails
  total: number
  paymentMethod: 'card' | 'cash' | 'mobile'
  resetAfterConfirmation: () => void
  ESTIMATED_DELIVERY_MIN: number
  ESTIMATED_TAKEOUT_MIN: number
}

export const ConfirmationView = memo(function ConfirmationView({
  isDark, orderResult, orderType, deliveryDetails, total,
  paymentMethod, resetAfterConfirmation, ESTIMATED_DELIVERY_MIN, ESTIMATED_TAKEOUT_MIN,
}: ConfirmationViewProps) {
  if (!orderResult) return null
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-green-50 to-emerald-50'}`}>
      <div className={`max-w-md mx-auto p-8 rounded-3xl shadow-2xl text-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">Naročilo sprejeto!</h2>
        <p className="text-gray-600 mb-1">Številka naročila:</p>
        <p className="text-3xl font-mono font-bold text-blue-600 mb-3">#{orderResult.order?.orderNumber}</p>
        <p className="text-gray-500 text-sm mb-2">
          {orderType === 'delivery'
            ? `Predviden čas dostave: ${ESTIMATED_DELIVERY_MIN}-${ESTIMATED_DELIVERY_MIN + 15} min`
            : `Prevzem čez: ${ESTIMATED_TAKEOUT_MIN}-${ESTIMATED_TAKEOUT_MIN + 10} min`}
        </p>
        {orderType === 'delivery' && (
          <p className="text-gray-500 text-sm">Dostava na: {deliveryDetails.address}, {deliveryDetails.city}</p>
        )}
        <p className="text-lg font-bold text-green-700 mt-4">Skupaj: €{total.toFixed(2)}</p>
        <div className="mt-2 text-sm text-gray-500">
          {paymentMethod === 'card' && 'Plačilo s kartico ✓'}
          {paymentMethod === 'cash' && 'Plačilo ob prevzemu (gotovina)'}
          {paymentMethod === 'mobile' && 'Plačilo z mobilno napravo ✓'}
        </div>
        <a href={`/order/${orderResult.order?.id}`}
          className="mt-4 block bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-indigo-700 transition text-center"
        >
          📍 Sledi naročilu
        </a>
        <button onClick={resetAfterConfirmation}
          className="mt-3 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition"
        >
          Naroči še
        </button>
      </div>
    </div>
  )
})

// =====================================================================
// MODAL ZA PODROBNOSTI ARTIKLA
// =====================================================================

interface ItemDetailModalProps {
  isDark: boolean
  showItemDetail: MenuItem
  itemNotes: string
  setItemNotes: (_notes: string) => void
  selectedMods: Modifier[]
  toggleModifier: (_mod: Modifier, _group: ModifierGroup) => void
  addToCart: (_item: MenuItem, _modifiers?: Modifier[], _notes?: string) => void
  setShowItemDetail: (_item: MenuItem | null) => void
}

export const ItemDetailModal = memo(function ItemDetailModal({
  isDark, showItemDetail, itemNotes, setItemNotes, selectedMods,
  toggleModifier, addToCart, setShowItemDetail,
}: ItemDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
      <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">{showItemDetail.name}</h3>
          <button onClick={() => setShowItemDetail(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          {showItemDetail.image && (
            <img src={showItemDetail.image} alt={showItemDetail.name} className="w-full h-48 object-cover rounded-xl" />
          )}
          {showItemDetail.description && <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{showItemDetail.description}</p>}
          <p className={`font-bold text-lg ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            €{(showItemDetail.price * (1 + showItemDetail.vatRate / 100)).toFixed(2)} <span className="text-xs text-gray-400">z DDV</span>
          </p>

          {showItemDetail.modifierGroups?.map(mg => (
            <div key={mg.modifierGroup.id}>
              <p className="font-semibold text-sm mb-2">
                {mg.modifierGroup.name}
                {mg.modifierGroup.required && <span className="text-red-500 ml-1">*Obvezno</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {mg.modifierGroup.modifiers.map(mod => {
                  const selected = selectedMods.some(m => m.id === mod.id)
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModifier(mod, mg.modifierGroup)}
                      className={`p-2 rounded-xl border text-left text-sm transition ${
                        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : `${isDark ? 'border-gray-700' : 'border-gray-200'}`
                      }`}
                    >
                      <span className="font-medium">{mod.name}</span>
                      {mod.price > 0 && <span className="text-xs text-gray-500 ml-1">+€{mod.price.toFixed(2)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <textarea
            placeholder="Opombe za to jed..."
            value={itemNotes}
            onChange={e => setItemNotes(e.target.value)}
            rows={2}
            className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`}
          />

          <button
            onClick={() => addToCart(showItemDetail, selectedMods, itemNotes)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Dodaj v košarico
          </button>
        </div>
      </div>
    </div>
  )
})
