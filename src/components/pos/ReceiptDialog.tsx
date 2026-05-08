'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Printer, Download, X, CreditCard, Banknote, Smartphone, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

// ============================================
// TIPI
// ============================================
interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  modifiers: { name: string; price?: number }[]
  notes: string
  category: string
}

interface ReceiptData {
  orderNumber: number
  type: string
  status: string
  paymentStatus: string
  paymentMethod: string
  customerName: string
  table: { number: number; area: string } | null
  notes: string
  createdAt: string
  items: ReceiptItem[]
  subtotal: number
  taxRate: number
  tax: number
  discount: number
  total: number
  restaurant: {
    name: string
    address: string
    phone: string
    taxId: string
    message: string
  }
  receiptNumber: string
  receiptDate: string
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
  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', orderId],
    queryFn: async () => {
      if (!orderId) return null
      const res = await fetch(`/api/receipts/${orderId}`)
      return res.json() as Promise<ReceiptData>
    },
    enabled: !!orderId && open,
  })

  const typeLabels: Record<string, string> = {
    'dine-in': 'Na mestu',
    'takeaway': 'Za s seboj',
    'delivery': 'Dostava',
  }

  const paymentMethodLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    cash: { label: 'Gotovina', icon: <Banknote className="h-4 w-4" /> },
    card: { label: 'Kartično', icon: <CreditCard className="h-4 w-4" /> },
    mobile: { label: 'Mobilno', icon: <Smartphone className="h-4 w-4" /> },
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Račun</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePrint}>
                <Printer className="h-3 w-3 mr-1" />
                Natisni
              </Button>
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
          <div className="print-area" id="receipt-print">
            {/* Receipt Content */}
            <div className="font-mono text-xs space-y-3">
              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold">{receipt.restaurant.name}</h2>
                <p className="text-[10px] text-muted-foreground">{receipt.restaurant.address}</p>
                <p className="text-[10px] text-muted-foreground">{receipt.restaurant.phone}</p>
                <p className="text-[10px] text-muted-foreground">ID za DDV: {receipt.restaurant.taxId}</p>
              </div>

              <Separator className="border-dashed" />

              {/* Receipt info */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Račun št.:</span>
                  <span className="font-semibold">{receipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Datum:</span>
                  <span>{format(new Date(receipt.receiptDate), 'dd.MM.yyyy HH:mm')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Naročilo št.:</span>
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
                {receipt.customerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stranka:</span>
                    <span>{receipt.customerName}</span>
                  </div>
                )}
              </div>

              <Separator className="border-dashed" />

              {/* Items */}
              <div className="space-y-2">
                {receipt.items.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-semibold">€{item.total.toFixed(2)}</span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <div className="pl-4">
                        {item.modifiers.map((mod, i) => (
                          <div key={i} className="flex justify-between text-[10px] text-muted-foreground">
                            <span>+ {mod.name}</span>
                            {mod.price && mod.price > 0 && <span>+€{mod.price.toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="pl-4 text-[10px] text-amber-600 italic">📝 {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              <Separator className="border-dashed" />

              {/* Totals */}
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Vmesna vsota:</span>
                  <span>€{receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DDV ({receipt.taxRate}%):</span>
                  <span>€{receipt.tax.toFixed(2)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Popust:</span>
                    <span>-€{receipt.discount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="border-dashed my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span>SKUPAJ:</span>
                  <span>€{receipt.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment info */}
              <Separator className="border-dashed" />

              <div className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plačilo:</span>
                  <div className="flex items-center gap-1">
                    {receipt.paymentMethod && paymentMethodLabels[receipt.paymentMethod]?.icon}
                    <span className="font-semibold">
                      {receipt.paymentMethod
                        ? paymentMethodLabels[receipt.paymentMethod]?.label || receipt.paymentMethod
                        : 'Ni plačano'}
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

              {receipt.notes && (
                <>
                  <Separator className="border-dashed" />
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Opombe: </span>
                    <span>{receipt.notes}</span>
                  </div>
                </>
              )}

              <Separator className="border-dashed" />

              {/* Footer */}
              <div className="text-center space-y-1">
                <p className="text-[11px] font-medium">{receipt.restaurant.message}</p>
                <div className="flex justify-center">
                  {/* Simple QR code placeholder */}
                  <div className="h-16 w-16 border-2 border-current rounded flex items-center justify-center text-[6px] text-muted-foreground">
                    QR
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
