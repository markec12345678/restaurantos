'use client'

import { memo } from 'react'
import type { FinancialData } from './types'
import { paymentMethodLabels, orderTypeLabels } from '../constants'

// ============================================
// TABELA PROMETA — Povzetek, plačilne metode, vrste naročil
// ============================================

interface RevenueTableProps {
  fin: FinancialData
  fmt: (_n: number) => string
}

export const RevenueTable = memo(function RevenueTable({ fin, fmt }: RevenueTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left p-3 font-medium">Opis</th>
            <th className="text-right p-3 font-medium">Znesek</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3">Skupni promet (bruto)</td>
            <td className="p-3 text-right font-semibold">{fmt(fin.summary.totalRevenue)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 pl-6">Promet brez DDV</td>
            <td className="p-3 text-right">{fmt(fin.summary.totalSubtotal)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 pl-6">DDV</td>
            <td className="p-3 text-right">{fmt(fin.summary.totalTax)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3 pl-6">Popusti</td>
            <td className="p-3 text-right text-red-600">-{fmt(fin.summary.totalDiscount)}</td>
          </tr>
          <tr className="border-b bg-muted/30">
            <td className="p-3 font-medium">Po plačilnih metodah</td>
            <td className="p-3 text-right"></td>
          </tr>
          {fin.paymentMethods.map((pm, idx) => (
            <tr key={idx} className="border-b">
              <td className="p-3 pl-6">{paymentMethodLabels[pm.method] || pm.method} ({pm.count} naročil)</td>
              <td className="p-3 text-right">{fmt(pm.revenue)}</td>
            </tr>
          ))}
          <tr className="border-b bg-muted/30">
            <td className="p-3 font-medium">Po vrstah naročil</td>
            <td className="p-3 text-right"></td>
          </tr>
          {fin.orderTypes.map((ot, idx) => (
            <tr key={idx} className="border-b">
              <td className="p-3 pl-6">{orderTypeLabels[ot.type] || ot.type} ({ot.count} naročil)</td>
              <td className="p-3 text-right">{fmt(ot.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
