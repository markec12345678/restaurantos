'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Gift } from 'lucide-react'
import { GiftCardFilters } from './GiftCardFilters'
import { GiftCardRow } from './GiftCardRow'
import type { GiftCard } from './constants'
import type { SortField, SortDir } from './GiftCardTableHeader'

const GiftCardTableHeader = dynamic(() => import('./GiftCardTableHeader').then(m => ({ default: m.GiftCardTableHeader })), { ssr: false })

// --- Tipi ---

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
              <GiftCardTableHeader sortField={sortField} sortDir={sortDir} onSort={onSort} />
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
