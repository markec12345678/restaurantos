'use client'

import { memo } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import type { TranslationValue } from '../translations'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface CartFooterProps {
  t: TranslationValue
  cartTotal: number
  cartTax: number
  submitting: boolean
  submitOrder: () => Promise<void>
}

export const CartFooter = memo(function CartFooter({
  t,
  cartTotal,
  cartTax,
  submitting,
  submitOrder,
}: CartFooterProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.subtotal}</span>
          <span>{safeToFixed(cartTotal - cartTax, 2)} {t.currency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t.vat}</span>
          <span>{safeToFixed(cartTax, 2)} {t.currency}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200 dark:border-gray-800">
          <span>{t.total}</span>
          <span className="text-amber-600">{safeToFixed(cartTotal, 2)} {t.currency}</span>
        </div>
      </div>

      <button
        onClick={submitOrder}
        disabled={submitting}
        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {t.ordering}
          </>
        ) : (
          <>
            {t.confirmOrder}
            <ChevronRight className="h-5 w-5" />
          </>
        )}
      </button>
    </div>
  )
})
