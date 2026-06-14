'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Award, Coins, History } from 'lucide-react'
import { type LoyaltyAccount, tierConfig, tierBadgeStyles, formatPoints } from './constants'

// --- Props ---

interface LoyaltyAccountTableProps {
  accounts: LoyaltyAccount[]
  totalAccounts: number
  tierFilter: string
  onOpenAdjust: (_account: LoyaltyAccount) => void
  onOpenHistory: (_account: LoyaltyAccount) => void
  onOpenEdit: (_account: LoyaltyAccount) => void
  onConfirmDelete: (_account: LoyaltyAccount) => void
  onOpenCreate: () => void
  search: string
}

// --- Komponenta ---

export const LoyaltyAccountTable = memo(function LoyaltyAccountTable({
  accounts,
  totalAccounts,
  tierFilter,
  onOpenAdjust,
  onOpenHistory,
  onOpenEdit,
  onConfirmDelete,
  onOpenCreate,
  search,
}: LoyaltyAccountTableProps) {
  // Prazno stanje
  if (accounts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
          <Award className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Ni zvestobnih računov</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
          {search || tierFilter !== 'all'
            ? 'Za izbrane filtre ni računov. Poskusite spremeniti filter.'
            : 'Ustvarite prvi zvestobni račun za začetek programa zvestobe.'}
        </p>
        <Button onClick={onOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj račun
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ime stranke</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Nivo</TableHead>
                <TableHead className="text-right">Stanje točk</TableHead>
                <TableHead className="text-right">Doslej zbrane</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dejanja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const tier = tierConfig[account.tier] || tierConfig.bronze
                const TierIcon = tier.icon

                return (
                  <TableRow key={account.id} className={!account.isActive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tier.bgColor} ${tier.color} flex-shrink-0`}>
                          <TierIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{account.customerName || 'Brez imena'}</p>
                          {account.customerEmail && (
                            <p className="text-xs text-muted-foreground truncate max-w-36">{account.customerEmail}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{account.customerPhone || '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${tierBadgeStyles[account.tier] || tierBadgeStyles.bronze}`}>
                        {tier.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatPoints(account.pointsBalance)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatPoints(account.lifetimePoints)}</TableCell>
                    <TableCell>
                      {account.isActive ? (
                        <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Aktiven
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                          Nedejaven
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Prilagodi točke" className="h-7 w-7" title="Prilagodi točke" onClick={() => onOpenAdjust(account)}>
                          <Coins className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Zgodovina" className="h-7 w-7" title="Zgodovina" onClick={() => onOpenHistory(account)}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" title="Uredi" onClick={() => onOpenEdit(account)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => onConfirmDelete(account)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground px-4 py-3 border-t">
          <span>Prikazanih {accounts.length} od {totalAccounts} računov</span>
          {tierFilter !== 'all' && (
            <span>Filter: {tierConfig[tierFilter]?.label || tierFilter}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
