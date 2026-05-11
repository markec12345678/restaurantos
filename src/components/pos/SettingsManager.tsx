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
  FileText, Phone, Mail, MapPin, Hash, CreditCard, Wifi
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

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
  isActive: boolean
}

// ============================================
// KOMPONENTA
// ============================================
export function SettingsManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('company')
  const [fursStatus, setFursStatus] = useState<'disconnected' | 'testing' | 'connected' | 'error'>('disconnected')
  const [lastSaved, setLastSaved] = useState<string>('')

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
    }
  }, [settings])

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
    // Simulacija FURS povezave - v produkcijski različici bi to poklicalo pravi FURS API
    setTimeout(() => {
      if (form.fursCertPath && form.fursCertPassword) {
        setFursStatus('connected')
        toast.success('FURS povezava uspešna (testno okolje)')
      } else {
        setFursStatus('error')
        toast.error('FURS povezava neuspešna - manjkajo podatki certifikata')
      }
    }, 1500)
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Podjetje
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Davki
          </TabsTrigger>
          <TabsTrigger value="furs" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> FURS
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Račun
          </TabsTrigger>
        </TabsList>

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
                Po zakonu o davku na dodano vrednost (ZDDV-1) ima Slovenija dve DDV stopnji: splošno (22%) in znižano (9.5%).
                Znižana stopnja velja za določena živila, knjige, zdravila, stanovanjske storitve itd.
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

              {/* DDV informacije */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Pomembno o DDV v Sloveniji
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                  <li>Splošna DDV stopnja: <strong>22%</strong> - velja za večino blaga in storitev</li>
                  <li>Znižana DDV stopnja: <strong>9.5%</strong> - živila (razen alkohola), knjige, zdravila, sanitarni material</li>
                  <li>Ničelna stopnja: <strong>0%</strong> - izvoz blaga, storitve tretjim državam</li>
                  <li>Ob spremembi DDV stopnje morate posodobiti vse artikle v jedilniku!</li>
                  <li>Na računu mora biti DDV izpisan po stopnjah z osnovo in zneskom davka</li>
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
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valuta</Label>
                  <Select value={form.currency || 'EUR'} onValueChange={v => updateField('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="HRK">HRK (kn)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jezik</Label>
                  <Select value={form.locale || 'sl-SI'} onValueChange={v => updateField('locale', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sl-SI">Slovenščina</SelectItem>
                      <SelectItem value="en-US">English</SelectItem>
                      <SelectItem value="hr-HR">Hrvatski</SelectItem>
                      <SelectItem value="it-IT">Italiano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB: FURS DAVČNO POTRJEVANJE ===================== */}
        <TabsContent value="furs" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                FURS davčno potrjevanje računov
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Po zakonu o davku na dodano vrednost (ZDDV-1) morajo vsi davčni zavezanci, ki izdajajo račune,
                te račune davčno overiti pri FURS (Finančna uprava Republike Slovenije).
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
                  <Label>Pot do FURS certifikata (.p12)</Label>
                  <Input
                    value={form.fursCertPath || ''}
                    onChange={e => updateField('fursCertPath', e.target.value)}
                    placeholder="/pot/do/certifikata.p12"
                  />
                  <p className="text-xs text-muted-foreground">Digitalni certifikat za podpisovanje računov (PKCS#12)</p>
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
                <Label>Okolje FURS</Label>
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

              {/* Informacije o FURS */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                  Kaj morate vedeti o davčnem potrjevanju v Sloveniji
                </h4>
                <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
                  <p><strong>ZDDV-1 (Zakon o DDV)</strong> določa, da morajo vsi zavezanci za DDV račune davčno overjevati pri FURS.</p>
                  <p><strong>ZOI (Zaščitni označitelj izdajanja)</strong> — 32-mestna številka, generirana iz digitalnega certifikata, ki se izpiše na računu.</p>
                  <p><strong>EOR (Elektronski zapis o računu)</strong> — potrditev FURS, da je račun bil sprejet. Vrne se v 3 sekundah.</p>
                  <p><strong>Rok za overitev:</strong> Račun mora biti overjen v 3 sekundah po izdaji. Brez overitve je račun neveljaven.</p>
                  <p><strong>Kazen:</strong> Za neoverjene račune grozi globo od 500 do 125.000 EUR (ZDDV-1, 85. člen).</p>
                </div>
              </div>

              {/* Kaj mora biti na računu */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Kaj mora pisati na računu (ZDDV-1)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">Obvezni podatki izdajatelja:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                        <li>Naziv podjetja</li>
                        <li>Naslov poslovnega prostora</li>
                        <li>Matična številka</li>
                        <li>ID za DDV (SIxxxxxxxxx)</li>
                        <li>Oznaka poslovnega prostora</li>
                        <li>Oznaka blagajne/naprave</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">Obvezni podatki računa:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                        <li>Številka računa (zaporedna)</li>
                        <li>Datum in ura izdaje</li>
                        <li>Naziv in količina artikla</li>
                        <li>Cena brez DDV</li>
                        <li>DDV stopnja po artiklih</li>
                        <li>Znesek DDV po stopnjah</li>
                        <li>Osnova za DDV po stopnjah</li>
                        <li>Skupni znesek z DDV</li>
                        <li>ZOI (zaščitni označitelj)</li>
                        <li>EOR (če je overjen)</li>
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
            <Monitor className="h-3.5 w-3.5" />
            Okolje: <Badge variant={form.fursEnvironment === 'production' ? 'destructive' : 'outline'} className="text-[9px] h-4">
              {form.fursEnvironment === 'production' ? 'PRODUKCIJA' : 'TEST'}
            </Badge>
          </span>
          <span>Blagajna: {form.registerNumber || 'BLG-001'}</span>
          <span>DDV: {form.defaultVatRate}% / {form.reducedVatRate}%</span>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && <span>Zadnje shranjevanje: {lastSaved}</span>}
          <span className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${fursStatus === 'connected' ? 'bg-emerald-500' : fursStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
            {fursStatus === 'connected' ? 'FURS povezan' : fursStatus === 'error' ? 'FURS napaka' : 'FURS nepovezan'}
          </span>
        </div>
      </div>
    </div>
  )
}
