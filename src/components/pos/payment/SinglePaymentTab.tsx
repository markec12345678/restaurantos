'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { paymentMethods } from './constants'
import { CashPaymentSection } from './CashPaymentSection'
import { GiftCardSection } from './GiftCardSection'
import { LoyaltySection } from './LoyaltySection'
import { AlternatePaymentSection } from './AlternatePaymentSection'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import type { GiftCardItem, LoyaltyAccountItem, AltPaymentItem } from './types'

// ============================================
// ZAVIHEK: ENO PLAČILO
// ============================================

interface SinglePaymentTabProps {
  paymentMethod: string
  setPaymentMethod: (_val: string) => void
  totalWithTip: number
  isPending: boolean
  onPay: () => void
  // CashPaymentSection
  cashReceived: number
  setCashReceived: (_val: number) => void
  setTipAmount: (_val: number) => void
  setTipPercent: (_val: number) => void
  // GiftCardSection
  giftCards: GiftCardItem[]
  giftCardNumber: string
  setGiftCardNumber: (_val: string) => void
  selectedGiftCardId: string | null
  setSelectedGiftCardId: (_val: string | null) => void
  // LoyaltySection
  loyaltyResults: LoyaltyAccountItem[]
  loyaltySearch: string
  setLoyaltySearch: (_val: string) => void
  selectedLoyaltyId: string | null
  setSelectedLoyaltyId: (_val: string | null) => void
  // AlternatePaymentSection
  altPayments: AltPaymentItem[]
  selectedAltPayment: string
  setSelectedAltPayment: (_val: string) => void
}

export const SinglePaymentTab = memo(function SinglePaymentTab({
  paymentMethod,
  setPaymentMethod,
  totalWithTip,
  isPending,
  onPay,
  cashReceived,
  setCashReceived,
  setTipAmount,
  setTipPercent,
  giftCards,
  giftCardNumber,
  setGiftCardNumber,
  selectedGiftCardId,
  setSelectedGiftCardId,
  loyaltyResults,
  loyaltySearch,
  setLoyaltySearch,
  selectedLoyaltyId,
  setSelectedLoyaltyId,
  altPayments,
  selectedAltPayment,
  setSelectedAltPayment,
}: SinglePaymentTabProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-2">Način plačila</p>
        <div className="grid grid-cols-3 gap-2">
          {paymentMethods.map(pm => {
            const Icon = pm.icon
            const isSelected = paymentMethod === pm.id
            return (
              <button
                key={pm.id}
                onClick={() => setPaymentMethod(pm.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-[11px] font-semibold">{pm.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {/* FIX M-14: Hitri zneski za gotovino z vračilom */}
      {paymentMethod === 'cash' && (
        <CashPaymentSection
          totalWithTip={totalWithTip}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          setTipAmount={setTipAmount}
          setTipPercent={setTipPercent}
        />
      )}
      {/* Darilna kartica izbira */}
      {paymentMethod === 'giftcard' && (
        <GiftCardSection
          giftCards={giftCards}
          giftCardNumber={giftCardNumber}
          setGiftCardNumber={setGiftCardNumber}
          selectedGiftCardId={selectedGiftCardId}
          setSelectedGiftCardId={setSelectedGiftCardId}
        />
      )}
      {/* Zvestobni račun */}
      {paymentMethod === 'loyalty' && (
        <LoyaltySection
          loyaltyResults={loyaltyResults}
          loyaltySearch={loyaltySearch}
          setLoyaltySearch={setLoyaltySearch}
          selectedLoyaltyId={selectedLoyaltyId}
          setSelectedLoyaltyId={setSelectedLoyaltyId}
        />
      )}
      {/* Alternativno plačilo */}
      {paymentMethod === 'alternate' && (
        <AlternatePaymentSection
          altPayments={altPayments}
          selectedAltPayment={selectedAltPayment}
          setSelectedAltPayment={setSelectedAltPayment}
        />
      )}
      <Button
        className="w-full h-12 text-base font-bold"
        disabled={!paymentMethod || isPending}
        onClick={onPay}
      >
        {isPending ? (
          'Obdelujem...'
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Plačaj €{safeToFixed(totalWithTip, 2)} ({paymentMethods.find(p => p.id === paymentMethod)?.label || ''})
          </>
        )}
      </Button>
    </div>
  )
})
