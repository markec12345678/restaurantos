'use client'

import { memo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { countryList } from '@/lib/country-config'
import type { CountryCode } from '@/lib/country-config'

// ============================================
// Country selection grid
// ============================================
interface CountrySelectorProps {
  selectedCountry: CountryCode
  onCountryChange: (_code: CountryCode) => void
}

export const CountrySelector = memo(function CountrySelector({ selectedCountry, onCountryChange }: CountrySelectorProps) {
  return (
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
  )
})
