'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Receipt } from 'lucide-react'
import type { InvoicesTableProps } from './constants'

// ============================================
// TABELA RAČUNOV — Prikaz računov naročnine
// ============================================

export const InvoicesTable = memo(function InvoicesTable({ invoices }: InvoicesTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Računi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">Št. računa</th>
                <th className="text-right p-3 font-medium">Znesek</th>
                <th className="text-left p-3 font-medium">Obdobje</th>
                <th className="text-right p-3 font-medium">Zapadlost</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={String(inv.id)} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{String(inv.invoiceNumber ?? inv.number ?? '')}</td>
                  <td className="p-3 text-right font-semibold">€{((inv.totalAmount ?? inv.amount ?? 0) as number).toFixed(2)}</td>
                  <td className="p-3 text-xs">{inv.periodStart ? new Date(String(inv.periodStart)).toLocaleDateString('sl-SI') : '-'} - {inv.periodEnd ? new Date(String(inv.periodEnd)).toLocaleDateString('sl-SI') : '-'}</td>
                  <td className="p-3 text-right text-xs">{inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString('sl-SI') : '-'}</td>
                  <td className="p-3 text-center">
                    <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className={inv.status === 'paid' ? 'bg-green-600' : inv.status === 'overdue' ? 'bg-red-600' : ''}>
                      {inv.status === 'paid' ? 'Plačan' : inv.status === 'overdue' ? 'Zapadel' : 'Čakajoč'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})
