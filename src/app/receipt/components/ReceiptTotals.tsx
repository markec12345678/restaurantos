'use client'

import { memo } from 'react'
import type { ReceiptData } from '../types'
import { fmtEur } from '../constants'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Vmesna vsota, DDV, popust, skupaj, napitnina
// ═══════════════════════════════════════════════════════════════

interface ReceiptTotalsProps {
  receipt: ReceiptData
}

export const ReceiptTotals = memo(function ReceiptTotals({ receipt }: ReceiptTotalsProps) {
  return (
    <>
      {/* Vmesna vsota */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Vmesna vsota</span>
        <span>{fmtEur(receipt.subtotal)}</span>
      </div>

      {/* DDV po stopnjah */}
      {receipt.vatBreakdown.map((vb, idx) => (
        <div key={idx} className="text-sm space-y-1">
          <div className="flex justify-between text-gray-500">
            <span>DDV {vb.rate}% osnova</span>
            <span>{fmtEur(vb.base)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>DDV {vb.rate}% znesek</span>
            <span>{fmtEur(vb.vat)}</span>
          </div>
        </div>
      ))}

      {/* Skupaj DDV */}
      <div className="flex justify-between text-sm font-medium">
        <span>Skupaj DDV</span>
        <span>{fmtEur(receipt.totalVat)}</span>
      </div>

      {/* Popust */}
      {receipt.discount > 0 && (
        <div className="flex justify-between text-sm text-red-600">
          <span>Popust</span>
          <span>-{fmtEur(receipt.discount)}</span>
        </div>
      )}

      <hr className="border-dashed" />

      {/* SKUPAJ */}
      <div className="flex justify-between text-xl font-bold">
        <span>SKUPAJ</span>
        <span className="text-amber-700">{fmtEur(receipt.total)}</span>
      </div>

      {/* Napitnina */}
      {receipt.tip > 0 && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Napitnina</span>
            <span>{fmtEur(receipt.tip)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Skupaj z napitnino</span>
            <span className="text-amber-700">
              {fmtEur(receipt.totalWithTip)}
            </span>
          </div>
        </>
      )}
    </>
  )
})
