'use client'

// ============================================
// R132 (epic #115 P1-12) — RAČUN DOBAVITELJA (InvoiceDialog)
// --------------------------------------------
// Beleženje računa dobavitelja nad nabavno naročilnico (three-way match:
// PO naročeno ↔ GRN sprejeto ↔ račun zaračunano). Variance se PRIKAŽE
// (živi advisory predogled + strežniško match poročilo), nabavna cena se
// NE tiho prepše (kanon #6: price history se iz računa nikoli ne prepisuje).
//
// Kontrakt backend-a (R132-server, dizajn §2c — strežniška polovica teče
// vzporedno, zato so vsi odgovori DEFENZIVNO tipizirani — string/number/null):
//   POST /api/purchase-orders/[id]/invoice
//     body: { invoiceNumber, invoiceDate, dueDate, notes, lines: [{ poItemId,
//             quantityInvoiced, unitPriceInvoiced, vatRate? }] }
//     201 → { accountsPayable, match: { matchStatus, lines[], totals } }
//     400/404/409 → { error }
// Toleranca cene (enaka kot strežnik): |inv − ord| > max(0.01, 0.5 % × ord).
// Decimal vrednosti čez API mejo so lahko STRINGI — vedno toNum('@/lib/decimal')
// ali Number() || 0, NIKOLI golega parseFloat. Barve: emerald/amber/red/zinc
// (izključno emerald/amber/red/zinc). Tipi match/AP so LOKALNO tu (dizajn §3c) in izvoženi
// za match poročilo v razširjeni kartici PO (PurchaseOrdersList).
// ============================================

import { memo, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toNum } from '@/lib/decimal'
import { formatEUR } from '@/lib/safe-format'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PurchaseOrderType, PurchaseOrderItemType } from './constants'

// --- Kontrakt match poročila (lokalno, dizajn §3c — defenzivni tipi) ---
export type InvoiceVarianceStatus = 'match' | 'variance_qty' | 'variance_price' | 'variance_both' | 'unreceived'

export interface InvoiceMatchLine {
  poItemId?: string
  description?: string
  unit?: string
  // Decimal čez API mejo je lahko string — defenzivno oboje
  quantityOrdered?: number | string | null
  quantityAccepted?: number | string | null
  quantityRejected?: number | string | null
  quantityInvoiced?: number | string | null
  unitPriceOrdered?: number | string | null
  unitPriceInvoiced?: number | string | null
  priceVariancePct?: number | string | null
  vatRateInvoiced?: number | string | null
  lineTotal?: number | string | null
  varianceStatus?: string
  varianceNote?: string
}

export interface InvoiceMatchReport {
  matchStatus?: string
  lines?: InvoiceMatchLine[]
  totals?: {
    ordered?: number | string | null
    accepted?: number | string | null
    invoiced?: number | string | null
    priceVarTotal?: number | string | null
    qtyVarTotal?: number | string | null
  }
}

export interface InvoiceApiResponse {
  accountsPayable?: {
    id?: string
    apNumber?: string
    invoiceNumber?: string
    matchStatus?: string
    totalAmount?: number | string | null
  } | null
  match?: InvoiceMatchReport | null
}

// --- Badge kanon (match=emerald, variance_*=amber, unreceived=red — outline) ---
export function VarianceBadge({ status, className }: { status: string; className?: string }) {
  const s = status ?? ''
  const label = s === 'match'
    ? t('suppliers.recon.match')
    : s === 'unreceived'
      ? t('suppliers.recon.unreceived')
      : s === 'unmatched'
        ? t('suppliers.recon.unmatched')
        : t('suppliers.recon.variance')
  const tone = s === 'match'
    ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : s === 'unreceived'
      ? 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
      : 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', tone, className)} title={label}>
      {label}
    </Badge>
  )
}

/** Odmik % cene: |inv − ord| / ord × 100 (1 decimalna); null, če ni računljivo (ord ≤ 0) */
function pctDiff(ordered: number, invoiced: number): number | null {
  if (!Number.isFinite(ordered) || !Number.isFinite(invoiced) || ordered <= 0) return null
  return Math.round(Math.abs(invoiced - ordered) / ordered * 1000) / 10
}

/** Strežniška toleranca (dizajn kanon): |inv − ord| > max(0.01, 0.5 % × ord) → price variance */
function hasPriceVariance(priceOrdered: number, priceInvoiced: number): boolean {
  return Math.abs(priceInvoiced - priceOrdered) > Math.max(0.01, 0.005 * priceOrdered)
}

function fmtPct(pct: number | null): string {
  return pct === null ? '—' : `${pct.toLocaleString('sl-SI', { maximumFractionDigits: 1 })} %`
}

/** Količina: 3 decimalki (kanon količin), brez odvečnih ničel */
function fmtQty(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 1000) / 1000)
}

// --- Match poročilo tabela (SKUPNI kanon: InvoiceDialog + expanded card PO) ---
export function InvoiceMatchTable({ match, className }: { match: InvoiceMatchReport; className?: string }) {
  const lines = Array.isArray(match?.lines) ? match.lines : []
  return (
    <div className={cn('max-h-96 overflow-auto custom-scrollbar', className)}>
      <table className="w-full min-w-[680px] text-xs" aria-label={t('suppliers.recon.invoiceTitle')}>
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.line')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.ordered')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.accepted')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.rejected')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.invoiced')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.priceOrdered')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.priceInvoiced')}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.recon.variancePct')}</th>
            <th scope="col" className="py-1.5 font-medium"><span className="sr-only">{t('suppliers.recon.variance')}</span></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const ordered = toNum(line.quantityOrdered)
            const accepted = toNum(line.quantityAccepted)
            const rejected = toNum(line.quantityRejected)
            const invoiced = toNum(line.quantityInvoiced)
            const priceOrd = toNum(line.unitPriceOrdered)
            const priceInv = toNum(line.unitPriceInvoiced)
            const pct = line.priceVariancePct != null
              ? (Number.isFinite(Number(line.priceVariancePct)) ? Number(line.priceVariancePct) : pctDiff(priceOrd, priceInv))
              : pctDiff(priceOrd, priceInv)
            return (
              <tr key={line.poItemId || `line-${idx}`} className="border-b last:border-0 align-top">
                <td className="max-w-[180px] truncate py-2 pr-3 font-medium" title={line.description ?? undefined}>
                  {line.description ?? '—'}
                  {line.unit ? <span className="ml-1 font-normal text-muted-foreground">({line.unit})</span> : null}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtQty(ordered)}</td>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtQty(accepted)}</td>
                <td className={cn('py-2 pr-3 whitespace-nowrap tabular-nums', rejected > 0 && 'text-amber-700 dark:text-amber-400')}>{fmtQty(rejected)}</td>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtQty(invoiced)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{formatEUR(priceOrd)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{formatEUR(priceInv)}</td>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fmtPct(pct)}</td>
                <td className="py-2"><VarianceBadge status={line.varianceStatus ?? 'match'} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================
// DIALOG
// ============================================
interface InvoiceDialogProps {
  po: PurchaseOrderType | null
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

/** Danes v ISO yyyy-MM-dd (default invoiceDate) / danes + 30 dni (default dueDate) */
function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export const InvoiceDialog = memo(function InvoiceDialog({ po, open, onClose, onSaved }: InvoiceDialogProps) {
  const queryClient = useQueryClient()
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lineQtys, setLineQtys] = useState<Record<string, number>>({})
  const [linePrices, setLinePrices] = useState<Record<string, number>>({})
  const [lineVats, setLineVats] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Strežniško match poročilo po uspešnem 201 (isti badge kanon kot expanded card)
  const [report, setReport] = useState<InvoiceMatchReport | null>(null)

  // Reset ob odprtju dialoga (defaults: quantityReceived/unitPrice/vatRate defenzivno)
  // FIX R132 (brskalniški drill): parent monta dialog z open={!!po} — Radix
  // onOpenChange se ob ODPRTO prek propa NE sproži → defaults ostali prazni
  // (vsa polja 0). Initializer je izvlečen in teče prek useEffect na open/po.
  useEffect(() => {
    if (open && po) {
      const poItems = Array.isArray(po.items) ? po.items : []
      const qtys: Record<string, number> = {}
      const prices: Record<string, number> = {}
      const vats: Record<string, number> = {}
      poItems.forEach((item) => {
        // Default zaračunano = SPREJETO (quantityReceived; defenzivno Number, niz iz Decimal)
        qtys[item.id] = toNum(item.quantityReceived)
        prices[item.id] = toNum(item.unitPrice)
        vats[item.id] = toNum(item.vatRate)
      })
      setLineQtys(qtys)
      setLinePrices(prices)
      setLineVats(vats)
      setInvoiceNumber('')
      setNotes('')
      const today = new Date()
      setInvoiceDate(isoDate(today))
      setDueDate(isoDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)))
      setReport(null)
    }
  }, [open, po])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose()
  }

  const poItems = (po && Array.isArray(po.items) ? po.items : []) as PurchaseOrderItemType[]

  // ŽIVI advisory predogled (enaka formula tolerance kot strežnik — strežnik je avtoriteta)
  const previewWarnings = poItems.map((item) => {
    const qtyOrd = toNum(item.quantityOrdered)
    const qtyAcc = toNum(item.quantityReceived)
    const priceOrd = toNum(item.unitPrice)
    const qtyInv = Number(lineQtys[item.id]) || 0
    const priceInv = Number(linePrices[item.id]) || 0
    const priceVar = hasPriceVariance(priceOrd, priceInv)
    const qtyVar = qtyInv > qtyAcc + 1e-9
    const pct = priceVar ? pctDiff(priceOrd, priceInv) : null
    return { item, priceVar, qtyVar, pct, qtyInv, qtyAcc, priceOrd, priceInv, qtyOrd }
  })
  const hasAnyWarning = previewWarnings.some(w => w.priceVar || w.qtyVar)

  const handleSubmit = async () => {
    if (!po) return
    if (!invoiceNumber.trim()) {
      toast.error(t('suppliers.invoice.numberRequired'))
      return
    }
    const lines = poItems
      .map(item => {
        const vat = Number(lineVats[item.id]) || 0
        return {
          poItemId: item.id,
          quantityInvoiced: Number(lineQtys[item.id]) || 0,
          unitPriceInvoiced: Math.max(0, Number(linePrices[item.id]) || 0),
          ...(vat > 0 ? { vatRate: vat } : {}),
        }
      })
      .filter(line => line.quantityInvoiced > 0)

    if (lines.length === 0) {
      toast.error(t('suppliers.invoice.noLines'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await authFetch(`/api/purchase-orders/${po.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          dueDate,
          notes,
          lines,
        }),
      })
      // odgovor je lahko prazen/pokvarjen — ne sme povzročiti neulovljene napake
      const data = (await res.json().catch(() => ({}))) as InvoiceApiResponse & { error?: string }
      if (!res.ok) {
        // 400/404/409 → razumljiva napaka (strežnik) ali lokaliziran fallback
        toast.error(data?.error || t('suppliers.invoice.error'))
        return
      }
      // 201: pokaži strežniško match poročilo (isti badge kanon) + toast
      setReport(data?.match ?? null)
      toast.success(t('suppliers.invoice.saved'))
      // Invalidacije (dizajn §3d): poInvoice + poReceipts + PO seznami + AP (literal — AP queryKey ne obstaja)
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.poInvoice(po.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.poReceipts(po.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] })
      onSaved?.()
    } catch {
      toast.error(t('suppliers.invoice.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!po) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('suppliers.recon.invoiceTitle')} — {po.poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* glavna polja */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <label htmlFor="invoice-number" className="text-[10px] text-muted-foreground">
                {t('suppliers.invoice.number')} *
              </label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="h-9 text-xs"
                aria-label={t('suppliers.invoice.number')}
              />
            </div>
            <div>
              <label htmlFor="invoice-date" className="text-[10px] text-muted-foreground">
                {t('suppliers.invoice.date')}
              </label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="h-9 text-xs"
                aria-label={t('suppliers.invoice.date')}
              />
            </div>
            <div>
              <label htmlFor="invoice-due" className="text-[10px] text-muted-foreground">
                {t('suppliers.invoice.dueDate')}
              </label>
              <Input
                id="invoice-due"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-9 text-xs"
                aria-label={t('suppliers.invoice.dueDate')}
              />
            </div>
          </div>
          <div>
            <label htmlFor="invoice-notes" className="text-[10px] text-muted-foreground">
              {t('suppliers.invoice.notes')}
            </label>
            <Input
              id="invoice-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-9 text-xs"
              aria-label={t('suppliers.invoice.notes')}
            />
          </div>

          {/* vrstice naročilnice — max-h-96 scroll (UI pravilo) */}
          <div className="max-h-96 overflow-auto custom-scrollbar rounded-lg border">
            <table className="w-full min-w-[560px] text-xs" aria-label={t('suppliers.recon.invoiceTitle')}>
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="p-2 font-medium">{t('suppliers.recon.line')}</th>
                  <th scope="col" className="p-2 font-medium">{t('suppliers.invoice.qty')}</th>
                  <th scope="col" className="p-2 font-medium">{t('suppliers.invoice.price')}</th>
                  <th scope="col" className="p-2 font-medium">{t('suppliers.invoice.vat')}</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map(item => {
                  const warn = previewWarnings.find(w => w.item.id === item.id)
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-2">
                        <p className="font-medium truncate max-w-[200px]" title={item.description}>{item.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t('suppliers.recon.ordered')}: {fmtQty(item.quantityOrdered)} {item.unit}
                          {' · '}{t('suppliers.recon.accepted')}: {fmtQty(item.quantityReceived)}
                          {toNum(item.quantityRejected) > 0 && ` · ${t('suppliers.recon.rejected')}: ${fmtQty(item.quantityRejected)}`}
                        </p>
                        {/* ŽIVI advisory predogled (amber opomba; enaka toleranca kot strežnik) */}
                        {warn?.priceVar && (
                          <p className="mt-0.5 flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {t('suppliers.invoice.priceVarNote', {
                              priceInv: formatEUR(warn.priceInv),
                              priceOrd: formatEUR(warn.priceOrd),
                              pct: fmtPct(warn.pct),
                            })}
                          </p>
                        )}
                        {warn?.qtyVar && (
                          <p className="mt-0.5 flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {t('suppliers.invoice.qtyVarNote', { qty: fmtQty(warn.qtyInv), accepted: fmtQty(warn.qtyAcc) })}
                          </p>
                        )}
                      </td>
                      <td className="p-2">
                        <DecimalInput
                          value={lineQtys[item.id] ?? 0}
                          onValueChange={n => setLineQtys(prev => ({ ...prev, [item.id]: n }))}
                          className="w-24 h-8 text-xs"
                          aria-label={`${t('suppliers.invoice.qty')} — ${item.description}`}
                        />
                      </td>
                      <td className="p-2">
                        <DecimalInput
                          value={linePrices[item.id] ?? 0}
                          onValueChange={n => setLinePrices(prev => ({ ...prev, [item.id]: n }))}
                          className="w-24 h-8 text-xs"
                          aria-label={`${t('suppliers.invoice.price')} — ${item.description}`}
                        />
                      </td>
                      <td className="p-2">
                        <DecimalInput
                          value={lineVats[item.id] ?? 0}
                          onValueChange={n => setLineVats(prev => ({ ...prev, [item.id]: n }))}
                          className="w-20 h-8 text-xs"
                          aria-label={`${t('suppliers.invoice.vat')} — ${item.description}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* advisory opomba o živem predogledu */}
          {hasAnyWarning && (
            <p className="text-[10px] text-muted-foreground">{t('suppliers.invoice.liveHint')}</p>
          )}

          {/* strežniško match poročilo po 201 (isti badge kanon kot expanded card) */}
          {report && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {t('suppliers.invoice.serverReport')}
              </h4>
              <InvoiceMatchTable match={report} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t('suppliers.invoice.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            {isSubmitting ? t('suppliers.invoice.saving') : t('suppliers.invoice.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
