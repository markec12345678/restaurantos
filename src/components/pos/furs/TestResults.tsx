'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, X, RefreshCw, FileKey, TestTube } from 'lucide-react'
import type { TestResultsProps } from './constants'

// ============================================
// TESTIRANJE POVEZAVE — Rezultati testiranja FURS
// ============================================

export const TestResults = memo(function TestResults({ testing, testResult, onTestConnection, onTestInvoice }: TestResultsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TestTube className="h-4 w-4" />
          Testiranje povezave
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={onTestConnection} variant="outline" disabled={testing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            Test povezave
          </Button>
          <Button onClick={onTestInvoice} disabled={testing} className="gap-2">
            <FileKey className="h-4 w-4" />
            Testni račun
          </Button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-xl border ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? <Check className="h-5 w-5 text-green-600" /> : <X className="h-5 w-5 text-red-600" />}
              <span className="font-bold">{testResult.success ? 'Uspešno!' : 'Napaka'}</span>
            </div>
            {testResult.isSimulation && (
              <p className="text-sm text-amber-600 mb-2">Simulirano overjanje (brez pravega certifikata)</p>
            )}
            {testResult.zoi && (
              <div className="text-xs space-y-1">
                <p><span className="font-medium">ZOI:</span> <span className="font-mono">{testResult.zoi}</span></p>
                {testResult.eor && <p><span className="font-medium">EOR:</span> <span className="font-mono">{testResult.eor}</span></p>}
                {testResult.responseTime && <p><span className="font-medium">Odzivni čas:</span> {testResult.responseTime}ms</p>}
              </div>
            )}
            {testResult.error && <p className="text-sm text-red-600">{testResult.error}</p>}
            {testResult.validationErrors && (
              <div className="mt-2 space-y-1">
                {testResult.validationErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">• {e.field}: {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
