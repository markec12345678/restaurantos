'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Globe } from 'lucide-react'
import type { TaxTabProps } from '../constants'

// --- Valuta in jezik Card ---

export const CurrencyLanguageCard = memo(function CurrencyLanguageCard({
  form,
  updateField,
}: Pick<TaxTabProps, 'form' | 'updateField'>) {
  return (
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
  )
})
