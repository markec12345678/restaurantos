'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldCheck, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import type { ComplianceSummaryCardsProps } from './constants'

// Povzetek skladnosti — števci po statusih
export const ComplianceSummaryCards = memo(function ComplianceSummaryCards({
  complianceScore,
  compliantCount,
  warningCount,
  nonCompliantCount,
  pendingCount,
}: ComplianceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      <Card className={complianceScore >= 80 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
        <CardContent className="p-3 text-center">
          <ShieldCheck className={`h-5 w-5 mx-auto mb-1 ${complianceScore >= 80 ? 'text-green-500' : 'text-red-500'}`} />
          <p className="text-xl font-bold">{complianceScore}%</p>
          <p className="text-xs text-muted-foreground">Skupna skladnost</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-600">{compliantCount}</p>
          <p className="text-xs text-muted-foreground">Skladno</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          <p className="text-xs text-muted-foreground">Opozorila</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-600">{nonCompliantCount}</p>
          <p className="text-xs text-muted-foreground">Neskladno</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-blue-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">V postopku</p>
        </CardContent>
      </Card>
    </div>
  )
})
