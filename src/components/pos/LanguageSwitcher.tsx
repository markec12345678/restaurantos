'use client'
import { usePOSStore } from '@/lib/store'
import { localeNames, localeFlags, type Locale } from '@/lib/i18n'
import { countryList } from '@/lib/country-config'
import { memo } from 'react'
import { Globe, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
const locales: Locale[] = ['sl', 'hr', 'it', 'de', 'en']
export const LanguageSwitcher = memo(function LanguageSwitcher() {
  const { locale, setLocale, country, setCountry } = usePOSStore()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2">
          <Globe className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{localeFlags[locale]} {locale.toUpperCase()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {/* Država */}
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Država / Country
          </p>
        </div>
        {countryList.map((c) => (
          <button
            key={c.code}
            onClick={() => setCountry(c.code)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              country === c.code
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-base">{c.flag}</span>
            <span>{c.nameLocal}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{c.currency}</span>
          </button>
        ))}
        <Separator className="my-2" />
        {/* Jezik */}
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Globe className="h-3 w-3" /> Jezik / Language
          </p>
        </div>
        {locales.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              locale === l
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-base">{localeFlags[l]}</span>
            <span>{localeNames[l]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
})
