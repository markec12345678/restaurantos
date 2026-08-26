'use client'

import { memo } from 'react'
import { Separator } from '@/components/ui/separator'
import type { ReceiptData } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

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
        <span>{safeToFixed(receipt.subtotal, 2)}€</span>
      </div>

      {/* DDV po stopnjah */}
      {Object.entries(receipt.vatBreakdown).map(([rate, data]) => (
        <div key={rate} className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground pl-2">DDV {rate}% osnova:</span>
            <span className="text-muted-foreground">{safeToFixed(data.base, 2)}€</span>
          </div>
          <div className="flex justify-between">
            <span className="pl-2">DDV {rate}%:</span>
            <span>{safeToFixed(data.vat, 2)}€</span>
          </div>
        </div>
      ))}

      <div className="flex justify-between font-medium">
        <span>Skupaj DDV:</span>
        <span>{safeToFixed(receipt.totalVat, 2)}€</span>
      </div>

      {receipt.discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust:</span>
          <span>-{safeToFixed(receipt.discount, 2)}€</span>
        </div>
      )}

      <Separator className="border-dashed my-1" />

      <div className="flex justify-between text-sm font-bold">
        <span>SKUPAJ Z DDV:</span>
        <span>{safeToFixed(receipt.total, 2)}€</span>
      </div>

      {receipt.tip > 0 && (
        <>
          <div className="flex justify-between">
            <span>Napitnina:</span>
            <span>{safeToFixed(receipt.tip, 2)}€</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>SKUPAJ Z NAPITNINO:</span>
            <span>{safeToFixed(receipt.totalWithTip, 2)}€</span>
          </div>
        </>
      )}
    </div>
  )
})
