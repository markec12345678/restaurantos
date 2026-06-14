'use client'

// ============================================
// ZOD: DIALOG ZA ZAKLJUČEK OBRATOVALNEGA DNEVA
// ============================================

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { CalendarCheck, AlertTriangle, Receipt, Wallet, FileText } from 'lucide-react'
import type { EodFormType } from './constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  eodData: EodData
  eodLoading: boolean
  form: EodFormType
  onFormChange: (_form: EodFormType) => void
  onSubmit: () => void
  isPending: boolean
}

export const EodDialog = memo(function EodDialog({
  open,
  onOpenChange,
  eodData,
  eodLoading,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Zaključek obratovalnega dneva (ZOD)
          </DialogTitle>
        </DialogHeader>

        {eodLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : !eodData ? (
          <p className="text-center py-8 text-muted-foreground">Ni podatkov za ta dan</p>
        ) : (
          <div className="space-y-4">
            {/* Opozorilo za odprta naročila */}
            {eodData.summary.pendingOrders > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Pozor: {eodData.summary.pendingOrders} odprtih naročil! Najprej zaključite vsa naročila.
                </p>
              </div>
            )}

            {/* Povzetek dneva */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-primary/5 border">
                <p className="text-xs text-muted-foreground">Prihodek</p>
                <p className="text-lg font-bold text-primary">&euro;{eodData.summary.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Naročila</p>
                <p className="text-lg font-bold">{eodData.summary.completedOrders}</p>
                <p className="text-[10px] text-muted-foreground">{eodData.summary.cancelledOrders} preklicanih</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Povprečno</p>
                <p className="text-lg font-bold">&euro;{eodData.summary.avgOrderValue.toFixed(2)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Napitnine</p>
                <p className="text-lg font-bold text-emerald-600">&euro;{eodData.summary.totalTips.toFixed(2)}</p>
              </div>
            </div>

            {/* DDV razčlenitev */}
            {eodData.vatBreakdown.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-2 font-medium text-sm flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5" /> DDV razčlenitev
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Stopnja</th>
                      <th className="text-right p-2">Osnova</th>
                      <th className="text-right p-2">DDV</th>
                      <th className="text-right p-2">Skupaj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eodData.vatBreakdown.map((vb: { rate: number; base: number; vat: number }, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2 font-medium">{vb.rate}%</td>
                        <td className="p-2 text-right">&euro;{vb.base.toFixed(2)}</td>
                        <td className="p-2 text-right">&euro;{vb.vat.toFixed(2)}</td>
                        <td className="p-2 text-right font-semibold">&euro;{(vb.base + vb.vat).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-bold">
                      <td className="p-2">SKUPAJ</td>
                      <td className="p-2 text-right">&euro;{eodData.summary.totalSubtotal.toFixed(2)}</td>
                      <td className="p-2 text-right">&euro;{eodData.summary.totalTax.toFixed(2)}</td>
                      <td className="p-2 text-right">&euro;{eodData.summary.totalRevenue.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Plačilne metode */}
            {eodData.paymentMethods.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-2 font-medium text-sm flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5" /> Plačilne metode
                </div>
                <div className="space-y-1 p-2">
                  {eodData.paymentMethods.map((pm: { method: string; count: number; revenue: number; tips: number }, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span className="capitalize">{pm.method === 'cash' ? 'Gotovina' : pm.method === 'card' ? 'Kartica' : pm.method === 'mobile' ? 'Mobilno' : pm.method}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{pm.count}&times;</span>
                        <span className="font-semibold">&euro;{pm.revenue.toFixed(2)}</span>
                        {pm.tips > 0 && <span className="text-xs text-emerald-600">+&euro;{pm.tips.toFixed(2)} tip</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stroškovna analiza */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                <p className="text-[10px] text-muted-foreground">Nabava</p>
                <p className="font-bold text-orange-600 text-sm">&euro;{eodData.costs.procurementCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                <p className="text-[10px] text-muted-foreground">COGS</p>
                <p className="font-bold text-red-600 text-sm">&euro;{eodData.costs.cogs.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                <p className="text-[10px] text-muted-foreground">Odpisi</p>
                <p className="font-bold text-amber-600 text-sm">&euro;{eodData.costs.writeOffCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <p className="text-[10px] text-muted-foreground">Bruto marža</p>
                <p className="font-bold text-emerald-600 text-sm">&euro;{eodData.costs.grossProfit.toFixed(2)} ({eodData.costs.grossMargin.toFixed(1)}%)</p>
              </div>
            </div>

            {/* Zaposleni pregled */}
            {eodData.employeeBreakdown.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-2 font-medium text-sm">Pregled po zaposlenih</div>
                {eodData.employeeBreakdown.map((emp: { employeeId: string; employeeName?: string; orderCount: number; revenue: number; tips: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 border-b last:border-0">
                    <span>{String((emp as Record<string, unknown>).employeeName || emp.employeeId)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{emp.orderCount} naročil</span>
                      <span className="font-semibold">&euro;{emp.revenue.toFixed(2)}</span>
                      {emp.tips > 0 && <span className="text-xs text-emerald-600">+&euro;{emp.tips.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ZOD zapiranje */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Zaključi obratovalni dan
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="eod-cash" className="text-sm font-medium">Dejanska gotovina (&euro;)</label>
                  <Input
                    id="eod-cash"
                    type="number"
                    step="0.01"
                    placeholder={eodData.activeShift ? String((eodData.activeShift.startingCash + eodData.summary.totalRevenue).toFixed(2)) : '0.00'}
                    value={form.closingCash}
                    onChange={e => onFormChange({ ...form, closingCash: e.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="eod-notes" className="text-sm font-medium">Opombe</label>
                  <Input id="eod-notes" placeholder="Opombe ob zaključku..." value={form.notes} onChange={e => onFormChange({ ...form, notes: e.target.value })} aria-label="Opombe ob zaključku"/>
                </div>
              </div>

              {eodData.summary.pendingOrders > 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Ne morete zaključiti dneva — imate {eodData.summary.pendingOrders} odprtih naročil.
                  </p>
                </div>
              ) : !eodData.activeShift ? (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    Ni odprte blagajniške izmene. Dan je že zaključen.
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onSubmit}
                  disabled={isPending}
                >
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  {isPending ? 'Zaključujem...' : 'ZAKLJUČI OBRATOVALNI DAN'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
