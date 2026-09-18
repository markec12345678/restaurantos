'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Award, Rocket } from 'lucide-react'
import { type LoyaltyAccount, tierConfig, tierBadgeStyles, transactionTypeConfig, transactionBadgeStyles, formatDateSI, formatPoints } from './constants'
import { LoyaltyTierProgress } from './LoyaltyTierProgress'
import { formatEUR } from '@/lib/safe-format'

// --- Props ---

interface LoyaltyHistoryDialogProps {
  open: boolean
  historyAccount: LoyaltyAccount | null
  accountDetail: LoyaltyAccount | null | undefined
  isLoadingDetail: boolean
  onOpenChange: (_open: boolean) => void
}

// --- Komponenta ---

export const LoyaltyHistoryDialog = memo(function LoyaltyHistoryDialog({
  open,
  historyAccount,
  accountDetail,
  isLoadingDetail,
  onOpenChange,
}: LoyaltyHistoryDialogProps) {
  const account = accountDetail || historyAccount
  if (!account) return null

  const transactions = account.transactions || []
  const tier = tierConfig[account.tier] || tierConfig.bronze
  const TierIcon = tier.icon

  // RUNDA 46: posebne vrste earn transakcij (R45/R44 backend jih zapisuje):
  //  • "Bonus nivoa …" → perk bonus (amber, Award)
  //  • "Povišanje nivoa …" → samodejni prehod nivoja (violet, Rocket)
  // Prej so se prikazovale kot navadne "Prislužene" z 0 točk — nejasno.
  const specialTx = (reason: string | null | undefined): { icon: React.ElementType; chip: string; label: string } | null => {
    if (!reason) return null
    if (reason.startsWith('Bonus nivoa')) {
      return { icon: Award, chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', label: 'Bonus nivoa' }
    }
    if (reason.startsWith('Povišanje nivoa')) {
      return { icon: Rocket, chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400', label: 'Povišanje nivoa' }
    }
    return null
  }

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
        <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/50">
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
                {transactions.map((tx) => {
                  const txConfig = transactionTypeConfig[tx.type] || transactionTypeConfig.adjust
                  const special = specialTx(tx.reason)
                  const TxIcon = special?.icon ?? txConfig.icon
                  const chipStyle = special?.chip ?? transactionBadgeStyles[tx.type] ?? transactionBadgeStyles.adjust
                  const typeLabel = special?.label ?? txConfig.label
                  return (
                    <TableRow key={tx.id} className="transition-colors hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${chipStyle}`} title={special ? tx.reason ?? undefined : undefined}>
                            <TxIcon className="h-3.5 w-3.5" />
                          </div>
                          <Badge className={`text-xs ${chipStyle}`}>
                            {typeLabel}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${tx.points > 0 ? 'text-emerald-600 dark:text-emerald-400' : tx.points < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {tx.points > 0 ? '+' : ''}{formatPoints(tx.points)}
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
          <div className="text-center py-8">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">Ni transakcij za ta račun</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
