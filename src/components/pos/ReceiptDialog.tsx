'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Printer, Copy, CheckCircle2, AlertTriangle, CreditCard, Banknote, Smartphone, Eye, Shield } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

// ============================================
// TIPI (ZDDV-1 skladen račun)
// ============================================
interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number        // Cena brez DDV
  vatRate: number           // DDV stopnja (22, 9.5, 0)
  basePrice: number         // Osnova brez DDV
  vatAmount: number         // Znesek DDV
  totalWithVat: number      // Skupaj z DDV
  modifiers: { name: string; price?: number }[]
  notes: string
  category: string
}

interface VatBreakdownItem {
  base: number
  vat: number
  total: number
}

interface ReceiptData {
  // Glava
  receiptNumber: string
  receiptDate: string
  registerId: string
  // Izdajatelj
  businessName: string
  businessAddress: string
  businessId: string
  taxId: string
  phone: string
  // FURS
  zoi: string
  eor: string
  fiscalVerified: boolean
  // Naročilo
  orderNumber: number
  type: string
  status: string
  paymentStatus: string
  paymentMethod: string
  customerName: string
  table: { number: number; area: string } | null
  notes: string
  createdAt: string
  // Postavke
  items: ReceiptItem[]
  // Zneski
  subtotal: number
  vatBreakdown: Record<string, VatBreakdownItem>
  totalVat: number
  discount: number
  total: number
  tip: number
  totalWithTip: number
  // Meta
  receiptFooter: string
  isCopy: boolean
  isStorno: boolean
  stornoOf: string
}

// ============================================
// KOMPONENTA
// ============================================
export function ReceiptDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null
  open: boolean
  onClose: () => void
}) {
  const [isPreview, setIsPreview] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const queryClient = useQueryClient()

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', orderId],
    queryFn: async () => {
      if (!orderId) return null
      const res = await fetch(`/api/receipts/${orderId}`)
      return res.json() as Promise<ReceiptData>
    },
    enabled: !!orderId && open,
  })

  // Shrani račun v bazo
  const saveReceipt = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await fetch(`/api/receipts/${orderId}`, { method: 'POST' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', orderId] })
    },
  })

  // Označi kot natisnjen
  const markPrinted = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await fetch(`/api/receipts/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printed: true }),
      })
      return res.json()
    },
  })

  // Ustvari kopijo
  const markCopy = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await fetch(`/api/receipts/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCopy: true }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', orderId] })
    },
  })

  // FURS davčno overjanje
  const fiscalVerify = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      setVerifying(true)
      const res = await fetch('/api/furs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Napaka pri overjanju')
      return result
    },
    onSuccess: (result) => {
      setVerifying(false)
      toast.success(result.message || 'Račun davčno overjen!')
      queryClient.invalidateQueries({ queryKey: ['receipt', orderId] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err: Error) => {
      setVerifying(false)
      toast.error(`Napaka pri overjanju: ${err.message}`)
    },
  })

  // Storno račun
  const stornoMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await fetch('/api/furs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Napaka pri storniranju')
      return result
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Storno račun ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['receipt', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err: Error) => toast.error(`Napaka: ${err.message}`),
  })

  const typeLabels: Record<string, string> = {
    'dine-in': 'Na mestu',
    'takeaway': 'Za s seboj',
    'delivery': 'Dostava',
  }

  const paymentIcons: Record<string, React.ReactNode> = {
    gotovina: <Banknote className="h-3 w-3" />,
    kartica: <CreditCard className="h-3 w-3" />,
    mobilno: <Smartphone className="h-3 w-3" />,
    cash: <Banknote className="h-3 w-3" />,
    card: <CreditCard className="h-3 w-3" />,
    mobile: <Smartphone className="h-3 w-3" />,
  }

  const paymentLabels: Record<string, string> = {
    gotovina: 'Gotovina',
    kartica: 'Kartično',
    mobilno: 'Mobilno',
    cash: 'Gotovina',
    card: 'Kartično',
    mobile: 'Mobilno',
  }

  const handlePrint = () => {
    // Najprej shrani račun
    saveReceipt.mutate()
    setIsPreview(false)
    setTimeout(() => {
      window.print()
      markPrinted.mutate()
    }, 300)
  }

  const handleConfirmAndPrint = () => {
    setIsPreview(false)
    saveReceipt.mutate()
    // Avtomatsko zaženi FURS overitev
    fiscalVerify.mutate()
    setTimeout(() => {
      window.print()
      markPrinted.mutate()
    }, 500)
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isPreview ? (
                <><Eye className="h-4 w-4" /> Predogled računa</>
              ) : (
                'Račun'
              )}
            </span>
            <div className="flex gap-1">
              {isPreview && receipt && (
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmAndPrint}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Potrdi in natisni
                </Button>
              )}
              {!isPreview && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => markCopy.mutate()}>
                    <Copy className="h-3 w-3 mr-1" />
                    Kopija
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePrint}>
                    <Printer className="h-3 w-3 mr-1" />
                    Natisni
                  </Button>
                </>
              )}
              {/* FURS overitev gumb */}
              {receipt && !receipt.fiscalVerified && !isPreview && (
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => fiscalVerify.mutate()} disabled={verifying}>
                  <Shield className="h-3 w-3 mr-1" />
                  {verifying ? 'Overjam...' : 'Davčno overi'}
                </Button>
              )}
              {/* Storno gumb */}
              {receipt && !receipt.isStorno && receipt.fiscalVerified && !isPreview && (
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { if (confirm('Ali ste prepričani, da želite stornirati ta račun?')) stornoMutation.mutate() }}>
                  STORNO
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading || !receipt ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-6 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        ) : (
          <>
            {/* PREDOGLED OPOZORILO */}
            {isPreview && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-200">
                  To je <strong>predogled</strong> računa. Preverite podatke pred tiskanjem.
                  Račun bo shranjen v bazo ob potrditvi.
                </span>
              </div>
            )}

            {/* STORNO OZNAKA */}
            {receipt.isStorno && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center font-bold text-red-700 dark:text-red-300">
                STORNO RAČUN
                {receipt.stornoOf && <div className="text-xs font-normal mt-1">Storno računa: {receipt.stornoOf}</div>}
              </div>
            )}

            {/* KOPIJA OZNAKA */}
            {receipt.isCopy && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-center text-xs font-medium text-blue-700 dark:text-blue-300">
                PRIREJENA KOPIJA / Kopie certifiée
              </div>
            )}

            {/* === VSEBINA RAČUNA === */}
            <div className="print-area" id="receipt-print">
              <div className="font-mono text-xs space-y-3">
                {/* GLAVA - Podatki izdajatelja */}
                <div className="text-center space-y-1">
                  <h2 className="text-base font-bold">{receipt.businessName}</h2>
                  <p className="text-[10px] text-muted-foreground">{receipt.businessAddress}</p>
                  <p className="text-[10px] text-muted-foreground">{receipt.phone}</p>
                  <div className="flex justify-center gap-3 text-[10px]">
                    <span>MAT: {receipt.businessId}</span>
                    <span>ID DDV: {receipt.taxId}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Blagajna: {receipt.registerId}</p>
                </div>

                <Separator className="border-dashed" />

                {/* Podatki računa */}
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between font-semibold">
                    <span>Račun št.:</span>
                    <span>{receipt.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Datum:</span>
                    <span>{format(new Date(receipt.receiptDate), 'dd.MM.yyyy HH:mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Naročilo:</span>
                    <span>#{receipt.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vrsta:</span>
                    <span>{typeLabels[receipt.type] || receipt.type}</span>
                  </div>
                  {receipt.table && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Miza:</span>
                      <span>{receipt.table.number}</span>
                    </div>
                  )}
                </div>

                <Separator className="border-dashed" />

                {/* POSTAVKE - z DDV po artiklih */}
                <div className="space-y-2">
                  {receipt.items.map((item) => (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-semibold">{item.quantity}x {item.name}</span>
                        <span className="font-semibold">{item.totalWithVat.toFixed(2)}€</span>
                      </div>
                      <div className="pl-4 flex justify-between text-[10px] text-muted-foreground">
                        <span>{item.quantity}x {item.unitPrice.toFixed(2)}€ + DDV {item.vatRate}%</span>
                        <span>osn.{item.basePrice.toFixed(2)}€ ddv.{item.vatAmount.toFixed(2)}€</span>
                      </div>
                      {item.modifiers.length > 0 && (
                        <div className="pl-4">
                          {item.modifiers.map((mod, i) => (
                            <div key={i} className="flex justify-between text-[10px] text-muted-foreground">
                              <span>+ {mod.name}</span>
                              {mod.price && mod.price > 0 && <span>+{mod.price.toFixed(2)}€</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="pl-4 text-[10px] text-amber-600 italic">* {item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="border-dashed" />

                {/* ZNESEKI z multi-DDV */}
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Vmesna vsota (brez DDV):</span>
                    <span>{receipt.subtotal.toFixed(2)}€</span>
                  </div>
                  
                  {/* DDV po stopnjah */}
                  {Object.entries(receipt.vatBreakdown).map(([rate, data]) => (
                    <div key={rate} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground pl-2">DDV {rate}% osnova:</span>
                        <span className="text-muted-foreground">{data.base.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="pl-2">DDV {rate}%:</span>
                        <span>{data.vat.toFixed(2)}€</span>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between font-medium">
                    <span>Skupaj DDV:</span>
                    <span>{receipt.totalVat.toFixed(2)}€</span>
                  </div>

                  {receipt.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Popust:</span>
                      <span>-{receipt.discount.toFixed(2)}€</span>
                    </div>
                  )}
                  
                  <Separator className="border-dashed my-1" />
                  
                  <div className="flex justify-between text-sm font-bold">
                    <span>SKUPAJ Z DDV:</span>
                    <span>{receipt.total.toFixed(2)}€</span>
                  </div>

                  {receipt.tip > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Napitnina:</span>
                        <span>{receipt.tip.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>SKUPAJ Z NAPITNINO:</span>
                        <span>{receipt.totalWithTip.toFixed(2)}€</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Plačilne informacije */}
                <Separator className="border-dashed" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Način plačila:</span>
                    <div className="flex items-center gap-1">
                      {paymentIcons[receipt.paymentMethod]}
                      <span className="font-semibold">
                        {paymentLabels[receipt.paymentMethod] || receipt.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant={receipt.paymentStatus === 'paid' ? 'default' : 'outline'}
                      className={`text-[10px] h-5 ${
                        receipt.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : ''
                      }`}
                    >
                      {receipt.paymentStatus === 'paid' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-0.5" /> Plačano</>
                      ) : (
                        'Čaka na plačilo'
                      )}
                    </Badge>
                  </div>
                </div>

                {/* FURS podatki */}
                <Separator className="border-dashed" />
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
                    ) : (
                      <><AlertTriangle className="h-3 w-3 text-amber-500" /> <span className="text-amber-600">Čaka na davčno overjanje (FURS)</span></>
                    )}
                  </div>
                </div>

                {/* QR koda placeholder */}
                <div className="flex justify-center">
                  <div className="h-20 w-20 border-2 border-current rounded flex items-center justify-center">
                    <div className="text-center text-[8px] text-muted-foreground">
                      <Shield className="h-4 w-4 mx-auto mb-0.5" />
                      FURS QR
                    </div>
                  </div>
                </div>

                {/* Noga računa */}
                {receipt.receiptFooter && (
                  <div className="text-center text-[10px] text-muted-foreground pt-1">
                    <p>{receipt.receiptFooter}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
