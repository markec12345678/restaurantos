'use client'

import { memo } from 'react'
import { Receipt } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodVatBreakdownProps {
  eodData: EodData
}

export const EodVatBreakdown = memo(function EodVatBreakdown({ eodData }: EodVatBreakdownProps) {
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
              <td className="p-2 text-right">&euro;{safeToFixed(vb.base, 2)}</td>
              <td className="p-2 text-right">&euro;{safeToFixed(vb.vat, 2)}</td>
              <td className="p-2 text-right font-semibold">&euro;{safeToFixed(vb.base + vb.vat, 2)}</td>
            </tr>
          ))}
          <tr className="bg-muted/30 font-bold">
            <td className="p-2">SKUPAJ</td>
            <td className="p-2 text-right">&euro;{safeToFixed(eodData.summary.totalSubtotal, 2)}</td>
            <td className="p-2 text-right">&euro;{safeToFixed(eodData.summary.totalTax, 2)}</td>
            <td className="p-2 text-right">&euro;{safeToFixed(eodData.summary.totalRevenue, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
})
