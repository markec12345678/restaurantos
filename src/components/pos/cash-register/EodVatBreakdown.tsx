'use client'

import { memo } from 'react'
import { Receipt } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'

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
