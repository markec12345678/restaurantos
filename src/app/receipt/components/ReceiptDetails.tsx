'use client'

import { memo } from 'react'
import type { ReceiptData } from '../types'
import { PAYMENT_LABELS, TYPE_LABELS } from '../constants'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Podatki računa (številka, datum, miza, itd.)
// ═══════════════════════════════════════════════════════════════

interface ReceiptDetailsProps {
  receipt: ReceiptData
}

export const ReceiptDetails = memo(function ReceiptDetails({ receipt }: ReceiptDetailsProps) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Racun</span>
        <span className="font-semibold">{receipt.receiptNumber}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Datum</span>
        <span>
          {new Date(receipt.createdAt).toLocaleString('sl-SI', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Blagajna</span>
        <span>{receipt.registerId}</span>
      </div>
      {receipt.tableNumber && (
        <div className="flex justify-between">
          <span className="text-gray-500">Miza</span>
          <span>{receipt.tableNumber}</span>
        </div>
      )}
      {receipt.orderType && (
        <div className="flex justify-between">
          <span className="text-gray-500">Vrsta</span>
          <span>{TYPE_LABELS[receipt.orderType] || receipt.orderType}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-gray-500">Nacin placila</span>
        <span>{PAYMENT_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</span>
      </div>
    </div>
  )
})
