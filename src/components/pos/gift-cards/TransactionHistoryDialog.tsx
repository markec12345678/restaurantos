'use client'

import { memo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Clock, History, ArrowDownToLine, Wallet, RefreshCw, ArrowUpDown, Filter, Sigma } from 'lucide-react'
import { type GiftCard, statusConfig, formatCurrency, formatDateTimeSI } from './constants'
import {
  type GiftCardTxCategory,
  giftCardTxCategory,
  presentGiftCardTxCategories,
  giftCardTxSummary,
  GIFT_CARD_TX_CATEGORY_META,
} from '@/lib/gift-card-tx-category'

// --- Ikone po kategoriji (prezentacija ostane v komponenti; barve/oznake v lib) ---

const CATEGORY_ICON: Record<GiftCardTxCategory, React.ElementType> = {
  load: ArrowDownToLine,
  redeem: Wallet,
  transfer: RefreshCw,
  adjust: ArrowUpDown,
}

type FilterValue = GiftCardTxCategory | 'all'

// --- Props ---

interface TransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
}

// --- Komponenta ---

/**
 * RUNDA 51: zunanja ovojnica samo dodeli `key` = (open, kartica). Vsako
 * odprtje ali zamenjava kartice REMOUNTA notranjost → filter se znastavi
 * na 'Vse' brez setState-v-effect (react-hooks/set-state-in-effect).
 * Isti vzorec kot LoyaltyHistoryDialog (R50).
 */
export const TransactionHistoryDialog = memo(function TransactionHistoryDialog(
  props: TransactionHistoryDialogProps,
) {
  const sessionKey = `${props.open ? 'open' : 'closed'}-${props.target?.id ?? 'none'}`
  return <TransactionHistoryDialogInner key={sessionKey} {...props} />
})

const TransactionHistoryDialogInner = memo(function TransactionHistoryDialogInner({
  open,
  onOpenChange,
  target,
}: TransactionHistoryDialogProps) {
  const [filter, setFilter] = useState<FilterValue>('all')

  if (!target) return null

  const transactions = target.transactions || []

  // RUNDA 51: kategorizacija prek skupne knjižnice (ENOTEN VIR — prej
  // transactionTypeConfig v constants.ts). Filter čipi samo za prisotne
  // kategorije; povzetek opisuje TOČNO filtrirano množico (ob "Vse" =
  // celotna zgodovina kartice).
  const categories = presentGiftCardTxCategories(transactions)
  const filtered =
    filter === 'all' ? transactions : transactions.filter((tx) => giftCardTxCategory(tx) === filter)
  const summary = giftCardTxSummary(filtered)

  const categoryCounts = new Map<GiftCardTxCategory, number>()
  for (const tx of transactions) {
    const c = giftCardTxCategory(tx)
    categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }

  const netValueClass =
    summary.net > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : summary.net < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'

  const statCards: Array<{
    key: string
    label: string
    value: number
    sign: '+' | '−' | 'auto'
    icon: React.ElementType
    chip: string
    accent: string
    valueClass: string
  }> = [
    {
      key: 'loaded',
      label: 'Naloženo',
      value: summary.loaded,
      sign: '+',
      icon: ArrowDownToLine,
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      accent: 'border-t-emerald-500/70',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'spent',
      label: 'Porabljeno',
      value: summary.spent,
      sign: '−',
      icon: Wallet,
      chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      accent: 'border-t-red-500/70',
      valueClass: 'text-red-600 dark:text-red-400',
    },
    {
      key: 'net',
      label: 'Neto sprememba',
      value: summary.net,
      sign: 'auto',
      icon: Sigma,
      chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      accent: 'border-t-primary/50',
      valueClass: netValueClass,
    },
  ]

  const chipClasses = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
    }`

  return (
    <Dialog open={open} onOpenChange={(openVal) => { if (!openVal) { onOpenChange(false) } onOpenChange(openVal) }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Zgodovina transakcij
          </DialogTitle>
          <DialogDescription>
            Transakcije za kartico {target.cardNumber}
            {target.ownerName ? ` — ${target.ownerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Info o kartici */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/50 p-3 text-sm card-lift hover:shadow-sm transition-shadow">
          <div>
            <p className="text-xs text-muted-foreground">Trenutno stanje</p>
            <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(target.balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Začetno stanje</p>
            <p className="font-medium tabular-nums">{formatCurrency(target.initialBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className={`text-[10px] px-2 py-0.5 ${(statusConfig[target.status] || statusConfig.active).bgColor}`}>
              {(statusConfig[target.status] || statusConfig.active).label}
            </Badge>
          </div>
        </div>

        <Separator />

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ni transakcij</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* RUNDA 51: povzetek filtrirane množice — 3 KPI kartice
                (accent zgornji rob, ikonski čip, tabular-nums, staggered) */}
            <div className="grid grid-cols-3 gap-2">
              {statCards.map((c, i) => {
                const Icon = c.icon
                return (
                  <div
                    key={c.key}
                    className={`rounded-lg border border-border/60 border-t-2 ${c.accent} bg-card p-2.5 card-lift hover:shadow-sm animate-fade-in-up`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${c.chip}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </p>
                    </div>
                    <p className={`mt-1.5 text-lg font-bold tabular-nums leading-none ${c.valueClass}`}>
                      {/* RUNDA 51 detajl: znak samo pri neničelni vrednosti
                          (−0,00 € je kozmetični šum); 'auto' = net po predznaku */}
                      {c.sign === 'auto' ? (summary.net > 0 ? '+' : '') : (c.value > 0 ? c.sign : '')}
                      {formatCurrency(c.value)}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* RUNDA 51: filter čipi po kategoriji (samo prisotne, s števci) */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter po vrsti transakcije"
            >
              <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <button
                type="button"
                className={chipClasses(filter === 'all')}
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                Vse
                <span className="tabular-nums opacity-70">({transactions.length})</span>
              </button>
              {categories.map((cat) => {
                const Icon = CATEGORY_ICON[cat]
                const meta = GIFT_CARD_TX_CATEGORY_META[cat]
                return (
                  <button
                    key={cat}
                    type="button"
                    className={chipClasses(filter === cat)}
                    aria-pressed={filter === cat}
                    onClick={() => setFilter(cat)}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {meta.label}
                    <span className="tabular-nums opacity-70">({categoryCounts.get(cat) ?? 0})</span>
                  </button>
                )
              })}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums" aria-hidden>
                {filtered.length}/{transactions.length}
              </span>
            </div>
            <p className="sr-only" aria-live="polite">
              Prikazanih {filtered.length} od {transactions.length} transakcij
            </p>

            {filtered.length > 0 ? (
              <div className="space-y-2">
                {filtered.map((tx, idx) => {
                  const category = giftCardTxCategory(tx)
                  const meta = GIFT_CARD_TX_CATEGORY_META[category]
                  const TxIcon = CATEGORY_ICON[category]
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-start gap-3 rounded-lg border border-border/60 border-t-2 ${meta.accent} p-3 transition-colors hover:bg-muted/40 animate-fade-in-up card-lift hover:shadow-sm`}
                      style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${meta.chip}`}>
                        <TxIcon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] px-1.5 py-0 ${meta.chip}`}>
                              {meta.label}
                            </Badge>
                            <span className={`font-bold text-sm tabular-nums ${tx.amount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                            {formatDateTimeSI(tx.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Stanje po: <span className="font-medium text-foreground tabular-nums">{formatCurrency(tx.balanceAfter)}</span></span>
                          {tx.note && <span className="truncate">Opomba: {tx.note}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">Ni transakcij za izbrani filter</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setFilter('all')}>
                  Pokaži vse
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
