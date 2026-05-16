'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Settings, Building2, Shield, Receipt, Percent, Globe,
  Save, AlertTriangle, CheckCircle2, TestTube2, Monitor,
  FileText, Phone, Mail, MapPin, Hash, CreditCard, Wifi,
  Loader2, RefreshCw, ListChecks, MapPinned, Landmark,
  FileCheck, Info
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { usePOSStore } from '@/lib/store'
import { countryList, getCountryConfig, getTaxRateOptions, type CountryCode } from '@/lib/country-config'
import { setLocale } from '@/lib/i18n'

// ============================================
// TIPI
// ============================================
interface SettingsData {
  id: string
  name: string
  address: string
  city: string
  postCode: string
  phone: string
  email: string
  web: string
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  defaultVatRate: number
  reducedVatRate: number
  receiptFooter: string
  currency: string
  locale: string
  country: string
  isActive: boolean
}

// ============================================
// KOMPONENTA
// ============================================
export function SettingsManager() {
  const queryClient = useQueryClient()
  const { country: storeCountry, setCountry: setStoreCountry, setLocale: setStoreLocale } = usePOSStore()
  const [activeTab, setActiveTab] = useState('country')
  const [fursStatus, setFursStatus] = useState<'disconnected' | 'testing' | 'connected' | 'error'>('disconnected')
  const [lastSaved, setLastSaved] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>((storeCountry as CountryCode) || 'SI')

  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await authFetch('/api/settings')
      return res.json()
    },
  })

  const [form, setForm] = useState<Partial<SettingsData>>({})

  useEffect(() => {
    if (settings) {
      setForm({ ...settings })
      // Sync country from settings to local state
      if (settings.country) {
        setSelectedCountry(settings.country as CountryCode)
      }
    }
  }, [settings])

  // Ko se spremeni država, samodejno posodobi nastavitve
  const handleCountryChange = (code: CountryCode) => {
    setSelectedCountry(code)
    setStoreCountry(code)
    const config = getCountryConfig(code)
    setForm(prev => ({
      ...prev,
      country: code,
      currency: config.currency,
      locale: config.locale,
      defaultVatRate: config.taxRates.standard,
      reducedVatRate: config.taxRates.reduced,
    }))
    setStoreLocale(config.primaryLanguage as 'sl' | 'en' | 'it' | 'hr' | 'de')
    setLocale(config.primaryLanguage as 'sl' | 'en' | 'it' | 'hr' | 'de')
  }

  const currentCountryConfig = getCountryConfig(selectedCountry)

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SettingsData>) => {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri shranjevanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nastavitve shranjene!')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setLastSaved(new Date().toLocaleTimeString('sl-SI'))
    },
    onError: () => toast.error('Napaka pri shranjevanju nastavitev'),
  })

  const handleSave = () => {
    saveMutation.mutate(form)
  }

  const testFursConnection = async () => {
    setFursStatus('testing')
    try {
      // Uporabimo pravi FURS status API (lib/furs.ts checkFursConnectivity)
      const res = await authFetch('/api/furs')
      const data = await res.json()
      
      if (data.connected) {
        setFursStatus('connected')
        toast.success(data.message || `FURS povezava uspešna (${data.environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'})`)
      } else if (data.configValid) {
        // Konfiguracija veljavna, ampak strežnik ni dosegljiv
        setFursStatus('error')
        toast.warning(`Konfiguracija veljavna, ampak FURS strežnik ni dosegljiv: ${data.message}`)
      } else {
        setFursStatus('error')
        const issues = [
          ...(data.configErrors || []),
          ...(data.configWarnings || []),
        ].join('; ')
        toast.error(`FURS povezava neuspešna${issues ? ': ' + issues : ''}`)
      }
    } catch {
      setFursStatus('error')
      toast.error('FURS povezava neuspešna - napaka pri preverjanju')
    }
  }

  const updateField = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Nastavitve
          </h2>
          <p className="text-muted-foreground">Konfiguracija sistema, davčne nastavitve in FURS povezava</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="min-w-32">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Shranjujem...' : 'Shrani'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="country" className="gap-1.5">
            <MapPinned className="h-3.5 w-3.5" /> Država
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Podjetje
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Davki
          </TabsTrigger>
          <TabsTrigger value="furs" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {currentCountryConfig.fiscalization.authorityShort}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Račun
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB: DRŽAVA / REGIJA ===================== */}
        <TabsContent value="country" className="space-y-4 mt-4">
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
                    onClick={() => handleCountryChange(c.code)}
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
        </TabsContent>

        {/* ===================== TAB: PODATKI PODJETJA ===================== */}
        <TabsContent value="company" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Podatki podjetja
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ti podatki se izpisujejo na vsakem računu in so obvezni po zakonu (ZDDV-1).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Naziv podjetja *</Label>
                  <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="npr. Restavracija Pri Ani d.o.o." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Naslov *</Label>
                  <Input value={form.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="npr. Ljubljanska 15" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Poštna številka</Label>
                  <Input value={form.postCode || ''} onChange={e => updateField('postCode', e.target.value)} placeholder="npr. 1000" />
                </div>
                <div className="space-y-2">
                  <Label>Kraj</Label>
                  <Input value={form.city || ''} onChange={e => updateField('city', e.target.value)} placeholder="npr. Ljubljana" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefon</Label>
                  <Input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="npr. +386 1 234 56 78" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> E-pošta</Label>
                  <Input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="npr. info@restavracija.si" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Spletna stran</Label>
                  <Input value={form.web || ''} onChange={e => updateField('web', e.target.value)} placeholder="npr. www.restavracija.si" />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Matična številka *</Label>
                  <Input value={form.businessId || ''} onChange={e => updateField('businessId', e.target.value)} placeholder="npr. 12345678" />
                  <p className="text-xs text-muted-foreground">Enotna matična številka poslovnega subjekta (8 mest)</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> ID za DDV *</Label>
                  <Input value={form.taxId || ''} onChange={e => updateField('taxId', e.target.value)} placeholder="npr. SI12345678" />
                  <p className="text-xs text-muted-foreground">Identifikacijska številka za DDV (SI + 8 mest)</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Številka blagajne *</Label>
                  <Input value={form.registerNumber || ''} onChange={e => updateField('registerNumber', e.target.value)} placeholder="npr. BLG-001" />
                  <p className="text-xs text-muted-foreground">Oznaka poslovnega prostora/blagajne (za FURS)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Predogled podatkov na računu */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Predogled glave računa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-xs bg-muted/50 p-4 rounded-lg space-y-1 text-center max-w-xs mx-auto border">
                <p className="font-bold text-sm">{form.name || 'Naziv podjetja'}</p>
                <p className="text-muted-foreground">{form.address || 'Naslov'}</p>
                <p className="text-muted-foreground">{form.postCode} {form.city}</p>
                {form.phone && <p className="text-muted-foreground">{form.phone}</p>}
                <Separator className="my-1" />
                <div className="flex justify-between text-[10px]">
                  <span>MAT: {form.businessId || '--------'}</span>
                  <span>ID DDV: {form.taxId || 'SI--------'}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Blagajna: {form.registerNumber || 'BLG-001'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB: DAVČNE NASTAVITVE ===================== */}
        <TabsContent value="tax" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                DDV stopnje
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {currentCountryConfig.flag} {currentCountryConfig.nameLocal} ima naslednje davčne stopnje.
                Izbira države na zavihku "Država" samodejno nastavi te vrednosti.
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
                      <Select defaultValue="22">
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
                      <Select defaultValue="22">
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22">22%</SelectItem>
                          <SelectItem value="9.5">9.5%</SelectItem>
                          <SelectItem value="0">0%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                      Uporabi na vse artikle
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
        </TabsContent>

        {/* ===================== TAB: FISKALIZACIJA (državno-specifično) ===================== */}
        <TabsContent value="furs" className="space-y-4 mt-4">
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
                    onClick={testFursConnection}
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
                  {selectedCountry === 'SI' && (
                    <>
                      <p><strong>ZOI</strong> (Zaščitni označitelj izdajanja) — Base64 kodiran podpis, generiran iz RSA-SHA256 z uporabo FURS certifikata.</p>
                      <p><strong>EOR</strong> (Elektronski zapis o računu) — UUID, ki ga vrne FURS strežnik kot potrditev. Vrne se v 3 sekundah.</p>
                      <p><strong>Kazen:</strong> Za neoverjene račune grozi globo od 500 do 125.000 EUR (ZDDV-1, 85. člen).</p>
                    </>
                  )}
                  {selectedCountry === 'HR' && (
                    <>
                      <p><strong>JIR</strong> (Jedinstveni identifikator računa) — UUID generiran od strane Porezne uprave.</p>
                      <p><strong>ZKI</strong> (Zaštitni kod izdavatelja) — digitalni potpis računa, obavezno prikazan na računu.</p>
                      <p><strong>Kazna:</strong> Za neizdane ili nefiskalizirane račune kazna od 5.000 do 500.000 HRK.</p>
                    </>
                  )}
                  {selectedCountry === 'IT' && (
                    <>
                      <p><strong>Sistema TS</strong> — Tehničko rješenje za fiskalizaciju u Italiji.</p>
                      <p><strong>SDI</strong> (Sistema di Interscambio) — elektronska razmjena dokumenata.</p>
                    </>
                  )}
                  {selectedCountry === 'AT' && (
                    <>
                      <p><strong>RKSV</strong> — Registrierkassensicherungsverordnung, obavezna za sve austrijske poslovne subjekte.</p>
                      <p><strong>DEP</strong> (Digitales Exportprotokoll) — digitalni zapis svih transakcija.</p>
                    </>
                  )}
                  {selectedCountry === 'DE' && (
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
        </TabsContent>

        {/* ===================== TAB: NOGA RAČUNA ===================== */}
        <TabsContent value="receipt" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Noga računa
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Besedilo, ki se izpiše na dnu vsakega računa. Pogosto se uporablja za zahvalo, informacije o garanciji ali kontaktne podatke.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Besedilo noge računa</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.receiptFooter || ''}
                  onChange={e => updateField('receiptFooter', e.target.value)}
                  placeholder="npr. Hvala za obisk! / Thank you for your visit!"
                  maxLength={200}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Priporočamo največ 150 znakov za termični tisk</span>
                  <span>{(form.receiptFooter || '').length}/200</span>
                </div>
              </div>

              {/* Predogled celotnega računa */}
              <Card className="max-w-xs mx-auto">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-center">Predogled računa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-950 text-black dark:text-gray-100 p-3 rounded border space-y-1">
                    <div className="text-center">
                      <p className="font-bold text-xs">{form.name || 'Naziv podjetja'}</p>
                      <p>{form.address || 'Naslov'}</p>
                      <p>{form.postCode} {form.city}</p>
                      <p>{form.phone}</p>
                      <div className="flex justify-between">
                        <span>MAT: {form.businessId || '--------'}</span>
                        <span>ID: {form.taxId || 'SI--------'}</span>
                      </div>
                      <p>Blagajna: {form.registerNumber || 'BLG-001'}</p>
                    </div>
                    <div className="border-t border-dashed pt-1">
                      <p>Račun št.: R-2026-000001</p>
                      <p>Datum: {new Date().toLocaleDateString('sl-SI')}</p>
                    </div>
                    <div className="border-t border-dashed pt-1">
                      <div className="flex justify-between"><span>1x Testni artikel</span><span>10.00€</span></div>
                      <div className="flex justify-between text-gray-500"><span>  1x 8.20€ + DDV 22%</span><span>osn.8.20 ddv.1.80</span></div>
                    </div>
                    <div className="border-t border-dashed pt-1">
                      <div className="flex justify-between"><span>Vmesna vsota:</span><span>8.20€</span></div>
                      <div className="flex justify-between"><span>DDV 22%:</span><span>1.80€</span></div>
                      <div className="flex justify-between font-bold"><span>SKUPAJ:</span><span>10.00€</span></div>
                    </div>
                    <div className="border-t border-dashed pt-1 text-center">
                      <p className="break-all">ZOI: ABCD1234-EFGH5678-IJKL</p>
                      <p className="text-emerald-600">Davčno overjeno ✓</p>
                    </div>
                    {form.receiptFooter && (
                      <div className="border-t border-dashed pt-1 text-center">
                        <p>{form.receiptFooter}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Storno račun info */}
              <Card className="border-red-200 dark:border-red-900/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Storno račun
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    V primeru napake na računu se račun ne sme brisati ali spreminjati. Namesto tega se izda storno račun,
                    ki razveljavi prvotnega. Storno račun mora vsebovati sklic na originalni račun in mora biti prav tako davčno overjen.
                  </p>
                  <div className="text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-lg space-y-1">
                    <p className="font-semibold text-red-700 dark:text-red-400">Pravila za storno:</p>
                    <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-0.5">
                      <li>Storno račun mora biti izdan na isti dan kot original</li>
                      <li>Mora vsebovati oznako "STORNO" in sklic na originalni račun</li>
                      <li>Vrednost je enaka originalu, a z negativnim predznakom</li>
                      <li>Mora biti davčno overjen pri FURS</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5" />
            {currentCountryConfig.flag} {currentCountryConfig.nameLocal}
          </span>
          <span className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            Okolje: <Badge variant={form.fursEnvironment === 'production' ? 'destructive' : 'outline'} className="text-[9px] h-4">
              {form.fursEnvironment === 'production' ? 'PRODUKCIJA' : 'TEST'}
            </Badge>
          </span>
          <span>Blagajna: {form.registerNumber || 'BLG-001'}</span>
          <span>Davek: {form.defaultVatRate}% / {form.reducedVatRate}%</span>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && <span>Zadnje shranjevanje: {lastSaved}</span>}
          <span className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${fursStatus === 'connected' ? 'bg-emerald-500' : fursStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
            {fursStatus === 'connected' ? `${currentCountryConfig.fiscalization.authorityShort} povezan` : fursStatus === 'error' ? `${currentCountryConfig.fiscalization.authorityShort} napaka` : `${currentCountryConfig.fiscalization.authorityShort} nepovezan`}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// FURS BATCH VERIFICATION — Množična overitev neoverjenih računov
// ============================================

function FursBatchVerification() {
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResults, setBatchResults] = useState<{
    processed: number
    successful: number
    failed: number
    results: Array<{
      receiptId: string
      receiptNumber: string
      success: boolean
      error?: string
      isSimulation?: boolean
    }>
  } | null>(null)

  const { data: batchStatus, isLoading: batchLoading, refetch } = useQuery<{
    unverifiedCount: number
    oldestUnverified: { receiptNumber: string; createdAt: string } | null
  }>({
    queryKey: ['furs-batch-status'],
    queryFn: async () => {
      const res = await authFetch('/api/furs/batch')
      if (!res.ok) return { unverifiedCount: 0, oldestUnverified: null }
      return res.json()
    },
    refetchInterval: batchRunning ? 5000 : 60000,
  })

  const runBatch = async () => {
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
  }

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
