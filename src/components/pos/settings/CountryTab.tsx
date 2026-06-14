'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  MapPinned, Percent, Landmark, Hash,
  CheckCircle2, Info, FileCheck, Globe,
} from 'lucide-react'
import { countryList, getCountryConfig } from '@/lib/country-config'
import type { CountryTabProps } from './constants'

// --- Komponenta ---

export const CountryTab = memo(function CountryTab({
  selectedCountry,
  onCountryChange,
}: CountryTabProps) {
  const currentCountryConfig = getCountryConfig(selectedCountry)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" />
            Izberite državo poslovanja
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Izbira države samodejno nastavi davčne stopnje, valuto, fiskalizacijski sistem in privzeti jezik.
            To je prva nastavitev, ki jo morate opraviti pred uporabo sistema.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {countryList.map((c) => (
              <button
                key={c.code}
                onClick={() => onCountryChange(c.code)}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                  selectedCountry === c.code
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-3xl">{c.flag}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{c.nameLocal}</p>
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                  </div>
                  {selectedCountry === c.code && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
                <div className="mt-3 w-full space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valuta:</span>
                    <span className="font-medium">{c.currencySymbol} ({c.currency})</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Splošni davek:</span>
                    <span className="font-medium">{c.taxRates.standard}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Znižani davek:</span>
                    <span className="font-medium">{c.taxRates.reduced}%</span>
                  </div>
                  {c.taxRates.superReduced !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Še nižji davek:</span>
                      <span className="font-medium">{c.taxRates.superReduced}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fiskalizacija:</span>
                    <span className="font-medium text-[10px]">{c.fiscalization.system}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Povzetek izbrane države */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Povzetek za {currentCountryConfig.flag} {currentCountryConfig.nameLocal}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Davčne stopnje */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Davčne stopnje
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <span className="text-sm font-medium">Splošna stopnja</span>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{currentCountryConfig.taxRates.standard}%</Badge>
                </div>
                <p className="text-xs text-muted-foreground pl-1">{currentCountryConfig.taxRateDescriptions.standard}</p>
                <div className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <span className="text-sm font-medium">Znižana stopnja</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{currentCountryConfig.taxRates.reduced}%</Badge>
                </div>
                <p className="text-xs text-muted-foreground pl-1">{currentCountryConfig.taxRateDescriptions.reduced}</p>
                {currentCountryConfig.taxRates.superReduced !== undefined && (
                  <>
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                      <span className="text-sm font-medium">Še nižja stopnja</span>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{currentCountryConfig.taxRates.superReduced}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">{currentCountryConfig.taxRateDescriptions.superReduced}</p>
                  </>
                )}
                <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-950/30 rounded-lg">
                  <span className="text-sm font-medium">Ničelna stopnja</span>
                  <Badge variant="outline">0%</Badge>
                </div>
                <p className="text-xs text-muted-foreground pl-1">{currentCountryConfig.taxRateDescriptions.zero}</p>
              </div>
            </div>

            {/* Fiskalizacija */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                Fiskalizacija
              </h4>
              <div className="space-y-2.5">
                <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sistem:</span>
                    <span className="font-medium">{currentCountryConfig.fiscalization.system}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lokalno:</span>
                    <span className="font-medium">{currentCountryConfig.fiscalization.systemLocal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organ:</span>
                    <span className="font-medium text-xs">{currentCountryConfig.fiscalization.authority}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Certifikat:</span>
                    <span className="font-medium text-xs">{currentCountryConfig.fiscalization.certificateFormat}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Obvezna:</span>
                    <Badge variant={currentCountryConfig.fiscalization.required ? 'destructive' : 'secondary'} className="text-[10px]">
                      {currentCountryConfig.fiscalization.required ? 'DA' : 'NE'}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Kode na računu:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Zaščitna koda:</span>
                    <Badge variant="outline" className="text-xs">{currentCountryConfig.fiscalization.receiptCodes.protectionCode}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Verifikacija:</span>
                    <Badge variant="outline" className="text-xs">{currentCountryConfig.fiscalization.receiptCodes.verificationCode}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Format davčne številke */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Format davčne številke
              </p>
              <p className="text-sm font-medium">{currentCountryConfig.taxIdFormat.description}</p>
              <p className="text-xs text-muted-foreground">Primer: <code className="bg-muted px-1.5 py-0.5 rounded">{currentCountryConfig.taxIdFormat.example}</code></p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Format poslovne številke
              </p>
              <p className="text-sm font-medium">{currentCountryConfig.businessIdFormat.description}</p>
              <p className="text-xs text-muted-foreground">Primer: <code className="bg-muted px-1.5 py-0.5 rounded">{currentCountryConfig.businessIdFormat.example}</code></p>
            </div>
          </div>

          {/* Zahteve za račune */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5" /> Obvezni podatki na računu ({currentCountryConfig.nameLocal})
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5 list-disc list-inside">
              {currentCountryConfig.receiptRequirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>

          {/* Povezava do organa */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>Več informacij:</span>
            <a
              href={currentCountryConfig.fiscalization.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {currentCountryConfig.fiscalization.infoUrl}
            </a>
          </div>
        </CardContent>
      </Card>
    </>
  )
})
