'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Plus, Pencil, Trash2, ArrowDownToLine, Calendar, User, Hash, CheckCircle2, Clock, ArrowUpDown, History, Ban, Gift } from 'lucide-react'
import { type GiftCard, statusConfig, formatDateSI, formatCurrency } from './constants'

// --- Props ---

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
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Išči po številki kartice ali lastniku..."
                aria-label="Iskanje kartic"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-44" id="gc-status-filter">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi statusi</SelectItem>
                <SelectItem value="active">Aktivna</SelectItem>
                <SelectItem value="depleted">Porabljena</SelectItem>
                <SelectItem value="expired">Potekla</SelectItem>
                <SelectItem value="suspended">Suspendirana</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={onOpenNewCard}>
              <Plus className="h-4 w-4 mr-2" />
              Nova kartica
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  filteredCards.map((card) => {
                    const cfg = statusConfig[card.status] || statusConfig.active
                    return (
                      <TableRow key={card.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm font-medium">{card.cardNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{card.ownerName || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(card.initialBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold text-sm ${card.balance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {formatCurrency(card.balance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] px-2 py-0.5 ${cfg.bgColor}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} mr-1.5`} aria-hidden="true" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateSI(card.purchasedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {card.expiresAt ? formatDateSI(card.expiresAt) : 'Brez roka'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Zgodovina"
                              className="h-7 w-7"
                              title="Zgodovina transakcij"
                              onClick={() => onOpenHistory(card)}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Naloži sredstva"
                              className="h-7 w-7"
                              title="Naloži sredstva"
                              onClick={() => onOpenLoad(card)}
                              disabled={card.status === 'suspended'}
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                            </Button>
                            {card.status === 'active' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Suspendiraj"
                                className="h-7 w-7 text-amber-600"
                                title="Suspendiraj"
                                onClick={() => onSuspendCard(card)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            ) : (card.status === 'suspended' || card.status === 'expired') ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Reaktiviraj"
                                className="h-7 w-7 text-emerald-600"
                                title="Reaktiviraj"
                                onClick={() => onReactivateCard(card)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Uredi"
                              className="h-7 w-7"
                              title="Uredi"
                              onClick={() => onOpenEdit(card)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Izbriši"
                              className="h-7 w-7 text-destructive"
                              title="Izbriši"
                              onClick={() => onConfirmDelete(card)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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
