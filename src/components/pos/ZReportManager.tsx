'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Z-Report / Dnevni zaključek
// Toast POS + Square standard — poln Z-report z DDV, gotovino, stroški
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { FileText, CheckCircle2, Calculator } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'
import type { ZReportData } from './zreport/constants'

// Lazy-loaded podkomponente
const ZReportStats = dynamic(() => import('./zreport/ZReportStats').then(m => ({ default: m.ZReportStats })), { ssr: false })
const PaymentBreakdown = dynamic(() => import('./zreport/PaymentBreakdown').then(m => ({ default: m.PaymentBreakdown })), { ssr: false })
const VatCashSection = dynamic(() => import('./zreport/VatCashSection').then(m => ({ default: m.VatCashSection })), { ssr: false })
const ProfitDiscountSection = dynamic(() => import('./zreport/ProfitDiscountSection').then(m => ({ default: m.ProfitDiscountSection })), { ssr: false })
const ZReportCloseDialog = dynamic(() => import('./zreport/ZReportCloseDialog').then(m => ({ default: m.ZReportCloseDialog })), { ssr: false })
const ZReportHistory = dynamic(() => import('./zreport/ZReportHistory').then(m => ({ default: m.ZReportHistory })), { ssr: false })

export const ZReportManager = memo(function ZReportManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  // Pridobi Z-poročila
  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.zReport.all,
    queryFn: async () => {
      const res = await authFetch('/api/z-report')
      return res.json()
    },
  })

  // Pridobi trenutno poročilo
  const { data: currentReport, isLoading: loadingReport } = useQuery({
    queryKey: [...queryKeys.zReport.current, selectedDate],
    queryFn: async () => {
      const res = await authFetch(`/api/z-report?date=${selectedDate}`)
      const data = await res.json()
      return data.length > 0 ? data[0] : null
    },
  })

  // Generiraj/Zaključi Z-poročilo
  const generateMutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const res = await authFetch('/api/z-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          actualCash: parseFloat(actualCash) || 0,
          notes: closeNotes,
          finalize,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri generiranju Z-poročila')
      return res.json()
    },
    onSuccess: (_, finalize) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zReport.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.zReport.all })
      toast.success(finalize ? 'Z-poročilo zaključeno!' : 'Z-poročilo generirano!')
      setShowCloseDialog(false)
    },
    onError: () => toast.error('Napaka pri generiranju Z-poročila'),
  })

  const report = currentReport as ZReportData | null

  if (isLoading || loadingReport) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" />
            Z-Poročilo
          </h2>
          <p className="text-muted-foreground">Dnevni zaključek — End of Day Report</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            id="zreport-date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
            aria-label="Izberi datum poročila"
          />
          {report?.status === 'draft' ? (
            <Button onClick={() => setShowCloseDialog(true)} className="bg-amber-600 hover:bg-amber-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Zaključi dan
            </Button>
          ) : !report ? (
            <Button onClick={() => generateMutation.mutate(false)} disabled={generateMutation.isPending}>
              <Calculator className="h-4 w-4 mr-2" />
              Generiraj Z-poročilo
            </Button>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300 px-3 py-1">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Zaključeno
            </Badge>
          )}
        </div>
      </div>

      {/* Podatki poročila */}
      {report && (
        <>
          {/* Glavna statistika */}
          <ZReportStats report={report} />

          {/* Po načinu plačila + Vrsta naročila */}
          <PaymentBreakdown report={report} />

          {/* DDV razčlenitev + Gotovina */}
          <VatCashSection report={report} />

          {/* Profitabiliteta + Popusti/Void */}
          <ProfitDiscountSection report={report} />

          {/* Opombe */}
          {report.notes && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Opombe:</div>
                <div className="mt-1">{report.notes}</div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Ni poročila za izbrani datum */}
      {!report && (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni Z-poročila za {format(new Date(selectedDate), 'd. MMMM yyyy', { locale: sl })}</h3>
            <p className="text-muted-foreground mb-4">Generirajte Z-poročilo za pregled dnevnih statistik</p>
            <Button onClick={() => generateMutation.mutate(false)} disabled={generateMutation.isPending}>
              <Calculator className="h-4 w-4 mr-2" />
              Generiraj Z-poročilo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Zgodovina — zadnja Z-poročila */}
      <ZReportHistory
        reports={reports || []}
        onSelectDate={setSelectedDate}
      />

      {/* Dialog za zaključek dneva */}
      <ZReportCloseDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        report={report}
        actualCash={actualCash}
        onActualCashChange={setActualCash}
        closeNotes={closeNotes}
        onCloseNotesChange={setCloseNotes}
        onFinalize={() => generateMutation.mutate(true)}
        isPending={generateMutation.isPending}
      />
    </div>
  )
})
