'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Shield, AlertTriangle, CheckCircle2, TestTube2,
  FileText, Wifi, Loader2, RefreshCw, ListChecks,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { getCountryConfig } from '@/lib/country-config'
import type { FursTabProps, BatchStatus, BatchVerificationResults } from './constants'

// ============================================
// MNOŽIČNA OVERITEV NEOVERJENIH RAČUNOV
// ============================================

function FursBatchVerification() {
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
}

// ============================================
// FURS TAB KOMPONENTA
// ============================================

export const FursTab = memo(function FursTab({
  form,
  updateField,
  fursStatus,
  onTestFursConnection,
  currentCountryCode,
}: FursTabProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          {currentCountryConfig.fiscalization.systemLocal}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {currentCountryConfig.flag} {currentCountryConfig.fiscalization.authority} ({currentCountryConfig.fiscalization.authorityShort}) —
          {currentCountryConfig.fiscalization.required ? ' Fiskalizacija je obvezna.' : ' Fiskalizacija ni obvezna.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status povezave */}
        <div className={`rounded-lg p-4 border-2 ${
          fursStatus === 'connected' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800' :
          fursStatus === 'testing' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800' :
          fursStatus === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800' :
          'border-muted bg-muted/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {fursStatus === 'connected' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : fursStatus === 'testing' ? (
                <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : fursStatus === 'error' ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : (
                <Wifi className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <p className="font-semibold">
                  {fursStatus === 'connected' ? 'Povezava vzpostavljena' :
                   fursStatus === 'testing' ? 'Preverjam povezavo...' :
                   fursStatus === 'error' ? 'Povezava neuspešna' :
                   'Povezava ni vzpostavljena'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Okolje: {form.fursEnvironment === 'production' ? 'PRODUKCIJA' : 'TESTNO'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={onTestFursConnection}
              disabled={fursStatus === 'testing'}
            >
              <TestTube2 className="h-4 w-4 mr-2" />
              Testiraj povezavo
            </Button>
          </div>
        </div>

        {/* FURS Certifikat */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pot do certifikata ({currentCountryConfig.fiscalization.certificateFormat})</Label>
            <Input
              value={form.fursCertPath || ''}
              onChange={e => updateField('fursCertPath', e.target.value)}
              placeholder="/pot/do/certifikata.p12"
            />
            <p className="text-xs text-muted-foreground">Digitalni certifikat za podpisovanje računov ({currentCountryConfig.fiscalization.certificateFormat})</p>
          </div>
          <div className="space-y-2">
            <Label>Geslo certifikata</Label>
            <Input
              type="password"
              value={form.fursCertPassword || ''}
              onChange={e => updateField('fursCertPassword', e.target.value)}
              placeholder="Geslo za certifikat"
            />
            <p className="text-xs text-muted-foreground">Geslo za dostop do digitalnega certifikata</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Okolje {currentCountryConfig.fiscalization.authorityShort}</Label>
          <Select value={form.fursEnvironment || 'test'} onValueChange={v => updateField('fursEnvironment', v)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">
                <span className="flex items-center gap-2">
                  <TestTube2 className="h-3.5 w-3.5 text-blue-500" />
                  Testno okolje
                </span>
              </SelectItem>
              <SelectItem value="production">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Produkcijsko okolje
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Množična overitev neoverjenih računov */}
        <FursBatchVerification />

        <Separator />

        {/* Informacije o fiskalizaciji */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300">
            {currentCountryConfig.flag} Kaj morate vedeti o fiskalizaciji v {currentCountryConfig.nameLocal}
          </h4>
          <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
            <p><strong>{currentCountryConfig.fiscalization.system}</strong> ({currentCountryConfig.fiscalization.systemLocal}) —
              fiskalizacijski sistem v {currentCountryConfig.nameLocal}. Organ: {currentCountryConfig.fiscalization.authority}.</p>
            <p><strong>{currentCountryConfig.fiscalization.receiptCodes.protectionCode}</strong> —
              zaščitna koda na računu, generirana iz digitalnega podpisa s certifikatom ({currentCountryConfig.fiscalization.certificateFormat}).</p>
            <p><strong>{currentCountryConfig.fiscalization.receiptCodes.verificationCode}</strong> —
              verifikacijska koda, ki jo vrne strežnik {currentCountryConfig.fiscalization.authorityShort} kot potrditev sprejema računa.</p>
            {currentCountryCode === 'SI' && (
              <>
                <p><strong>ZOI</strong> (Zaščitni označitelj izdajanja) — Base64 kodiran podpis, generiran iz RSA-SHA256 z uporabo FURS certifikata.</p>
                <p><strong>EOR</strong> (Elektronski zapis o računu) — UUID, ki ga vrne FURS strežnik kot potrditev. Vrne se v 3 sekundah.</p>
                <p><strong>Kazen:</strong> Za neoverjene račune grozi globo od 500 do 125.000 EUR (ZDDV-1, 85. člen).</p>
              </>
            )}
            {currentCountryCode === 'HR' && (
              <>
                <p><strong>JIR</strong> (Jedinstveni identifikator računa) — UUID generiran od strane Porezne uprave.</p>
                <p><strong>ZKI</strong> (Zaštitni kod izdavatelja) — digitalni potpis računa, obavezno prikazan na računu.</p>
                <p><strong>Kazna:</strong> Za neizdane ili nefiskalizirane račune kazna od 5.000 do 500.000 HRK.</p>
              </>
            )}
            {currentCountryCode === 'IT' && (
              <>
                <p><strong>Sistema TS</strong> — Tehničko rješenje za fiskalizaciju u Italiji.</p>
                <p><strong>SDI</strong> (Sistema di Interscambio) — elektronska razmjena dokumenata.</p>
              </>
            )}
            {currentCountryCode === 'AT' && (
              <>
                <p><strong>RKSV</strong> — Registrierkassensicherungsverordnung, obavezna za sve austrijske poslovne subjekte.</p>
                <p><strong>DEP</strong> (Digitales Exportprotokoll) — digitalni zapis svih transakcija.</p>
              </>
            )}
            {currentCountryCode === 'DE' && (
              <>
                <p><strong>KassensichV</strong> — Kassensicherungsverordnung, savezni propis o sigurnosti blagajni.</p>
                <p><strong>TSE</strong> (Technische Sicherheitseinrichtung) — sigurnosni modul (SD kartica, USB ili Cloud).</p>
                <p><strong>DSFinV-K</strong> — Digitalna sučelje za izvoz podataka s blagajne.</p>
              </>
            )}
            <p><strong>Produkcijski način:</strong> Za prehod v produkcijo morate imeti veljaven certifikat in pravilno konfigurirane podatke podjetja.</p>
          </div>
        </div>

        {/* Kaj mora biti na računu */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Obvezni podatki na računu ({currentCountryConfig.flag} {currentCountryConfig.nameLocal})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="font-semibold text-sm">Podatki izdajatelja:</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  {currentCountryConfig.receiptRequirements.slice(0, Math.ceil(currentCountryConfig.receiptRequirements.length / 2)).map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-sm">Podatki računa:</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  {currentCountryConfig.receiptRequirements.slice(Math.ceil(currentCountryConfig.receiptRequirements.length / 2)).map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
})
