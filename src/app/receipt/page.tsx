'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Digitalni račun (/receipt?id=xxx)
// Javno dostopen račun s FURS podatki in QR kodo
// Mobile-first design, prijazen za goste
// ═══════════════════════════════════════════════════════════════

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Printer, Share2, Copy } from 'lucide-react'

interface ReceiptData {
  id: string
  receiptNumber: string
  businessName: string
  businessAddress: string
  businessCity: string
  businessPostCode: string
  businessPhone: string
  businessId: string
  taxId: string
  registerId: string
  zoi: string
  eor: string
  fiscalVerified: boolean
  isStorno: boolean
  items: Array<{
    name: string
    quantity: number
    price: number
    vatRate: number
    isVoided: boolean
    modifiers: Array<{ name: string; price: number }>
  }>
  subtotal: number
  vatBreakdown: Array<{ rate: number; base: number; vat: number }>
  totalVat: number
  discount: number
  total: number
  tip: number
  totalWithTip: number
  paymentMethod: string
  createdAt: string
  qrContent: string
  receiptFooter: string
  tableNumber: number | null
  orderType: string
}

function ReceiptContent() {
  const searchParams = useSearchParams()
  const receiptId = searchParams.get('id')
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!receiptId) { setError('Manjka ID računa'); setLoading(false); return }
    fetchReceipt(receiptId)
  }, [receiptId])

  async function fetchReceipt(id: string) {
    try {
      const res = await fetch(`/api/digital-receipt?id=${encodeURIComponent(id)}`)
      if (!res.ok) { setError('Račun ni najden'); return }
      const data = await res.json()
      setReceipt(data)
    } catch { setError('Napaka pri nalaganju računa') }
    finally { setLoading(false) }
  }

  const copyZOI = () => {
    if (receipt?.zoi) {
      navigator.clipboard.writeText(receipt.zoi)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const fmt = (n: number) => `${n.toFixed(2)} EUR`

  const paymentLabels: Record<string, string> = {
    cash: 'Gotovina', card: 'Kartica', mobile: 'Mobilno', voucher: 'Bon', alternate: 'Drugo'
  }

  const typeLabels: Record<string, string> = {
    'dine-in': 'Na mestu', takeout: 'Za seboj', delivery: 'Dostava'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-amber-800">Nalagam racun...</p>
        </div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 mx-4 max-w-md">
          <div className="text-4xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Racun ni na voljo</h2>
          <p className="text-gray-500">{error || 'Racun s tem ID-jem ne obstaja'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Racun kartica */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Glava */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 text-center">
            <h1 className="text-xl font-bold">{receipt.businessName}</h1>
            {receipt.businessAddress && <p className="text-sm opacity-90 mt-1">{receipt.businessAddress}</p>}
            {(receipt.businessPostCode || receipt.businessCity) && (
              <p className="text-sm opacity-90">{receipt.businessPostCode} {receipt.businessCity}</p>
            )}
            {receipt.businessPhone && <p className="text-sm opacity-90">Tel: {receipt.businessPhone}</p>}
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Podatki racuna */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Racun</span>
                <span className="font-semibold">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Datum</span>
                <span>{new Date(receipt.createdAt).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
                  <span>{typeLabels[receipt.orderType] || receipt.orderType}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Nacin placila</span>
                <span>{paymentLabels[receipt.paymentMethod] || receipt.paymentMethod}</span>
              </div>
            </div>

            <hr className="border-dashed" />

            {/* Artikli */}
            <div className="space-y-2">
              {receipt.items.filter(i => !i.isVoided).map((item, idx) => {
                const itemTotal = item.price * item.quantity
                return (
                  <div key={idx}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                        {item.vatRate > 0 && <span className="text-xs text-gray-400 ml-1">({item.vatRate}%)</span>}
                      </div>
                      <span className="font-semibold ml-2 flex-shrink-0">{fmt(itemTotal)}</span>
                    </div>
                    {item.modifiers?.map((mod, mIdx) => (
                      <div key={mIdx} className="flex justify-between pl-6 text-sm text-gray-500">
                        <span>+ {mod.name}</span>
                        {mod.price > 0 && <span>{fmt(mod.price)}</span>}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            <hr className="border-dashed" />

            {/* Vmesna vsota */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vmesna vsota</span>
              <span>{fmt(receipt.subtotal)}</span>
            </div>

            {/* DDV po stopnjah */}
            {receipt.vatBreakdown.map((vb, idx) => (
              <div key={idx} className="text-sm space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>DDV {vb.rate}% osnova</span>
                  <span>{fmt(vb.base)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>DDV {vb.rate}% znesek</span>
                  <span>{fmt(vb.vat)}</span>
                </div>
              </div>
            ))}

            {/* Skupaj DDV */}
            <div className="flex justify-between text-sm font-medium">
              <span>Skupaj DDV</span>
              <span>{fmt(receipt.totalVat)}</span>
            </div>

            {/* Popust */}
            {receipt.discount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Popust</span>
                <span>-{fmt(receipt.discount)}</span>
              </div>
            )}

            <hr className="border-dashed" />

            {/* SKUPAJ */}
            <div className="flex justify-between text-xl font-bold">
              <span>SKUPAJ</span>
              <span className="text-amber-700">{fmt(receipt.total)}</span>
            </div>

            {/* Napitnina */}
            {receipt.tip > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Napitnina</span>
                  <span>{fmt(receipt.tip)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Skupaj z napitnino</span>
                  <span className="text-amber-700">{fmt(receipt.totalWithTip)}</span>
                </div>
              </>
            )}

            <hr className="border-dashed" />

            {/* FURS podatki */}
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
                    <button onClick={copyZOI} className="text-amber-600 hover:text-amber-700 flex items-center gap-1">
                      {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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
                <div className="text-amber-600 font-semibold">
                  FURS simulacija
                </div>
              )}
            </div>

            {/* QR koda */}
            {receipt.qrContent && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Preveri veljavnost racuna</p>
                <div className="bg-white rounded-lg p-3 inline-block">
                  <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center text-4xl">
                    📱
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 break-all font-mono">{receipt.qrContent}</p>
              </div>
            )}

            {/* Noga */}
            {receipt.receiptFooter && (
              <p className="text-center text-xs text-gray-400">{receipt.receiptFooter}</p>
            )}

            <p className="text-center text-sm text-amber-700 font-medium mt-4">Hvala za obisk!</p>
          </div>
        </div>

        {/* Akcije */}
        <div className="flex gap-2 mt-4">
          <button onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white shadow-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors touch-manipulation min-h-[48px]">
            <Printer className="w-4 h-4" /> Natisni
          </button>
          <button onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `Racun ${receipt.receiptNumber}`, url: window.location.href })
            }
          }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors touch-manipulation min-h-[48px]">
            <Share2 className="w-4 h-4" /> Deli
          </button>
        </div>

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
