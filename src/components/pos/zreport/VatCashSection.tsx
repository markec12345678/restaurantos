'use client'

// ═══════════════════════════════════════════════════════════════
// DDV RAZČLENITEV + GOTOVINA — dve kartici z DDV in gotovinsko blagajno
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt, PiggyBank, AlertTriangle } from 'lucide-react'
import { formatCurrency } from './constants'
import type { VatCashSectionProps } from './constants'

export const VatCashSection = memo(function VatCashSection({ report }: VatCashSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* DDV razčlenitev */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> DDV razčlenitev
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* DDV 22% — standardna stopnja */}
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="font-medium">DDV 22%</span>
                <span className="text-xs text-muted-foreground ml-2">Standardna stopnja</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(report.vatStandardAmount)}</div>
                <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatStandard)}</div>
              </div>
            </div>
            {/* DDV 9.5% — znižana stopnja */}
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="font-medium">DDV 9.5%</span>
                <span className="text-xs text-muted-foreground ml-2">Znižana stopnja</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(report.vatReducedAmount)}</div>
                <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatReduced)}</div>
              </div>
            </div>
            {/* DDV 0% — oproščeno */}
            <div className="flex justify-between items-center py-2">
              <div>
                <span className="font-medium">DDV 0%</span>
                <span className="text-xs text-muted-foreground ml-2">Oproščeno</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">€0.00</div>
                <div className="text-xs text-muted-foreground">Osnova: {formatCurrency(report.vatZero)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gotovina */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="h-4 w-4" /> Gotovina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Začetno stanje</span>
              <span className="font-medium">{formatCurrency(report.startingCash)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Pričakovano</span>
              <span className="font-medium">{formatCurrency(report.expectedCash)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Dejansko šteto</span>
              <span className="font-medium">{formatCurrency(report.actualCash)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium">Razlika</span>
              <span className={`font-bold text-lg ${
                report.cashDifference > 0 ? 'text-green-600' :
                report.cashDifference < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {report.cashDifference > 0 ? '+' : ''}{formatCurrency(report.cashDifference)}
              </span>
            </div>
            {/* Opozorilo o razliki */}
            {Math.abs(report.cashDifference) > 5 && (
              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Razlika presega €5.00 — preverite gotovino!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
