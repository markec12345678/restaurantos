'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, CheckCircle, AlertCircle } from 'lucide-react'
import type { TaxReportData } from './constants'

interface TaxFursStatusProps {
  data: TaxReportData
}

export const TaxFursStatus = memo(function TaxFursStatus({
  data,
}: TaxFursStatusProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" /> FURS davčna blagajna — Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/10">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{data.fursSubmissions}</p>
              <p className="text-sm text-muted-foreground">Oddanih računov</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-600">{data.fursPending}</p>
              <p className="text-sm text-muted-foreground">Čakajočih računov</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/10">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{data.fursFailed}</p>
              <p className="text-sm text-muted-foreground">Neuspelih pošiljanj</p>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Informacije o FURS povezavi</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>ZOI (Zaščitni označevalnik) se generira avtomatsko ob vsakem računu.</p>
              <p>EOR (Elektronski potrditveni zapis) se pošilja FURS-u v realnem času.</p>
              <p>Če FURS ni dosegljiv, se EOR shrani v čakalno vrsto za poznejše pošiljanje.</p>
              <p>Z-poročila se generirajo ob zaključku poslovnega dneva.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
