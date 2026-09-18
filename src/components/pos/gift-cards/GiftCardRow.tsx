'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, ArrowDownToLine, Calendar, User, Hash, CheckCircle2, Clock, History, Ban } from 'lucide-react'
import { type GiftCard, statusConfig, formatDateSI, formatCurrency } from './constants'

// --- Props ---

interface GiftCardRowProps {
  card: GiftCard
  onOpenHistory: (_card: GiftCard) => void
  onOpenLoad: (_card: GiftCard) => void
  onOpenEdit: (_card: GiftCard) => void
  onConfirmDelete: (_card: GiftCard) => void
  onSuspendCard: (_card: GiftCard) => void
  onReactivateCard: (_card: GiftCard) => void
}

// --- Komponenta ---

export const GiftCardRow = memo(function GiftCardRow({
  card,
  onOpenHistory,
  onOpenLoad,
  onOpenEdit,
  onConfirmDelete,
  onSuspendCard,
  onReactivateCard,
}: GiftCardRowProps) {
  const cfg = statusConfig[card.status] || statusConfig.active

  // RUNDA 45: mini vrstica porabe (kot napredek nivoja v Zvestobi) —
  // prikaže delež preostanka; title tooltip razkrije porabljeno
  const initial = Number(card.initialBalance) || 0
  const remainingPct =
    initial > 0 ? Math.max(0, Math.min(100, Math.round((Number(card.balance) / initial) * 100))) : 0
  const spent = Math.max(0, initial - (Number(card.balance) || 0))

  return (
    <TableRow className="hover:bg-muted/40 transition-colors">
      <TableCell>
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-sm font-medium tabular-nums">{card.cardNumber}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{card.ownerName || '—'}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium text-sm tabular-nums text-muted-foreground">
        {formatCurrency(card.initialBalance)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <span className={`font-bold text-sm tabular-nums ${card.balance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {formatCurrency(card.balance)}
          </span>
          {/* RUNDA 45: delež preostanka — chip vrstica pod zneskom (ARIA progressbar) */}
          <div
            className="flex items-center gap-1.5"
            title={`Porabljeno ${formatCurrency(spent)} od ${formatCurrency(initial)}`}
          >
            <div
              role="progressbar"
              aria-label={`Preostanek kartice ${card.cardNumber}`}
              aria-valuenow={remainingPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 w-14 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  remainingPct > 25
                    ? 'bg-emerald-500'
                    : remainingPct > 0
                      ? 'bg-amber-500'
                      : 'bg-red-400'
                }`}
                style={{ width: `${remainingPct}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">{remainingPct} %</span>
          </div>
        </div>
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
