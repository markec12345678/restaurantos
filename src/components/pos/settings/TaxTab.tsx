'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Percent, Globe, AlertTriangle,
} from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import type { TaxTabProps } from './constants'

// --- Komponenta ---

export const TaxTab = memo(function TaxTab({
  form,
  updateField,
  currentCountryCode,
  bulkVatFrom,
  bulkVatTo,
  setBulkVatFrom,
  setBulkVatTo,
  onBulkVatChange,
  bulkVatPending,
}: TaxTabProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            DDV stopnje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {currentCountryConfig.flag} {currentCountryConfig.nameLocal} ima naslednje davčne stopnje.
            Izbira države na zavihku &quot;Država&quot; samodejno nastavi te vrednosti.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Splošna DDV stopnja (%)</Label>
              <div className="flex gap-2">
                <Select value={String(form.defaultVatRate || 22)} onValueChange={v => updateField('defaultVatRate', parseFloat(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="22">22%</SelectItem>
                    <SelectItem value="9.5">9.5%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.1"
                  value={form.defaultVatRate || 22}
                  onChange={e => updateField('defaultVatRate', parseFloat(e.target.value) || 22)}
                  className="w-28"
                />
                <span className="flex items-center text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Privzeta stopnja za vse nove artikle v jedilniku</p>
            </div>
            <div className="space-y-2">
              <Label>Znižana DDV stopnja (%)</Label>
              <div className="flex gap-2">
                <Select value={String(form.reducedVatRate || 9.5)} onValueChange={v => updateField('reducedVatRate', parseFloat(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9.5">9.5%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.1"
                  value={form.reducedVatRate || 9.5}
                  onChange={e => updateField('reducedVatRate', parseFloat(e.target.value) || 9.5)}
                  className="w-28"
                />
                <span className="flex items-center text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Za živila, ki niso alkohol, knjige, zdravila...</p>
            </div>
          </div>

          <Separator />

          {/* Davek informacije */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pomembno o davkih v {currentCountryConfig.nameLocal}
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Splošna stopnja: <strong>{currentCountryConfig.taxRates.standard}%</strong> — {currentCountryConfig.taxRateDescriptions.standard.split('—')[0]}</li>
              <li>Znižana stopnja: <strong>{currentCountryConfig.taxRates.reduced}%</strong> — {currentCountryConfig.taxRateDescriptions.reduced.split('—')[0]}</li>
              {currentCountryConfig.taxRates.superReduced !== undefined && (
                <li>Še nižja stopnja: <strong>{currentCountryConfig.taxRates.superReduced}%</strong> — {currentCountryConfig.taxRateDescriptions.superReduced?.split('—')[0]}</li>
              )}
              <li>Ničelna stopnja: <strong>0%</strong> — izvoz, mednarodne storitve</li>
              <li>Ob spremembi davčne stopnje morate posodobiti vse artikle v jedilniku!</li>
              <li>Na računu mora biti davek izpisan po stopnjah z osnovo in zneskom</li>
            </ul>
          </div>

          {/* Sprememba DDV za vse artikle */}
          <Card className="border-amber-200 dark:border-amber-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Masovna sprememba DDV stopnje
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Če se DDV stopnja spremeni po zakonu, lahko tukaj posodobite vse artikle v jedilniku hkrati.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Sedanja stopnja</Label>
                  <Select value={bulkVatFrom} onValueChange={setBulkVatFrom}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="22">22%</SelectItem>
                      <SelectItem value="9.5">9.5%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="pb-2 text-lg">→</span>
                <div className="space-y-1">
                  <Label className="text-xs">Nova stopnja</Label>
                  <Select value={bulkVatTo} onValueChange={setBulkVatTo}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="22">22%</SelectItem>
                      <SelectItem value="9.5">9.5%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" onClick={onBulkVatChange} disabled={bulkVatPending}>
                  {bulkVatPending ? 'Posodabljam...' : 'Uporabi na vse artikle'}
                </Button>
              </div>
              <p className="text-xs text-amber-600 mt-2">⚠️ Ta operacija bo spremenila DDV stopnjo za VSE artikle s sedanjim DDV na nov DDV. Te spremembe ni mogoče razveljaviti.</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Valuta in jezik */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Valuta in jezik
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Samodejno nastavljeno glede na izbrano državo. Ročno lahko prilagodite po potrebi.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valuta</Label>
              <Select value={form.currency || 'EUR'} onValueChange={v => updateField('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="CHF">CHF (Fr.)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Vse podprte države uporabljajo EUR</p>
            </div>
            <div className="space-y-2">
              <Label>Jezik</Label>
              <Select value={form.locale || 'sl-SI'} onValueChange={v => updateField('locale', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sl-SI">🇸🇮 Slovenščina</SelectItem>
                  <SelectItem value="hr-HR">🇭🇷 Hrvatski</SelectItem>
                  <SelectItem value="it-IT">🇮🇹 Italiano</SelectItem>
                  <SelectItem value="de-AT">🇦🇹 Deutsch (Österreich)</SelectItem>
                  <SelectItem value="de-DE">🇩🇪 Deutsch (Deutschland)</SelectItem>
                  <SelectItem value="en-US">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
})
