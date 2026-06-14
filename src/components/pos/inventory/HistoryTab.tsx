'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw } from 'lucide-react'
import {
  type TransactionData,
  type TransactionSummary,
  type TransactionsResponse,
  transactionTypeLabels,
  transactionTypeColors,
  formatDateTimeSI,
} from './constants'

// --- Props ---

interface HistoryTabProps {
  transactionsData: TransactionsResponse | undefined
  txLoading: boolean
  txTypeFilter: string
  onTxTypeFilterChange: (_value: string) => void
  txDateFrom: string
  onTxDateFromChange: (_value: string) => void
  txDateTo: string
  onTxDateToChange: (_value: string) => void
  onClearFilters: () => void
}

// --- Komponenta ---

export const HistoryTab = memo(function HistoryTab({
  transactionsData,
  txLoading,
  txTypeFilter,
  onTxTypeFilterChange,
  txDateFrom,
  onTxDateFromChange,
  txDateTo,
  onTxDateToChange,
  onClearFilters,
}: HistoryTabProps) {
  return (
    <>
      {/* Filtri */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <Label className="text-xs">Vrsta transakcije</Label>
              <Select value={txTypeFilter} onValueChange={onTxTypeFilterChange}>
                <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse vrste</SelectItem>
                  <SelectItem value="procurement">Nabava</SelectItem>
                  <SelectItem value="sale">Prodaja</SelectItem>
                  <SelectItem value="write-off">Odpis</SelectItem>
                  <SelectItem value="adjustment">Popravek</SelectItem>
                  <SelectItem value="return">Vrnitev</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Od datuma</Label>
              <Input type="date" value={txDateFrom} onChange={(e) => onTxDateFromChange(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Do datuma</Label>
              <Input type="date" value={txDateTo} onChange={(e) => onTxDateToChange(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" className="h-9 mt-4" onClick={onClearFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Počisti
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Povzetek */}
      {transactionsData?.summary && transactionsData.summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {transactionsData.summary.map((s: TransactionSummary) => (
            <Card key={s.type} className="cursor-pointer hover:shadow-md transition-shadow" role="button" tabIndex={0} onClick={() => onTxTypeFilterChange(s.type)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTxTypeFilterChange(s.type) } }}>
              <CardContent className="p-3 text-center">
                <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-1 ${transactionTypeColors[s.type] || 'bg-gray-100'}`}>
                  {transactionTypeLabels[s.type] || s.type}
                </div>
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">€{Math.abs(s.totalCost).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela transakcij */}
      {txLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Datum</th>
                    <th className="text-left p-3 font-medium">Artikel</th>
                    <th className="text-left p-3 font-medium">Vrsta</th>
                    <th className="text-right p-3 font-medium">Količina</th>
                    <th className="text-right p-3 font-medium">Prej</th>
                    <th className="text-right p-3 font-medium">Potem</th>
                    <th className="text-right p-3 font-medium">Vrednost</th>
                    <th className="text-left p-3 font-medium">Razlog</th>
                    <th className="text-left p-3 font-medium">Izvedel</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactionsData?.transactions || []).map((tx: TransactionData) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap">{formatDateTimeSI(tx.createdAt)}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{tx.inventoryItem.name}</p>
                          <p className="text-xs text-muted-foreground">{tx.inventoryItem.unit}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${transactionTypeColors[tx.type] || 'bg-gray-100'}`}>
                          {transactionTypeLabels[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-medium ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.inventoryItem.unit}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{tx.previousQty}</td>
                      <td className="p-3 text-right font-medium">{tx.newQty}</td>
                      <td className={`p-3 text-right ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        €{Math.abs(tx.totalCost).toFixed(2)}
                      </td>
                      <td className="p-3 max-w-40 truncate">{tx.reason || '—'}</td>
                      <td className="p-3 text-muted-foreground">{tx.employeeName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(transactionsData?.transactions || []).length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Ni najdenih transakcij</p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
})
