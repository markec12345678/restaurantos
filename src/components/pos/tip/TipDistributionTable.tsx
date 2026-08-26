'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle2 } from 'lucide-react'
import type { TipDistribution, TipPoolData } from './constants'
import { formatCurrency } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface TipDistributionTableProps {
  pool: TipPoolData
  editingAmounts: Record<string, string>
  onAmountChange: (_employeeId: string, _value: string) => void
  onSaveManual: () => void
  isSavePending: boolean
}

export const TipDistributionTable = memo(function TipDistributionTable({
  pool,
  editingAmounts,
  onAmountChange,
  onSaveManual,
  isSavePending,
}: TipDistributionTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Distribucija napitnin</CardTitle>
          {pool.distributionMethod === 'manual' && pool.status === 'pending' && (
            <Button size="sm" onClick={onSaveManual} disabled={isSavePending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Shrani
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pool.distributions.map((d: TipDistribution) => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  {d.employeeName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{d.employeeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.hoursWorked > 0 && `${d.hoursWorked}h`}
                    {d.hoursWorked > 0 && d.points > 0 && ' · '}
                    {d.points > 0 && `${d.points} točk`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pool.distributionMethod === 'manual' && pool.status === 'pending' ? (
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24 h-8 text-right"
                    value={editingAmounts[d.employeeId] ?? safeToFixed(d.amount, 2)}
                    onChange={(e) => onAmountChange(d.employeeId, e.target.value)}
                  />
                ) : (
                  <span className="font-bold text-green-600">{formatCurrency(d.amount)}</span>
                )}
                {d.status === 'paid' && (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Izplačano</Badge>
                )}
              </div>
            </div>
          ))}
          {pool.distributions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Ni zaposlenih za distribucijo
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
