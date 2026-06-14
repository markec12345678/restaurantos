'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'
import type { BookingEntry } from './types'

// ============================================
// KNJIŽBENI ZAPIS — Dvostrani vnos (breme/dobro)
// ============================================

interface BookingEntryTableProps {
  be: BookingEntry
  fmt: (_n: number) => string
}

export const BookingEntryTable = memo(function BookingEntryTable({ be, fmt }: BookingEntryTableProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Knjižbeni zapis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/10 border-b">
                <th className="text-left p-3 font-medium">Konto</th>
                <th className="text-left p-3 font-medium">Opis</th>
                <th className="text-right p-3 font-medium">Breme (D)</th>
                <th className="text-right p-3 font-medium">Dobro (C)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(be.debit).map(([account, amount]) => (
                <tr key={account} className="border-b">
                  <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                  <td className="p-3">{account.split(' - ')[1]}</td>
                  <td className="p-3 text-right font-semibold">{fmt(amount)}</td>
                  <td className="p-3 text-right">—</td>
                </tr>
              ))}
              {Object.entries(be.credit).map(([account, amount]) => (
                <tr key={account} className="border-b bg-muted/30">
                  <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                  <td className="p-3">{account.split(' - ')[1]}</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right font-semibold">{fmt(amount)}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="p-3" colSpan={2}>SKUPAJ</td>
                <td className="p-3 text-right">{fmt(be.totalDebit)}</td>
                <td className="p-3 text-right">{fmt(be.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
          {Math.abs(be.totalDebit - be.totalCredit) > 0.01 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
              Opozorilo: Zneske se ne ujemajo! Razlika: {fmt(Math.abs(be.totalDebit - be.totalCredit))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
