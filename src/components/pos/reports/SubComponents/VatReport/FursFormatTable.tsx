'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'

// ============================================
// FURS DAVČNI FORMAT — Tabela za FURS izpis
// ============================================

interface FursFormatTableProps {
  fursFormat: Array<{ code: string; taxRate: number; taxBase: number; taxAmount: number }>
  fmt: (_n: number) => string
}

export const FursFormatTable = memo(function FursFormatTable({ fursFormat, fmt }: FursFormatTableProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          FURS davčni format
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/10 border-b">
                <th className="text-left p-3 font-medium">Koda</th>
                <th className="text-right p-3 font-medium">Stopnja (%)</th>
                <th className="text-right p-3 font-medium">Davčna osnova</th>
                <th className="text-right p-3 font-medium">DDV znesek</th>
              </tr>
            </thead>
            <tbody>
              {fursFormat.map((f, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-3 font-mono font-bold">{f.code}</td>
                  <td className="p-3 text-right">{f.taxRate}%</td>
                  <td className="p-3 text-right">{fmt(f.taxBase)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(f.taxAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Kode: S = Standardna stopnja (22%), R = Znižana stopnja (9.5%), Z = Oproščeno (0%)
        </p>
      </CardContent>
    </Card>
  )
})
