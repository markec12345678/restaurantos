'use client'

import { memo } from 'react'
import { CheckCircle2, AlertTriangle, Shield, XCircle } from 'lucide-react'
import type { ReceiptData } from './constants'

// ============================================
// FURS PODATKI IN QR KODA
// ============================================
export const ReceiptFursSection = memo(function ReceiptFursSection({
  receipt,
  qrCodeDataUrl,
}: {
  receipt: ReceiptData
  qrCodeDataUrl: string
}) {
  return (
    <>
      {/* FURS podatki */}
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">ZOI:</span>
          <span className="font-mono text-[9px] break-all">{receipt.zoi}</span>
        </div>
        {receipt.eor && (
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-500" />
            <span className="text-muted-foreground">EOR:</span>
            <span className="font-mono text-[9px] break-all">{receipt.eor}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {receipt.fiscalVerified ? (
            <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600">Davčno overjeno</span></>
          ) : receipt.fiscalStatus === 'failed' ? (
            // P2-UX FIX (prikaz neuspele fiskalizacije): prej je bil vsak ne-overjen
            // račun enakoten rumen "čaka na overjanje" — natakar ni vedel, da je
            // fiskalizacija DEJANSKO padla in EOR manjka. Zdaj izrecno rdeče stanje.
            <><XCircle className="h-3 w-3 text-red-600" /> <span className="text-red-600 font-semibold">Fiskalizacija NI uspela — EOR manjka, ponovite overitev</span></>
          ) : receipt.fiscalStatus === 'pending' ? (
            <><AlertTriangle className="h-3 w-3 text-orange-500" /> <span className="text-orange-600">Overitev je bila poskusena in ni uspela — čaka na ponovni poskus (EOR manjka)</span></>
          ) : (
            <><AlertTriangle className="h-3 w-3 text-amber-500" /> <span className="text-amber-600">Čaka na davčno overjanje (FURS)</span></>
          )}
        </div>
      </div>

      {/* FURS QR koda */}
      <div className="flex justify-center">
        {receipt.fiscalVerified && qrCodeDataUrl ? (
          <div className="space-y-1 text-center">
            <img
              src={qrCodeDataUrl}
              alt="FURS QR koda"
              className="h-24 w-24 mx-auto"
            />
            <p className="text-[8px] text-muted-foreground">FURS preverjanje</p>
          </div>
        ) : receipt.fiscalVerified ? (
          <div className="h-24 w-24 border-2 border-current rounded flex items-center justify-center">
            <div className="text-center text-[8px] text-muted-foreground">
              <Shield className="h-4 w-4 mx-auto mb-0.5" />
              FURS QR
            </div>
          </div>
        ) : (
          <div className="h-24 w-24 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
            <div className="text-center text-[8px] text-muted-foreground/50">
              <Shield className="h-4 w-4 mx-auto mb-0.5" />
              QR po overitvi
            </div>
          </div>
        )}
      </div>
    </>
  )
})
