'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Percent, Landmark, Hash, FileCheck, Globe, Info,
} from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import type { CountryCode } from '@/lib/country-config'

// ============================================
// Country summary details
// ============================================
interface CountrySummaryProps {
  selectedCountry: CountryCode
}

export const CountrySummary = memo(function CountrySummary({ selectedCountry }: CountrySummaryProps) {
  const cfg = getCountryConfig(selectedCountry)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          Povzetek za {cfg.flag} {cfg.nameLocal}
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
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{cfg.taxRates.standard}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-1">{cfg.taxRateDescriptions.standard}</p>
              <div className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <span className="text-sm font-medium">Znižana stopnja</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{cfg.taxRates.reduced}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-1">{cfg.taxRateDescriptions.reduced}</p>
              {cfg.taxRates.superReduced !== undefined && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <span className="text-sm font-medium">Še nižja stopnja</span>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{cfg.taxRates.superReduced}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">{cfg.taxRateDescriptions.superReduced}</p>
                </>
              )}
              <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-950/30 rounded-lg">
                <span className="text-sm font-medium">Ničelna stopnja</span>
                <Badge variant="outline">0%</Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-1">{cfg.taxRateDescriptions.zero}</p>
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
                  <span className="font-medium">{cfg.fiscalization.system}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lokalno:</span>
                  <span className="font-medium">{cfg.fiscalization.systemLocal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Organ:</span>
                  <span className="font-medium text-xs">{cfg.fiscalization.authority}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Certifikat:</span>
                  <span className="font-medium text-xs">{cfg.fiscalization.certificateFormat}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Obvezna:</span>
                  <Badge variant={cfg.fiscalization.required ? 'destructive' : 'secondary'} className="text-[10px]">
                    {cfg.fiscalization.required ? 'DA' : 'NE'}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Kode na računu:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Zaščitna koda:</span>
                  <Badge variant="outline" className="text-xs">{cfg.fiscalization.receiptCodes.protectionCode}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Verifikacija:</span>
                  <Badge variant="outline" className="text-xs">{cfg.fiscalization.receiptCodes.verificationCode}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> Format davčne številke
            </p>
            <p className="text-sm font-medium">{cfg.taxIdFormat.description}</p>
            <p className="text-xs text-muted-foreground">Primer: <code className="bg-muted px-1.5 py-0.5 rounded">{cfg.taxIdFormat.example}</code></p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> Format poslovne številke
            </p>
            <p className="text-sm font-medium">{cfg.businessIdFormat.description}</p>
            <p className="text-xs text-muted-foreground">Primer: <code className="bg-muted px-1.5 py-0.5 rounded">{cfg.businessIdFormat.example}</code></p>
          </div>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5" /> Obvezni podatki na računu ({cfg.nameLocal})
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5 list-disc list-inside">
            {cfg.receiptRequirements.map((req, i) => (<li key={i}>{req}</li>))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <span>Več informacij:</span>
          <a href={cfg.fiscalization.infoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {cfg.fiscalization.infoUrl}
          </a>
        </div>
      </CardContent>
    </Card>
  )
})
