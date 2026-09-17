'use client'

import { memo } from 'react'
import { CheckCircle2, AlertTriangle, Landmark, XCircle } from 'lucide-react'
import type { ReceiptData } from './constants'

// ============================================
// CIS PODATKI (FINA, HRVASKA) — runda 29
// ============================================
// Vzporedno z ReceiptFursSection (ZOI/EOR/QR): ZKI + JIR + status oddaje.
// Sekcija se renderira SAMO ko je bil poskus oddaje (cisStatus ≠ 'none')
// ALI ko JIR obstaja — SI tenanti (cisStatus ostane 'none') je nikoli ne
// vidijo, prav tako ne "pokvari" tiskalnega vzorca FURS računov.
export const ReceiptCisSection = memo(function ReceiptCisSection({
  receipt,
}: {
  receipt: ReceiptData
}) {
  // Render gate: brez poskusa in brez JIR → nič (SI račun)
  const attempted = receipt.cisStatus !== undefined && receipt.cisStatus !== 'none'
  if (!attempted && !receipt.cisJir) return null

  return (
    <>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center gap-1">
          <Landmark className="h-3 w-3 text-emerald-600" />
          <span className="text-muted-foreground">ZKI:</span>
          <span className="font-mono text-[9px] break-all">
            {receipt.cisZki || '—'}
          </span>
        </div>
        {receipt.cisJir && (
          <div className="flex items-center gap-1">
            <Landmark className="h-3 w-3 text-emerald-600" />
            <span className="text-muted-foreground">JIR:</span>
            <span className="font-mono text-[9px] tracking-wider break-all">{receipt.cisJir}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {receipt.cisStatus === 'submitted' ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">Fiskalizirano (FINA, HR)</span>
            </>
          ) : receipt.cisStatus === 'failed' ? (
            <>
              <XCircle className="h-3 w-3 text-red-600" />
              <span className="text-red-600 font-semibold">Oddaja na FINA ni uspela — JIR manjka, ponovite oddajo</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              <span className="text-orange-600">Oddaja na FINA ni uspela — bo ponovljena (JIR manjka)</span>
            </>
          )}
        </div>
      </div>
      <div className="text-center text-[8px] text-muted-foreground">
        Fiskalizacija preko CIS (Porezna uprava RH)
      </div>
    </>
  )
})
