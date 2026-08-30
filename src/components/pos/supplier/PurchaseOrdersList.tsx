'use client'

// ============================================
// SEZNAM NABAVNIH NAROČIL — Prikaz naročil + akcijski gumbi
// ============================================

import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Truck, FileText, Calendar, Clock, Package, Send, CheckCircle2, Eye } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { PurchaseOrderType, PurchaseOrderItemType } from './constants'
import { poStatusLabels, poStatusColors } from './constants'

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

// Receive Dialog — omogoča vnos prejete količine za vsako postavko
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
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset ko se dialog odpre
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && po) {
      const initial: Record<string, number> = {}
      ;(Array.isArray(po.items) ? po.items : []).forEach((item) => {
        initial[item.id] = Number(item.quantityOrdered) || 0
      })
      setReceivedQtys(initial)
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

      const receivedItems = (Array.isArray(po.items) ? po.items : [])
        .map(item => ({
          itemId: item.id,
          quantityReceived: Number(receivedQtys[item.id]) || 0,
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
        body: JSON.stringify({ receivedItems }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri prejemu blaga')

      toast.success(data.message || 'Blago prevzeto — zaloga posodobljena')
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
              <div key={item.id} className="flex items-center gap-3 p-2 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Naročeno: {item.quantityOrdered} {item.unit}
                    {item.quantityReceived > 0 && ` · Že prejeto: ${item.quantityReceived}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Input
                    type="number"
                    min="0"
                    max={Number(item.quantityOrdered) - Number(item.quantityReceived || 0)}
                    value={receivedQtys[item.id] ?? 0}
                    onChange={e => setReceivedQtys(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                    className="w-20 h-8 text-xs"
                    aria-label={`Prejeto količina za ${item.description}`}
                  />
                  <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                </div>
              </div>
            ))}
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
        <Card key={po.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm font-mono">{po.poNumber}</span>
                    <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${poStatusColors[po.status] || ''}`}>
                      {poStatusLabels[po.status] || po.status}
                    </Badge>
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
                    <span className="font-bold text-sm">&euro;{safeToFixed(po.totalAmount, 2)}</span>
                    <span className="text-xs text-muted-foreground">(DDV: &euro;{safeToFixed(po.vatAmount, 2)})</span>
                  </div>
                  {/* Prikaz postavk z napredkom prejema */}
                  {Array.isArray(po.items) && po.items.length > 0 && po.status !== 'draft' && (
                    <div className="mt-2 space-y-0.5">
                      {po.items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate">{item.description}</span>
                          <span className="ml-2 whitespace-nowrap">
                            {item.quantityReceived}/{item.quantityOrdered} {item.unit}
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

              {/* AKCIJSKI GUMBI */}
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
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
              </div>
            </div>
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
    </div>
  )
})
