'use client'

import { memo } from 'react'
import { Receipt, Wallet } from 'lucide-react'
import { formatEUR, safeToFixed } from '@/lib/safe-format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodSummaryProps {
  eodData: EodData
}

export const EodSummary = memo(function EodSummary({ eodData }: EodSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="text-center p-3 rounded-lg bg-primary/5 border">
        <p className="text-xs text-muted-foreground">Prihodek</p>
        <p className="text-lg font-bold text-primary">{formatEUR(eodData.summary.totalRevenue)}</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Naročila</p>
        <p className="text-lg font-bold">{eodData.summary.completedOrders}</p>
        <p className="text-[10px] text-muted-foreground">{eodData.summary.cancelledOrders} preklicanih</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Povprečno</p>
        <p className="text-lg font-bold">{formatEUR(eodData.summary.avgOrderValue)}</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Napitnine</p>
        <p className="text-lg font-bold text-emerald-600">{formatEUR(eodData.summary.totalTips)}</p>
      </div>
    </div>
  )
})

export const EodVatBreakdown = memo(function EodVatBreakdown({ eodData }: EodSummaryProps) {
  if (eodData.vatBreakdown.length === 0) return null
  return (
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
              <td className="p-2 text-right">{formatEUR(vb.base)}</td>
              <td className="p-2 text-right">{formatEUR(vb.vat)}</td>
              <td className="p-2 text-right font-semibold">{formatEUR(vb.base + vb.vat)}</td>
            </tr>
          ))}
          <tr className="bg-muted/30 font-bold">
            <td className="p-2">SKUPAJ</td>
            <td className="p-2 text-right">{formatEUR(eodData.summary.totalSubtotal)}</td>
            <td className="p-2 text-right">{formatEUR(eodData.summary.totalTax)}</td>
            <td className="p-2 text-right">{formatEUR(eodData.summary.totalRevenue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
})

export const EodPaymentMethods = memo(function EodPaymentMethods({ eodData }: EodSummaryProps) {
  if (eodData.paymentMethods.length === 0) return null
  return (
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
              <span className="font-semibold">{formatEUR(pm.revenue)}</span>
              {pm.tips > 0 && <span className="text-xs text-emerald-600">+{formatEUR(pm.tips)} tip</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export const EodCostsSection = memo(function EodCostsSection({ eodData }: EodSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/10">
        <p className="text-[10px] text-muted-foreground">Nabava</p>
        <p className="font-bold text-orange-600 text-sm">{formatEUR(eodData.costs.procurementCost)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
        <p className="text-[10px] text-muted-foreground">COGS</p>
        <p className="font-bold text-red-600 text-sm">{formatEUR(eodData.costs.cogs)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
        <p className="text-[10px] text-muted-foreground">Odpisi</p>
        <p className="font-bold text-amber-600 text-sm">{formatEUR(eodData.costs.writeOffCost)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
        <p className="text-[10px] text-muted-foreground">Bruto marža</p>
        <p className="font-bold text-emerald-600 text-sm">{formatEUR(eodData.costs.grossProfit)} ({safeToFixed(eodData.costs.grossMargin, 1)}%)</p>
      </div>
    </div>
  )
})

export const EodEmployeeBreakdown = memo(function EodEmployeeBreakdown({ eodData }: EodSummaryProps) {
  if (eodData.employeeBreakdown.length === 0) return null
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-2 font-medium text-sm">Pregled po zaposlenih</div>
      {eodData.employeeBreakdown.map((emp: { employeeId: string; employeeName?: string; orderCount: number; revenue: number; tips: number }, i: number) => (
        <div key={i} className="flex items-center justify-between text-sm p-2 border-b last:border-0">
          <span>{String((emp as Record<string, unknown>).employeeName || emp.employeeId)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{emp.orderCount} naročil</span>
            <span className="font-semibold">{formatEUR(emp.revenue)}</span>
            {emp.tips > 0 && <span className="text-xs text-emerald-600">+{formatEUR(emp.tips)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
})
