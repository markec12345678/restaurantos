'use client'

import { memo } from 'react'
import { CheckCircle, Copy } from 'lucide-react'
import type { ReceiptData } from '../types'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — FURS podatki (ZOI, EOR, davčno overjanje)
// ═══════════════════════════════════════════════════════════════

interface ReceiptFiscalDataProps {
  receipt: ReceiptData
  copied: boolean
  onCopyZOI: () => void
}

export const ReceiptFiscalData = memo(function ReceiptFiscalData({
  receipt,
  copied,
  onCopyZOI,
}: ReceiptFiscalDataProps) {
  return (
    <div className="space-y-2 text-xs text-gray-500">
      <div className="flex justify-between">
        <span>Maticna st.:</span>
        <span className="font-mono">{receipt.businessId}</span>
      </div>
      <div className="flex justify-between">
        <span>ID za DDV:</span>
        <span className="font-mono">{receipt.taxId}</span>
      </div>

      {receipt.zoi && (
        <div>
          <div className="flex items-center justify-between">
            <span>ZOI:</span>
            <button
              onClick={onCopyZOI}
              className="text-amber-600 hover:text-amber-700 flex items-center gap-1"
              aria-label={copied ? 'ZOI kopirano' : 'Kopiraj ZOI'}
            >
              {copied ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? 'Kopirano!' : 'Kopiraj'}
            </button>
          </div>
          <p className="font-mono text-[10px] break-all mt-0.5">{receipt.zoi}</p>
        </div>
      )}

      {receipt.eor && (
        <div>
          <span>EOR:</span>
          <p className="font-mono text-[10px] break-all mt-0.5">{receipt.eor}</p>
        </div>
      )}

      {receipt.fiscalVerified ? (
        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
          <CheckCircle className="w-4 h-4" />
          Davcno overjen
        </div>
      ) : (
        <div className="text-amber-600 font-semibold">FURS simulacija</div>
      )}
    </div>
  )
})
