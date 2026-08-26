'use client'

import { memo } from 'react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — QR koda za preverjanje računa
// ═══════════════════════════════════════════════════════════════

interface ReceiptQrCodeProps {
  qrContent: string
}

export const ReceiptQrCode = memo(function ReceiptQrCode({ qrContent }: ReceiptQrCodeProps) {
  if (!qrContent) return null

  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 mb-2">Preveri veljavnost racuna</p>
      <div className="bg-white rounded-lg p-3 inline-block">
        <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center text-4xl">
          &#x1F4F1;
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 break-all font-mono">
        {qrContent}
      </p>
    </div>
  )
})
