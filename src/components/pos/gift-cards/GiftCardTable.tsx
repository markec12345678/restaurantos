'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  TableHeader,
} from '@/components/ui/table'
import { ArrowUpDown, Gift } from 'lucide-react'
import { GiftCardFilters } from './GiftCardFilters'
import { GiftCardRow } from './GiftCardRow'
import type { GiftCard } from './constants'

// --- Tipi ---

type SortField = 'purchasedAt' | 'balance' | 'cardNumber'
type SortDir = 'asc' | 'desc'

interface GiftCardTableProps {
  allCards: GiftCard[]
  filteredCards: GiftCard[]
  search: string
  statusFilter: string
  sortField: SortField
  sortDir: SortDir
  onSearchChange: (_value: string) => void
  onStatusFilterChange: (_value: string) => void
  onSort: (_field: SortField) => void
  onOpenNewCard: () => void
  onOpenHistory: (_card: GiftCard) => void
  onOpenLoad: (_card: GiftCard) => void
  onOpenEdit: (_card: GiftCard) => void
  onConfirmDelete: (_card: GiftCard) => void
  onSuspendCard: (_card: GiftCard) => void
  onReactivateCard: (_card: GiftCard) => void
}

// --- Pomožna komponenta za ikono sortiranja ---

const SortIcon = memo(function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
  return sortDir === 'asc'
    ? <ArrowUpDown className="h-3 w-3 ml-1 text-primary" />
    : <ArrowUpDown className="h-3 w-3 ml-1 text-primary rotate-180" />
})

// --- Komponenta ---

export const GiftCardTable = memo(function GiftCardTable({
  allCards,
  filteredCards,
  search,
  statusFilter,
  sortField,
  sortDir,
  onSearchChange,
  onStatusFilterChange,
  onSort,
  onOpenNewCard,
  onOpenHistory,
  onOpenLoad,
  onOpenEdit,
  onConfirmDelete,
  onSuspendCard,
  onReactivateCard,
}: GiftCardTableProps) {
  return (
    <>
      {/* Filtri */}
      <GiftCardFilters
        search={search}
        statusFilter={statusFilter}
        onSearchChange={onSearchChange}
        onStatusFilterChange={onStatusFilterChange}
        onOpenNewCard={onOpenNewCard}
      />

      {/* Tabela kartic */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
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
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Gift className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Ni darilnih kartic</p>
                        <p className="text-xs text-muted-foreground">
                          {search || statusFilter !== 'all'
                            ? 'Poskusite spremeniti filtre iskanja'
                            : 'Ustvarite novo darilno kartico za začetek'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <GiftCardRow
                      key={card.id}
                      card={card}
                      onOpenHistory={onOpenHistory}
                      onOpenLoad={onOpenLoad}
                      onOpenEdit={onOpenEdit}
                      onConfirmDelete={onConfirmDelete}
                      onSuspendCard={onSuspendCard}
                      onReactivateCard={onReactivateCard}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredCards.length > 0 && (
            <div className="border-t px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Prikazanih {filteredCards.length} od {allCards.length} kartic</span>
              {search && <span>Iskanje: &bdquo;{search}&ldquo;</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
})
