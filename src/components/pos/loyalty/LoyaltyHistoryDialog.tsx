'use client'

import { memo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Award, Rocket, ArrowUpCircle, ArrowDownCircle, RotateCcw, Hourglass, Filter, Sigma } from 'lucide-react'
import { type LoyaltyAccount, tierConfig, tierBadgeStyles, formatDateSI, formatPoints } from './constants'
import { LoyaltyTierProgress } from './LoyaltyTierProgress'
import { formatEUR } from '@/lib/safe-format'
import {
  type LoyaltyTxCategory,
  loyaltyTxCategory,
  presentLoyaltyTxCategories,
  loyaltyTxSummary,
  LOYALTY_TX_CATEGORY_META,
} from '@/lib/loyalty-tx-category'

// --- Ikone po kategoriji (prezentacija ostane v komponenti; barve/oznake v lib) ---

const CATEGORY_ICON: Record<LoyaltyTxCategory, React.ElementType> = {
  earn: ArrowUpCircle,
  bonus: Award,
  upgrade: Rocket,
  redeem: ArrowDownCircle,
  adjust: RotateCcw,
  expire: Hourglass,
}

type FilterValue = LoyaltyTxCategory | 'all'

// --- Props ---

interface LoyaltyHistoryDialogProps {
  open: boolean
  historyAccount: LoyaltyAccount | null
  accountDetail: LoyaltyAccount | null | undefined
  isLoadingDetail: boolean
  onOpenChange: (_open: boolean) => void
}

// --- Komponenta ---

/**
 * RUNDA 50: zunanja ovojnica samo dodeli `key` = (open, račun). Vsako
 * odprtje ali zamenjava člana REMOUNTA notranjost → filter se znastavi
 * na 'Vse' brez setState-v-effect (react-hooks/set-state-in-effect).
 */
export const LoyaltyHistoryDialog = memo(function LoyaltyHistoryDialog(props: LoyaltyHistoryDialogProps) {
  const sessionKey = `${props.open ? 'open' : 'closed'}-${props.historyAccount?.id ?? 'none'}`
  return <LoyaltyHistoryDialogInner key={sessionKey} {...props} />
})

const LoyaltyHistoryDialogInner = memo(function LoyaltyHistoryDialogInner({
  open,
  historyAccount,
  accountDetail,
  isLoadingDetail,
  onOpenChange,
}: LoyaltyHistoryDialogProps) {
  const [filter, setFilter] = useState<FilterValue>('all')

  const account = accountDetail || historyAccount
  if (!account) return null

  const transactions = account.transactions || []
  const tier = tierConfig[account.tier] || tierConfig.bronze
  const TierIcon = tier.icon

  // RUNDA 50: kategorizacija prek skupne knjižnice (ENOTEN VIR — prej lokalna
  // specialTx funkcija). Filter čipi samo za prisotne kategorije; povzetek
  // opisuje TOČNO filtrirano množico (ob "Vse" = celotna zgodovina).
  const categories = presentLoyaltyTxCategories(transactions)
  const filtered =
    filter === 'all' ? transactions : transactions.filter((tx) => loyaltyTxCategory(tx) === filter)
  const summary = loyaltyTxSummary(filtered)

  const categoryCounts = new Map<LoyaltyTxCategory, number>()
  for (const tx of transactions) {
    const c = loyaltyTxCategory(tx)
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
      key: 'earned',
      label: 'Prisluženo',
      value: summary.earned,
      sign: '+',
      icon: ArrowUpCircle,
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      accent: 'border-t-emerald-500/70',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'spent',
      label: 'Unovčeno',
      value: summary.spent,
      sign: '−',
      icon: ArrowDownCircle,
      chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      accent: 'border-t-blue-500/70',
      valueClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'net',
      label: 'Neto',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Zgodovina transakcij
          </DialogTitle>
          <DialogDescription>
            Zgodovina transakcij za <strong>{account.customerName || 'stranko'}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Podatki o stranki */}
        <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/50 card-lift hover:shadow-sm transition-shadow">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tier.bgColor} ${tier.color}`}>
            <TierIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{account.customerName || 'Brez imena'}</p>
              <Badge className={`text-xs ${tierBadgeStyles[account.tier] || tierBadgeStyles.bronze}`}>
                {tier.label}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              {account.customerPhone && <span>{account.customerPhone}</span>}
              {account.customerEmail && <span>{account.customerEmail}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg tabular-nums">{formatPoints(account.pointsBalance)}</p>
            <p className="text-xs text-muted-foreground">Stanje točk</p>
          </div>
        </div>

        {/* R44: živ napredek do naslednjega nivoja (isti izračun kot samodejno povišanje) */}
        <LoyaltyTierProgress lifetimePoints={account.lifetimePoints} tier={account.tier} />

        <Separator />

        {/* Tabela transakcij */}
        {isLoadingDetail ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-3">
            {/* RUNDA 50: povzetek filtrirane množice — 3 KPI kartice
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
                      {c.sign === 'auto' ? (summary.net > 0 ? '+' : '') : c.sign}
                      {formatPoints(c.value)}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">t.</span>
                    </p>
                  </div>
                )
              })}
            </div>

            {/* RUNDA 50: filter čipi po kategoriji (samo prisotne, s števci) */}
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
                const meta = LOYALTY_TX_CATEGORY_META[cat]
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
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vrsta</TableHead>
                      <TableHead className="text-right">Točke</TableHead>
                      <TableHead>Razlog</TableHead>
                      <TableHead className="text-right">Vrednost (€)</TableHead>
                      <TableHead>Datum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tx, idx) => {
                      const category = loyaltyTxCategory(tx)
                      const meta = LOYALTY_TX_CATEGORY_META[category]
                      const TxIcon = CATEGORY_ICON[category]
                      return (
                        <TableRow
                          key={tx.id}
                          className="transition-colors hover:bg-muted/40 animate-fade-in-up"
                          style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.chip}`}
                                title={category === 'bonus' || category === 'upgrade' ? tx.reason ?? undefined : undefined}
                              >
                                <TxIcon className="h-3.5 w-3.5" aria-hidden />
                              </div>
                              <Badge className={`text-xs ${meta.chip}`}>{meta.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              tx.points > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : tx.points < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {tx.points > 0 ? '+' : ''}
                            {formatPoints(tx.points)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={tx.reason || undefined}>
                            {tx.reason || '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {tx.monetaryValue > 0 ? `${formatEUR(tx.monetaryValue)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {formatDateSI(tx.createdAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
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
        ) : (
          <div className="text-center py-8">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">Ni transakcij za ta račun</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
