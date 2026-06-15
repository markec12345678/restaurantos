'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Percent, AlertTriangle } from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import type { TaxTabProps } from '../constants'

// --- DDV Stopnje Card ---

export const VatRatesCard = memo(function VatRatesCard({
  form,
  updateField,
  currentCountryCode,
}: Pick<TaxTabProps, 'form' | 'updateField' | 'currentCountryCode'>) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
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
      </CardContent>
    </Card>
  )
})
