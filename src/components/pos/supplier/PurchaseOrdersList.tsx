'use client'

// ============================================
// SEZNAM NABAVNIH NAROČIL — Prikaz naročil + akcijski gumbi
// R132 (epic #115 P1-12): three-way match recon —
//   a) ReceiveDialog: per-vrstica collapsed 'Zavrnjeno' (quantityRejected +
//      rejectReason), polje 'Št. dobavnice', POST body z novimi polji,
//      success toast z grnNumber iz odgovora (defenzivno — starejši
//      odgovori brez grn → toast brez številke, nikoli crash);
//   b) razširjena kartica PO: sekciji 'Prevzemi (dobavnice)' (GET receipts)
//      in 'Račun dobavitelja' (GET invoice + CTA → InvoiceDialog);
//   c) badge invoiceStatus na vrstici naročilnice.
// Vzorec: mount-in-expanded-card + skeleton/error/retry parity
// SupplierPriceHistory (R130-b) / SupplierCatalog (R131).
// ============================================

import { memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Truck, FileText, Calendar, Clock, Package, Send, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toNum } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { PurchaseOrderType, PurchaseOrderItemType } from './constants'
import { poStatusLabels, poStatusColors } from './constants'
import { isValidPack, fmtPackQty, round3Safe } from './pack-format'
import { InvoiceDialog, InvoiceMatchTable, type InvoiceApiResponse } from './InvoiceDialog'

interface PurchaseOrdersListProps {
  orders: PurchaseOrderType[]
  onRefresh?: () => void
}

// Helper za varno formatiranje datuma
function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return format(d, 'd. MMM yyyy')
  } catch { return '—' }
}

/** Količina na 3 decimalki (kanon Decimal(12,3)), brez odvečnih ničel — defenzivno */
function fmtQty3(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 1000) / 1000)
}

// ============================================
// R132 (P1-12): PREVZEMI (DOBAVNICE) — GRN dokumenti naročilnice
// Mounta se samo v razširjeni kartici PO (fetch šele ob razširitvi —
// parity SupplierPriceHistory/SupplierCatalog). Kontrakt R132-server
// (dizajn §2b, defenzivno — Decimal čez API mejo je lahko string):
//   GET /api/purchase-orders/[id]/receipts → { receipts: [...] }
// ============================================
interface GrnReceiptItem {
  id?: string
  description?: string
  unit?: string
  quantityAccepted?: number | string | null
  quantityRejected?: number | string | null
  rejectReason?: string
}

interface GrnReceipt {
  id: string
  grnNumber?: string
  status?: string
  supplierDocNumber?: string
  receivedByName?: string
  receivedAt?: string | null
  notes?: string
  items?: GrnReceiptItem[]
}

const PoReceiptsSection = memo(function PoReceiptsSection({ poId }: { poId: string }) {
  const query = useQuery({
    queryKey: queryKeys.suppliers.poReceipts(poId),
    enabled: Boolean(poId),
    staleTime: 30_000,
    queryFn: async (): Promise<{ receipts?: GrnReceipt[] }> => {
      const res = await authFetch(`/api/purchase-orders/${encodeURIComponent(poId)}/receipts`)
      if (!res.ok) throw new Error(`po-receipts ${res.status}`)
      return (await res.json()) as { receipts?: GrnReceipt[] }
    },
  })

  const receipts = Array.isArray(query.data?.receipts) ? query.data.receipts : []

  return (
    <section className="space-y-2" aria-label={t('suppliers.recon.receiptsTitle')}>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Package className="h-3.5 w-3.5" aria-hidden="true" />
        {t('suppliers.recon.receiptsTitle')}
      </h4>

      {/* nalaganje — skelet (parity SupplierPriceHistory) */}
      {query.isLoading && (
        <div className="space-y-1.5" role="status" aria-busy="true">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </div>
      )}

      {/* napaka + retry */}
      {query.isError && (
        <div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('suppliers.recon.error')}</AlertTitle>
          </Alert>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => query.refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t('suppliers.recon.retry')}
          </Button>
        </div>
      )}

      {/* prazno stanje (kanon: ne izmišljujemo podatkov) */}
      {!query.isLoading && !query.isError && receipts.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Package className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
          {t('suppliers.recon.emptyReceipts')}
        </div>
      )}

      {/* tabela: grnNumber | datum | dobavnica | sprejeto / zavrnjeno vsote | prevzel */}
      {!query.isLoading && !query.isError && receipts.length > 0 && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[560px] text-xs" aria-label={t('suppliers.recon.receiptsTitle')}>
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.grn')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.date')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.docNumber')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.accepted')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.rejected')}</th>
                <th scope="col" className="py-1.5 font-medium">{t('suppliers.recon.receivedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(grn => {
                // vsote po linijah GRN (defenzivno toNum — string iz Decimal)
                const grnItems = Array.isArray(grn.items) ? grn.items : []
                const acceptedSum = grnItems.reduce((acc, it) => acc + toNum(it.quantityAccepted), 0)
                const rejectedSum = grnItems.reduce((acc, it) => acc + toNum(it.quantityRejected), 0)
                return (
                  <tr key={grn.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-[11px] font-medium">{grn.grnNumber || '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{formatTime(grn.receivedAt)}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{grn.supplierDocNumber || '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtQty3(acceptedSum)}</td>
                    <td className={cn('py-2 pr-3 whitespace-nowrap tabular-nums', rejectedSum > 0 && 'text-amber-700 dark:text-amber-400')}>
                      {fmtQty3(rejectedSum)}
                    </td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">{grn.receivedByName || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
})

// ============================================
// R132 (P1-12): RAČUN DOBAVITELJA — match poročilo + CTA
// GET /api/purchase-orders/[id]/invoice → { accountsPayable, match }
// (dizajn §2d/§3b — defenzivno: null odgovori → CTA brez fabrikacije;
// match poročilo se prikaže samo ko PO.invoiceStatus ≠ 'none', da ne
// tvegamo napake proti starejšemu strežniku; CTA je vedno dosegljiv.)
// ============================================
const PoInvoiceSection = memo(function PoInvoiceSection({
  po,
  onRecordInvoice,
}: {
  po: PurchaseOrderType
  onRecordInvoice: () => void
}) {
  const invoiceEnabled = (po.invoiceStatus ?? 'none') !== 'none'
  const query = useQuery({
    queryKey: queryKeys.suppliers.poInvoice(po.id),
    enabled: invoiceEnabled && Boolean(po.id),
    staleTime: 30_000,
    queryFn: async (): Promise<InvoiceApiResponse> => {
      const res = await authFetch(`/api/purchase-orders/${encodeURIComponent(po.id)}/invoice`)
      if (!res.ok) throw new Error(`po-invoice ${res.status}`)
      return (await res.json()) as InvoiceApiResponse
    },
  })

  const ap = query.data?.accountsPayable ?? null
  const match = query.data?.match ?? null
  const matchLines = Array.isArray(match?.lines) ? match.lines : []

  return (
    <section className="space-y-2" aria-label={t('suppliers.recon.invoiceTitle')}>
      {/* naslov + CTA (odprt InvoiceDialog tudi ko 'none') */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {t('suppliers.recon.invoiceTitle')}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs pointer-coarse:h-11 pointer-coarse:px-4"
          onClick={onRecordInvoice}
        >
          <FileText className="mr-1 h-3 w-3" /> {t('suppliers.recon.recordInvoice')}
        </Button>
      </div>

      {/* nalaganje — skelet (parity SupplierPriceHistory) */}
      {invoiceEnabled && query.isLoading && (
        <div className="space-y-1.5" role="status" aria-busy="true">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </div>
      )}

      {/* napaka + retry */}
      {invoiceEnabled && query.isError && (
        <div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('suppliers.recon.invoiceError')}</AlertTitle>
          </Alert>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => query.refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t('suppliers.recon.retry')}
          </Button>
        </div>
      )}

      {/* match poročilo (accountsPayable null → samo CTA zgoraj, brez fabrikacije) */}
      {invoiceEnabled && !query.isLoading && !query.isError && ap && matchLines.length > 0 && (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
          <InvoiceMatchTable match={match ?? { lines: matchLines }} />
        </div>
      )}
    </section>
  )
})

// ============================================
// RECEIVE DIALOG — vnos prejete količine za vsako postavko
// R132: + collapsed 'Zavrnjeno' sekcija (quantityRejected/rejectReason),
// + 'Št. dobavnice', POST body z novimi polji, toast z grnNumber.
// ============================================
const ReceiveDialog = memo(function ReceiveDialog({
  po,
  open,
  onClose,
  onSuccess,
}: {
  po: PurchaseOrderType | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  // Inicializiraj prejete količine z naročenimi količinami
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})
  // R132: zavrnjene količine + razlogi (default 0 / '') + collapsed stanje vrstice
  const [rejectedQtys, setRejectedQtys] = useState<Record<string, number>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({})
  // R132: št. dobavnice dobavitelja (supplierDocNumber)
  const [supplierDocNumber, setSupplierDocNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset ko se dialog odpre
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && po) {
      const initial: Record<string, number> = {}
      ;(Array.isArray(po.items) ? po.items : []).forEach((item) => {
        initial[item.id] = Number(item.quantityOrdered) || 0
      })
      setReceivedQtys(initial)
      setRejectedQtys({})
      setRejectReasons({})
      setRejectOpen({})
      setSupplierDocNumber('')
    }
    if (!isOpen) onClose()
  }

  const handleReceive = async () => {
    if (!po) return
    setIsProcessing(true)
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('pos_token') || localStorage.getItem('pos_auth_token') || sessionStorage.getItem('pos_auth_token'))
        : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      // R132: nova polja pošljemo VEDNO (strežnik defaulta varno —
      // quantityRejected 0 je brez vpliva na obstoječi tok)
      const receivedItems = (Array.isArray(po.items) ? po.items : [])
        .map(item => ({
          itemId: item.id,
          quantityReceived: Number(receivedQtys[item.id]) || 0,
          quantityRejected: Number(rejectedQtys[item.id]) || 0,
          rejectReason: rejectReasons[item.id] ?? '',
        }))
        .filter(item => item.quantityReceived > 0)

      if (receivedItems.length === 0) {
        toast.error('Vnesite vsaj eno količino za prejem')
        setIsProcessing(false)
        return
      }

      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ receivedItems, supplierDocNumber: supplierDocNumber.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri prejemu blaga')

      // R132: grnNumber iz odgovora (odgovor ima grn.grnNumber) — defenzivno
      // guard (tudi Array oblika); starejši odgovori brez grn → toast brez
      // številke, NIKOLI crash
      const rawGrn: unknown = data?.grn
      const grnObj: Record<string, unknown> | null | undefined = Array.isArray(rawGrn)
        ? (rawGrn[0] as Record<string, unknown> | undefined)
        : (rawGrn as Record<string, unknown> | null | undefined)
      const grnNumber = typeof grnObj?.grnNumber === 'string' && grnObj.grnNumber ? grnObj.grnNumber : null
      toast.success(grnNumber
        ? t('suppliers.recon.grnSaved', { grn: grnNumber })
        : (data.message || 'Blago prevzeto — zaloga posodobljena'))
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri prejemu blaga')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!po) return null
  const poItems = Array.isArray(po.items) ? po.items : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Prejem blaga — {po.poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dobavitelj:</span>
              <span className="font-medium">{po.supplier?.name || 'Neznan'}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{poStatusLabels[po.status] || po.status}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Postavke naročila
            </p>
            {poItems.map((item: PurchaseOrderItemType) => (
              <div key={item.id} className="p-2 border rounded-lg space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Naročeno: {item.quantityOrdered} {item.unit}
                      {/* R131 (P1-13): pack kontekst (defenzivno — samo ko packQty obstaja) */}
                      {isValidPack(item.packQty) && ` · ${t('suppliers.po.packContext', {
                        packs: fmtPackQty(item.quantityOrdered),
                        packUnit: item.packUnit ?? 'paket',
                        packQty: fmtPackQty(item.packQty),
                      })}`}
                      {item.quantityReceived > 0 && ` · Že prejeto: ${item.quantityReceived}`}
                    </p>
                    {/* R131 (P1-13): vnos v paketih + živi osnovni ekvivalent (prejeto pakete × packQty) */}
                    {isValidPack(item.packQty) && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('suppliers.po.receivePacks')}
                        {(Number(receivedQtys[item.id]) || 0) > 0 && ` · ${t('suppliers.po.baseEquivalent', {
                          qty: fmtPackQty(round3Safe((Number(receivedQtys[item.id]) || 0) * Number(item.packQty))),
                        })}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <DecimalInput
                      value={receivedQtys[item.id] ?? 0}
                      onValueChange={n => setReceivedQtys(prev => ({ ...prev, [item.id]: n }))}
                      className="w-20 h-8 text-xs"
                      aria-label={`Prejeto količina za ${item.description}${isValidPack(item.packQty) ? ` (${t('suppliers.po.receivePacks')})` : ''}`}
                    />
                    {/* R131: pri zapakiranih vrsticah je enota PAKET (snapshot iz kataloga) */}
                    <span className={isValidPack(item.packQty) ? 'text-xs text-muted-foreground max-w-24 truncate' : 'text-xs text-muted-foreground w-8'}>
                      {isValidPack(item.packQty) ? (item.packUnit ?? item.unit) : item.unit}
                    </span>
                  </div>
                </div>
                {/* R132 (P1-12): collapsed 'Zavrnjeno' sekcija — rejected je v ISTI
                    enoti kot accepted (pack kanon R131); default 0 / '' */}
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    aria-expanded={!!rejectOpen[item.id]}
                    onClick={() => setRejectOpen(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  >
                    <ChevronDown
                      className={cn('h-3 w-3 transition-transform', rejectOpen[item.id] && 'rotate-180')}
                      aria-hidden="true"
                    />
                    {t('suppliers.recon.rejected')}
                    {(Number(rejectedQtys[item.id]) || 0) > 0 && (
                      <span className="text-amber-700 dark:text-amber-400">({fmtQty3(rejectedQtys[item.id])})</span>
                    )}
                  </button>
                  {rejectOpen[item.id] && (
                    <div className="mt-1 flex items-center gap-2">
                      <DecimalInput
                        value={rejectedQtys[item.id] ?? 0}
                        onValueChange={n => setRejectedQtys(prev => ({ ...prev, [item.id]: n }))}
                        className="w-20 h-8 text-xs"
                        aria-label={`${t('suppliers.recon.rejected')} — ${item.description}`}
                      />
                      <Input
                        value={rejectReasons[item.id] ?? ''}
                        onChange={e => setRejectReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={t('suppliers.recon.rejectReason')}
                        className="h-8 flex-1 text-xs"
                        aria-label={`${t('suppliers.recon.rejectReason')} — ${item.description}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* R132 (P1-12): št. dobavnice dobavitelja (supplierDocNumber) */}
          <div>
            <label htmlFor="receive-doc-number" className="text-[10px] text-muted-foreground">
              {t('suppliers.recon.docNumber')}
            </label>
            <Input
              id="receive-doc-number"
              value={supplierDocNumber}
              onChange={e => setSupplierDocNumber(e.target.value)}
              className="h-9 text-xs"
              placeholder="2026-000123"
              aria-label={t('suppliers.recon.docNumber')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Prekliči</Button>
          <Button onClick={handleReceive} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {isProcessing ? 'Obdelujem...' : 'Potrdi prejem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export const PurchaseOrdersList = memo(function PurchaseOrdersList({ orders, onRefresh }: PurchaseOrdersListProps) {
  // FIX TypeError: e.map is not a function — orders je lahko undefined ali objekt
  const orderList = Array.isArray(orders) ? orders : []
  const [receivePo, setReceivePo] = useState<PurchaseOrderType | null>(null)
  // R132 (P1-12): razširjena kartica PO (receipts/invoice sekcije) + InvoiceDialog
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null)
  const [invoicePo, setInvoicePo] = useState<PurchaseOrderType | null>(null)

  // Submit PO (draft → submitted)
  const handleSubmit = async (poId: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('pos_token') || localStorage.getItem('pos_auth_token') || sessionStorage.getItem('pos_auth_token'))
        : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'submitted' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Napaka')
      }
      toast.success('Naročilo oddano dobavitelju')
      onRefresh?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri oddaji')
    }
  }

  if (orderList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni nabavnih naročil</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orderList.map(po => (
        <Card key={po.id} className={cn('transition-all', expandedPoId === po.id && 'ring-2 ring-primary/30')}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm font-mono">{po.poNumber}</span>
                    <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${poStatusColors[po.status] || ''}`}>
                      {poStatusLabels[po.status] || po.status}
                    </Badge>
                    {/* R132 (P1-12): badge stanja računa (none = brez badge-a) */}
                    {po.invoiceStatus === 'partial' && (
                      <Badge variant="secondary" className="text-[9px] h-5 px-1.5 whitespace-nowrap">
                        {t('suppliers.po.invoicePartial')}
                      </Badge>
                    )}
                    {po.invoiceStatus === 'invoiced' && (
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 whitespace-nowrap border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {t('suppliers.po.invoiceMatched')}
                      </Badge>
                    )}
                    {po.invoiceStatus === 'variance' && (
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 whitespace-nowrap border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {t('suppliers.po.invoiceVariance')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{po.supplier?.name || 'Neznan'}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatTime(po.orderDate)}</span>
                    {po.expectedDate && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Pričakovano: {formatTime(po.expectedDate)}</span>
                    )}
                    {po.receivedDate && (
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" />Prejeto: {formatTime(po.receivedDate)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">{po.items?.length || 0} artiklov</span>
                    <span className="font-bold text-sm">{formatEUR(po.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">(DDV: {formatEUR(po.vatAmount)})</span>
                  </div>
                  {/* Prikaz postavk z napredkom prejema */}
                  {Array.isArray(po.items) && po.items.length > 0 && po.status !== 'draft' && (
                    <div className="mt-2 space-y-0.5">
                      {po.items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate">{item.description}</span>
                          <span className="ml-2 whitespace-nowrap">
                            {item.quantityReceived}/{item.quantityOrdered} {item.unit}
                            {/* R131 (P1-13): pack kontekst ob postavki (defenzivno, ko packQty obstaja) */}
                            {isValidPack(item.packQty) && ` · ${t('suppliers.po.packContext', {
                              packs: fmtPackQty(item.quantityOrdered),
                              packUnit: item.packUnit ?? 'paket',
                              packQty: fmtPackQty(item.packQty),
                            })}`}
                            {Number(item.quantityReceived) > 0 && Number(item.quantityReceived) < Number(item.quantityOrdered) && (
                              <span className="text-amber-600 ml-1">(delno)</span>
                            )}
                          </span>
                        </div>
                      ))}
                      {po.items.length > 3 && <p className="text-[10px] text-muted-foreground">+{po.items.length - 3} več</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* AKCIJSKI GUMBI (FIX R132 mobilni: besedilni gumbi se prelomijo v
                  dve vrstici ožje — flex-shrink-0 je tlakoval 430px čez 390px viewport) */}
              <div className="flex flex-wrap items-center justify-end gap-1 ml-2 min-w-0">
                {/* Oddaj (draft → submitted) */}
                {po.status === 'draft' && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleSubmit(po.id)}>
                    <Send className="h-3 w-3 mr-1" /> Oddaj
                  </Button>
                )}
                {/* Prejmi blago (submitted/approved/partial → receive) */}
                {(po.status === 'submitted' || po.status === 'approved' || po.status === 'partial') && (
                  <Button size="sm" className="h-7 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setReceivePo(po)}>
                    <Package className="h-3 w-3 mr-1" /> Prejmi blago
                  </Button>
                )}
                {/* Prejeto badge */}
                {po.status === 'received' && (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[9px] h-5 px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Prejeto
                  </Badge>
                )}
                {/* R132 (P1-12): razširi kartico (prevzemi + račun) — parity SuppliersList */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={expandedPoId === po.id ? 'Skrij' : 'Razširi'}
                  className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11"
                  onClick={() => setExpandedPoId(expandedPoId === po.id ? null : po.id)}
                >
                  {expandedPoId === po.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* R132 (P1-12): razširjena kartica — fetch se zgodi šele ob razširitvi
                (mount-in-expanded-card, parity SupplierPriceHistory/SupplierCatalog) */}
            {expandedPoId === po.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-4">
                <PoReceiptsSection poId={po.id} />
                <PoInvoiceSection po={po} onRecordInvoice={() => setInvoicePo(po)} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Receive Dialog */}
      <ReceiveDialog
        po={receivePo}
        open={!!receivePo}
        onClose={() => setReceivePo(null)}
        onSuccess={() => onRefresh?.()}
      />

      {/* R132 (P1-12): račun dobavitelja (InvoiceDialog — CTA iz razširjene kartice) */}
      <InvoiceDialog
        po={invoicePo}
        open={!!invoicePo}
        onClose={() => setInvoicePo(null)}
        onSaved={() => onRefresh?.()}
      />
    </div>
  )
})
