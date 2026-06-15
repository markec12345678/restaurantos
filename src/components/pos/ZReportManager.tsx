'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, CheckCircle2, Calculator } from 'lucide-react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import type { ZReportData } from './zreport/constants'
import { useZReportManager } from './useZReportManager'

// Lazy-loaded podkomponente
const ZReportStats = dynamic(() => import('./zreport/ZReportStats').then(m => ({ default: m.ZReportStats })), { ssr: false })
const PaymentBreakdown = dynamic(() => import('./zreport/PaymentBreakdown').then(m => ({ default: m.PaymentBreakdown })), { ssr: false })
const VatCashSection = dynamic(() => import('./zreport/VatCashSection').then(m => ({ default: m.VatCashSection })), { ssr: false })
const ProfitDiscountSection = dynamic(() => import('./zreport/ProfitDiscountSection').then(m => ({ default: m.ProfitDiscountSection })), { ssr: false })
const ZReportHistory = dynamic(() => import('./zreport/ZReportHistory').then(m => ({ default: m.ZReportHistory })), { ssr: false })
const ZReportCloseDialog = dynamic(() => import('./zreport/ZReportCloseDialog').then(m => ({ default: m.ZReportCloseDialog })), { ssr: false })

export const ZReportManager = memo(function ZReportManager() {
  const {
    selectedDate,
    showCloseDialog,
    report,
    isLoading,
    loadingReport,
    generateMutation,
    handleDateChange,
    handleOpenCloseDialog,
    handleCloseDialogOpenChange,
    handleGenerate,
    handleFinalize,
    handleActualCashChange,
    handleCloseNotesChange,
    handleSelectDate,
    reports,
    actualCash,
    closeNotes,
  } = useZReportManager()

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
          <label htmlFor="zreport-date-select" className="sr-only">Izberi datum</label>
          <Input
            id="zreport-date-select"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="w-44"
            aria-label="Izberi datum poročila"
          />
          {report?.status === 'draft' ? (
            <Button onClick={handleOpenCloseDialog} className="bg-amber-600 hover:bg-amber-700" aria-label="Zaključi dan">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Zaključi dan
            </Button>
          ) : !report ? (
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} aria-label="Generiraj Z-poročilo">
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

      {report && (
        <>
          <ZReportStats report={report} />
          <PaymentBreakdown report={report} />
          <VatCashSection report={report} />
          <ProfitDiscountSection report={report} />
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

      {!report && (
        <Card className="text-center py-16">
          <CardContent>
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ni Z-poročila za {format(new Date(selectedDate), 'd. MMMM yyyy', { locale: sl })}</h3>
            <p className="text-muted-foreground mb-4">Generirajte Z-poročilo za pregled dnevnih statistik</p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} aria-label="Generiraj Z-poročilo">
              <Calculator className="h-4 w-4 mr-2" />
              Generiraj Z-poročilo
            </Button>
          </CardContent>
        </Card>
      )}

      <ZReportHistory
        reports={(reports || []) as ZReportData[]}
        onSelectDate={handleSelectDate}
      />

      <ZReportCloseDialog
        open={showCloseDialog}
        onOpenChange={handleCloseDialogOpenChange}
        report={report}
        actualCash={actualCash}
        onActualCashChange={handleActualCashChange}
        closeNotes={closeNotes}
        onCloseNotesChange={handleCloseNotesChange}
        onFinalize={handleFinalize}
        isPending={generateMutation.isPending}
      />
    </div>
  )
})
