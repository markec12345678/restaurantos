'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Settings, Building2, Shield, Receipt, Percent, Globe,
  Save,
} from 'lucide-react'
import { useState, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { usePOSStore } from '@/lib/store'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import { setLocale } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import type { SettingsData, FursStatus } from './settings/constants'

// Lazy-loaded podkomponente
const CountryTab = dynamic(() => import('./settings/CountryTab').then(m => ({ default: m.CountryTab })), { ssr: false })
const CompanyTab = dynamic(() => import('./settings/CompanyTab').then(m => ({ default: m.CompanyTab })), { ssr: false })
const TaxTab = dynamic(() => import('./settings/TaxTab').then(m => ({ default: m.TaxTab })), { ssr: false })
const FursTab = dynamic(() => import('./settings/FursTab').then(m => ({ default: m.FursTab })), { ssr: false })
const ReceiptTab = dynamic(() => import('./settings/ReceiptTab').then(m => ({ default: m.ReceiptTab })), { ssr: false })
const SettingsStatusBar = dynamic(() => import('./settings/SettingsStatusBar').then(m => ({ default: m.SettingsStatusBar })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const SettingsManager = memo(function SettingsManager() {
  const queryClient = useQueryClient()
  const { country: storeCountry, setCountry: setStoreCountry, setLocale: setStoreLocale } = usePOSStore()
  const [activeTab, setActiveTab] = useState('country')
  const [fursStatus, setFursStatus] = useState<FursStatus>('disconnected')
  const [lastSaved, setLastSaved] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>((storeCountry as CountryCode) || 'SI')
  const [bulkVatFrom, setBulkVatFrom] = useState('22')
  const [bulkVatTo, setBulkVatTo] = useState('22')

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
      queueMicrotask(() => {
        setForm({ ...settings })
        // Sinhronizacija države iz nastavitev v lokalno stanje
        if (settings.country) {
          setSelectedCountry(settings.country as CountryCode)
        }
      })
    }
  }, [settings])

  // Ko se spremeni država, samodejno posodobi nastavitve
  const handleCountryChange = useCallback((code: CountryCode) => {
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
  }, [setStoreCountry, setStoreLocale])

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

  const handleSave = useCallback(() => {
    saveMutation.mutate(form)
  }, [form, saveMutation])

  const bulkVatMutation = useMutation({
    mutationFn: async ({ fromRate, toRate }: { fromRate: number; toRate: number }) => {
      const res = await authFetch('/api/menu-items/bulk-vat', {
        method: 'POST',
        body: JSON.stringify({ fromRate, toRate }),
      })
      if (!res.ok) throw new Error('Napaka pri masovni spremembi DDV')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`DDV stopnja posodobljena za ${data?.updated ?? 'vse'} artikle`)
      queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all })
    },
    onError: () => toast.error('Napaka pri masovni spremembi DDV'),
  })

  const handleBulkVatChange = useCallback(() => {
    const from = parseFloat(bulkVatFrom)
    const to = parseFloat(bulkVatTo)
    if (isNaN(from) || isNaN(to)) {
      toast.error('Izberite veljavne DDV stopnje')
      return
    }
    if (from === to) {
      toast.error('Sedanja in nova stopnja morata biti različni')
      return
    }
    bulkVatMutation.mutate({ fromRate: from, toRate: to })
  }, [bulkVatFrom, bulkVatTo, bulkVatMutation])

  const testFursConnection = useCallback(async () => {
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
  }, [])

  const updateField = useCallback((field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

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
            <Globe className="h-3.5 w-3.5" /> Država
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

        {/* TAB: DRŽAVA / REGIJA */}
        <TabsContent value="country" className="space-y-4 mt-4">
          <CountryTab
            selectedCountry={selectedCountry}
            onCountryChange={handleCountryChange}
          />
        </TabsContent>

        {/* TAB: PODATKI PODJETJA */}
        <TabsContent value="company" className="space-y-4 mt-4">
          <CompanyTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: DAVČNE NASTAVITVE */}
        <TabsContent value="tax" className="space-y-4 mt-4">
          <TaxTab
            form={form}
            updateField={updateField}
            currentCountryCode={selectedCountry}
            bulkVatFrom={bulkVatFrom}
            bulkVatTo={bulkVatTo}
            setBulkVatFrom={setBulkVatFrom}
            setBulkVatTo={setBulkVatTo}
            onBulkVatChange={handleBulkVatChange}
            bulkVatPending={bulkVatMutation.isPending}
          />
        </TabsContent>

        {/* TAB: FISKALIZACIJA */}
        <TabsContent value="furs" className="space-y-4 mt-4">
          <FursTab
            form={form}
            updateField={updateField}
            fursStatus={fursStatus}
            onTestFursConnection={testFursConnection}
            currentCountryCode={selectedCountry}
          />
        </TabsContent>

        {/* TAB: NOGA RAČUNA */}
        <TabsContent value="receipt" className="space-y-4 mt-4">
          <ReceiptTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>
      </Tabs>

      {/* Status bar */}
      <SettingsStatusBar
        form={form}
        fursStatus={fursStatus}
        lastSaved={lastSaved}
        currentCountryCode={selectedCountry}
      />
    </div>
  )
})
