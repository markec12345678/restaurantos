'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Digitalni račun (/receipt?id=xxx)
// Javno dostopen račun s FURS podatki in QR kodo
// Mobile-first design, prijazen za goste
// ═══════════════════════════════════════════════════════════════

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Star } from 'lucide-react'
import { useReceipt } from './use-receipt'
import type { ReceiptData } from './types'

// Leno nalaganje podkomponent (ssr: false za client-only interaktivnost)
const ReceiptLoadingState = dynamic(
  () => import('./components/ReceiptLoadingState').then((m) => m.ReceiptLoadingState),
  { ssr: false }
)
const ReceiptErrorState = dynamic(
  () => import('./components/ReceiptErrorState').then((m) => m.ReceiptErrorState),
  { ssr: false }
)
const ReceiptHeader = dynamic(
  () => import('./components/ReceiptHeader').then((m) => m.ReceiptHeader),
  { ssr: false }
)
const ReceiptDetails = dynamic(
  () => import('./components/ReceiptDetails').then((m) => m.ReceiptDetails),
  { ssr: false }
)
const ReceiptItemsList = dynamic(
  () => import('./components/ReceiptItemsList').then((m) => m.ReceiptItemsList),
  { ssr: false }
)
const ReceiptTotals = dynamic(
  () => import('./components/ReceiptTotals').then((m) => m.ReceiptTotals),
  { ssr: false }
)
const ReceiptFiscalData = dynamic(
  () => import('./components/ReceiptFiscalData').then((m) => m.ReceiptFiscalData),
  { ssr: false }
)
const ReceiptQrCode = dynamic(
  () => import('./components/ReceiptQrCode').then((m) => m.ReceiptQrCode),
  { ssr: false }
)
const ReceiptActions = dynamic(
  () => import('./components/ReceiptActions').then((m) => m.ReceiptActions),
  { ssr: false }
)

function ReceiptContent() {
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('id')
  const token = searchParams.get('t')
  const { receipt, loading, error, copied, copyZOI } = useReceipt(receiptId, token)

  if (loading) {
    return <ReceiptLoadingState />
  }

  if (error || !receipt) {
    return <ReceiptErrorState error={error} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Racun kartica */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Glava */}
          <ReceiptHeader receipt={receipt} />

          <div className="px-6 py-4 space-y-4">
            {/* Podatki racuna */}
            <ReceiptDetails receipt={receipt} />

            <hr className="border-dashed" />

            {/* Artikli */}
            <ReceiptItemsList items={receipt.items} />

            <hr className="border-dashed" />

            {/* Vmesna vsota, DDV, skupaj */}
            <ReceiptTotals receipt={receipt} />

            <hr className="border-dashed" />

            {/* FURS podatki */}
            <ReceiptFiscalData
              receipt={receipt}
              copied={copied}
              onCopyZOI={copyZOI}
            />

            {/* QR koda */}
            <ReceiptQrCode qrContent={receipt.qrContent} />

            {/* Noga */}
            {receipt.receiptFooter && (
              <p className="text-center text-xs text-gray-400">
                {receipt.receiptFooter}
              </p>
            )}

            <p className="text-center text-sm text-amber-700 font-medium mt-4">
              Hvala za obisk!
            </p>

            {/* P1-14 (R140-c): diskretna CTA — zapre verigo bill → feedback.
                Relativna povezava (kanon), parami iz podatkov, ki jih receipt že ima;
                manjkajoči param se spusti. Neposredno <a> (javna stran, full-nav OK). */}
            <a
              href={buildFeedbackHref(receipt)}
              className="flex items-center justify-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 underline underline-offset-4 mt-3"
              aria-label="Ocenite svoj obisk"
            >
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Ocenite obisk
            </a>
          </div>
        </div>

        {/* Akcije */}
        <ReceiptActions receiptNumber={receipt.receiptNumber} />

        <div className="text-center mt-4 text-xs text-gray-400">
          <p>ID racuna: {receipt.id}</p>
        </div>
      </div>
    </div>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-amber-800">Nalagam racun...</p>
        </div>
      </div>
    }>
      <ReceiptContent />
    </Suspense>
  )
}

// P1-14 (R140-c): URL javne /feedback strani iz podatkov, ki jih receipt že ima
// (locationId + orderId passthrough iz /api/digital-receipt). Param se spusti,
// če ni na voljo; source=receipt vedno. URLSearchParams poskrbi za encoding.
function buildFeedbackHref(receipt: ReceiptData): string {
  const params = new URLSearchParams()
  if (receipt.locationId) params.set('location', receipt.locationId)
  if (receipt.orderId) params.set('order', receipt.orderId)
  params.set('source', 'receipt')
  return `/feedback?${params.toString()}`
}
