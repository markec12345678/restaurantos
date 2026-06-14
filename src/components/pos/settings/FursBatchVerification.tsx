'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, ListChecks,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import type { BatchStatus, BatchVerificationResults } from './constants'

// ============================================
// MNOŽIČNA OVERITEV NEOVERJENIH RAČUNOV
// ============================================
export const FursBatchVerification = memo(function FursBatchVerification() {
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchVerificationResults | null>(null)

  const { data: batchStatus, isLoading: batchLoading, refetch } = useQuery<BatchStatus>({
    queryKey: ['furs-batch-status'],
    queryFn: async () => {
      const res = await authFetch('/api/furs/batch')
      if (!res.ok) return { unverifiedCount: 0, oldestUnverified: null }
      return res.json()
    },
    refetchInterval: batchRunning ? 5000 : 60000,
  })

  const runBatch = useCallback(async () => {
    setBatchRunning(true)
    setBatchResults(null)
    try {
      const res = await authFetch('/api/furs/batch', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Napaka pri množičnem overjanju')
        return
      }
      setBatchResults(data)
      refetch()
      if (data.failed === 0) {
        toast.success(data.message || `Uspešno overjenih ${data.successful} računov!`)
      } else {
        toast.warning(`Overjenih ${data.successful}/${data.processed}, ${data.failed} neuspešnih`)
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setBatchRunning(false)
    }
  }, [refetch])

  const unverifiedCount = batchStatus?.unverifiedCount || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-blue-600" />
            Množična overitev računov
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Poišče in overi vse neoverjene račune pri FURS (max 50 naenkrat)
          </p>
        </div>
        <Button
          onClick={runBatch}
          disabled={batchRunning || unverifiedCount === 0}
          className="min-w-36"
        >
          {batchRunning ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Overjam...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Overi vse ({unverifiedCount})</>
          )}
        </Button>
      </div>

      {/* Status neoverjenih */}
      {batchLoading ? (
        <div className="h-10 bg-muted animate-pulse rounded" />
      ) : unverifiedCount > 0 ? (
        <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-300">
              <strong>{unverifiedCount}</strong> {unverifiedCount === 1 ? 'račun' : unverifiedCount === 2 ? 'računa' : unverifiedCount < 5 ? 'računi' : 'računov'} čaka na davčno overitev
              {batchStatus?.oldestUnverified && (
                <span className="text-xs ml-2 text-amber-600">
                  (najstarejši: {batchStatus.oldestUnverified.receiptNumber} od {new Date(batchStatus.oldestUnverified.createdAt).toLocaleDateString('sl-SI')})
                </span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm text-emerald-800 dark:text-emerald-300">
              Vsi računi so davčno overjeni
            </span>
          </div>
        </div>
      )}

      {/* Rezultati batch overitve */}
      {batchResults && (
        <div className="border rounded-lg overflow-hidden">
          <div className="p-3 bg-muted/50 border-b font-medium text-sm flex items-center justify-between">
            <span>Rezultati overjanja</span>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-emerald-600">{batchResults.successful} uspešnih</Badge>
              {batchResults.failed > 0 && (
                <Badge variant="destructive">{batchResults.failed} neuspešnih</Badge>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {batchResults.results.map((result, idx) => (
              <div key={result.receiptId} className={`flex items-center justify-between p-2 text-sm border-b ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span className="font-mono text-xs">{result.receiptNumber}</span>
                  {result.isSimulation && (
                    <Badge variant="outline" className="text-[9px] h-4 text-amber-600">SIM</Badge>
                  )}
                </div>
                <span className={`text-xs ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.success ? 'Overjen' : result.error || 'Napaka'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
