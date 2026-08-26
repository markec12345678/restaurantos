'use client'

import { memo } from 'react'
import type { ReceiptData } from '../types'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Glava računa (podatki izdajatelja)
// ═══════════════════════════════════════════════════════════════

interface ReceiptHeaderProps {
  receipt: ReceiptData
}

export const ReceiptHeader = memo(function ReceiptHeader({ receipt }: ReceiptHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 text-center">
      <h1 className="text-xl font-bold">{receipt.businessName}</h1>
      {receipt.businessAddress && (
        <p className="text-sm opacity-90 mt-1">{receipt.businessAddress}</p>
      )}
      {(receipt.businessPostCode || receipt.businessCity) && (
        <p className="text-sm opacity-90">
          {receipt.businessPostCode} {receipt.businessCity}
        </p>
      )}
      {receipt.businessPhone && (
        <p className="text-sm opacity-90">Tel: {receipt.businessPhone}</p>
      )}
    </div>
  )
})
