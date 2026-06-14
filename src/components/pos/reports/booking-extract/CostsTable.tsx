'use client'

import { memo } from 'react'
import type { CostsData } from './types'

// ============================================
// STROŠKOVNA STRAN — Nabavni stroški, COGS, odpisi, bruto dobiček
// ============================================

interface CostsTableProps {
  costs: CostsData
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

export const CostsTable = memo(function CostsTable({ costs, fmt, fmtPct }: CostsTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 bg-muted/50 border-b font-medium">Stroškovna stran</div>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="p-3">Nabavni stroški (dobave)</td>
            <td className="p-3 text-right text-orange-600">{fmt(costs.procurementCost)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Stroški prodanih artiklov (COGS)</td>
            <td className="p-3 text-right text-red-600">{fmt(costs.cogs)}</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Odpisi (kvar, razbitje, izguba)</td>
            <td className="p-3 text-right text-yellow-600">{fmt(costs.writeOffCost)}</td>
          </tr>
          <tr className="bg-green-50 dark:bg-green-900/20">
            <td className="p-3 font-bold">Bruto dobiček</td>
            <td className="p-3 text-right font-bold text-green-600">{fmt(costs.grossProfit)} (marža: {fmtPct(costs.grossMargin)})</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
})
