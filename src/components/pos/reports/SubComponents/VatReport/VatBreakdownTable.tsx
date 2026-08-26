'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ============================================
// DDV PO STOPNJAH — Tabela s stopnjami in tortni diagram
// ============================================

interface VatBreakdownTableProps {
  vatBreakdown: Array<{ rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number; itemCount: number }>
  vatColors: Record<string, string>
  fmt: (_n: number) => string
  summary: { totalBase: number; totalVat: number; totalWithVat: number }
}

export const VatBreakdownTable = memo(function VatBreakdownTable({ vatBreakdown, vatColors, fmt, summary }: VatBreakdownTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">DDV po stopnjah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">Stopnja</th>
                <th className="text-right p-3 font-medium">Osnova</th>
                <th className="text-right p-3 font-medium">DDV</th>
                <th className="text-right p-3 font-medium">Skupaj</th>
                <th className="text-right p-3 font-medium">Koda</th>
              </tr>
            </thead>
            <tbody>
              {vatBreakdown.map((vr, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: vatColors[String(vr.rate)] || '#888' }} />
                      <span className="font-medium">{vr.label}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right">{fmt(vr.baseAmount)}</td>
                  <td className="p-3 text-right font-semibold" style={{ color: vatColors[String(vr.rate)] }}>{fmt(vr.vatAmount)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(vr.totalAmount)}</td>
                  <td className="p-3 text-right"><Badge variant="outline" className="font-mono text-xs">{vr.code}</Badge></td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="p-3">SKUPAJ</td>
                <td className="p-3 text-right">{fmt(summary.totalBase)}</td>
                <td className="p-3 text-right">{fmt(summary.totalVat)}</td>
                <td className="p-3 text-right">{fmt(summary.totalWithVat)}</td>
                <td className="p-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})
