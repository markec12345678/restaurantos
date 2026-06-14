'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Clock, History } from 'lucide-react'
import { type GiftCard, statusConfig, transactionTypeConfig, formatCurrency, formatDateTimeSI } from './constants'

// --- Props ---

interface TransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  target: GiftCard | null
}

// --- Komponenta ---

export const TransactionHistoryDialog = memo(function TransactionHistoryDialog({
  open,
  onOpenChange,
  target,
}: TransactionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(openVal) => { if (!openVal) { onOpenChange(false) } onOpenChange(openVal) }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Zgodovina transakcij
          </DialogTitle>
          <DialogDescription>
            Transakcije za kartico {target?.cardNumber}
            {target?.ownerName ? ` — ${target.ownerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {/* Info o kartici */}
            <div className="rounded-lg bg-muted/50 p-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Trenutno stanje</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(target.balance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Začetno stanje</p>
                <p className="font-medium">{formatCurrency(target.initialBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={`text-[10px] px-2 py-0.5 ${(statusConfig[target.status] || statusConfig.active).bgColor}`}>
                  {(statusConfig[target.status] || statusConfig.active).label}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Seznam transakcij */}
            {(target.transactions || []).length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ni transakcij</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(target.transactions || []).map((tx) => {
                  const txConfig = transactionTypeConfig[tx.type] || transactionTypeConfig.adjust
                  const TxIcon = txConfig.icon
                  return (
                    <div
                      key={tx.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${txConfig.bgColor}`}>
                        <TxIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] px-1.5 py-0 ${txConfig.bgColor}`}>
                              {txConfig.label}
                            </Badge>
                            <span className={`font-bold text-sm ${tx.amount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDateTimeSI(tx.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Stanje po: <span className="font-medium text-foreground">{formatCurrency(tx.balanceAfter)}</span></span>
                          {tx.note && <span className="truncate">Opomba: {tx.note}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
