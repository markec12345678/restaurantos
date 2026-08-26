'use client'

import { memo } from 'react'
import {
  TableRow,
  TableHead,
  TableHeader,
} from '@/components/ui/table'
import { ArrowUpDown } from 'lucide-react'

type SortField = 'purchasedAt' | 'balance' | 'cardNumber'
type SortDir = 'asc' | 'desc'

interface GiftCardTableHeaderProps {
  sortField: SortField
  sortDir: SortDir
  onSort: (_field: SortField) => void
}

const SortIcon = memo(function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
  return sortDir === 'asc'
    ? <ArrowUpDown className="h-3 w-3 ml-1 text-primary" />
    : <ArrowUpDown className="h-3 w-3 ml-1 text-primary rotate-180" />
})

export const GiftCardTableHeader = memo(function GiftCardTableHeader({
  sortField,
  sortDir,
  onSort,
}: GiftCardTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead
          className="cursor-pointer select-none"
          role="button"
          tabIndex={0}
          onClick={() => onSort('cardNumber')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('cardNumber') } }}
        >
          <span className="flex items-center">Številka kartice <SortIcon field="cardNumber" sortField={sortField} sortDir={sortDir} /></span>
        </TableHead>
        <TableHead>Lastnik</TableHead>
        <TableHead className="text-right">Začetno stanje</TableHead>
        <TableHead
          className="text-right cursor-pointer select-none"
          role="button"
          tabIndex={0}
          onClick={() => onSort('balance')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('balance') } }}
        >
          <span className="flex items-center justify-end">Trenutno stanje <SortIcon field="balance" sortField={sortField} sortDir={sortDir} /></span>
        </TableHead>
        <TableHead>Status</TableHead>
        <TableHead
          className="cursor-pointer select-none"
          role="button"
          tabIndex={0}
          onClick={() => onSort('purchasedAt')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort('purchasedAt') } }}
        >
          <span className="flex items-center">Datum nakupa <SortIcon field="purchasedAt" sortField={sortField} sortDir={sortDir} /></span>
        </TableHead>
        <TableHead>Datum poteka</TableHead>
        <TableHead className="text-right">Dejanja</TableHead>
      </TableRow>
    </TableHeader>
  )
})

export type { SortField, SortDir }
