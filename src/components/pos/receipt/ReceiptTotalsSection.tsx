'use client'

import { memo } from 'react'
import { Separator } from '@/components/ui/separator'
import type { ReceiptData } from './constants'

// ============================================
// ZNESEKI RAČUNA — multi-DDV razčlenitev
// ============================================
export const ReceiptTotalsSection = memo(function ReceiptTotalsSection({
  receipt,
}: {
  receipt: ReceiptData
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span>Vmesna vsota (brez DDV):</span>
        <span>{receipt.subtotal.toFixed(2)}€</span>
      </div>

      {/* DDV po stopnjah */}
      {Object.entries(receipt.vatBreakdown).map(([rate, data]) => (
        <div key={rate} className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground pl-2">DDV {rate}% osnova:</span>
            <span className="text-muted-foreground">{data.base.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between">
            <span className="pl-2">DDV {rate}%:</span>
            <span>{data.vat.toFixed(2)}€</span>
          </div>
        </div>
      ))}

      <div className="flex justify-between font-medium">
        <span>Skupaj DDV:</span>
        <span>{receipt.totalVat.toFixed(2)}€</span>
      </div>

      {receipt.discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust:</span>
          <span>-{receipt.discount.toFixed(2)}€</span>
        </div>
      )}

      <Separator className="border-dashed my-1" />

      <div className="flex justify-between text-sm font-bold">
        <span>SKUPAJ Z DDV:</span>
        <span>{receipt.total.toFixed(2)}€</span>
      </div>

      {receipt.tip > 0 && (
        <>
          <div className="flex justify-between">
            <span>Napitnina:</span>
            <span>{receipt.tip.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>SKUPAJ Z NAPITNINO:</span>
            <span>{receipt.totalWithTip.toFixed(2)}€</span>
          </div>
        </>
      )}
    </div>
  )
})
