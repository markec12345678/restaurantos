'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { usePOSStore } from '@/lib/store'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import { setLocale } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import type { SettingsData, FursStatus } from './constants'

// ============================================
// HOOK: Upravljanje nastavitev
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useSettingsManager() {
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
      const res = await authFetch('/api/furs')
      const data = await res.json()

      if (data.connected) {
        setFursStatus('connected')
        toast.success(data.message || `FURS povezava uspešna (${data.environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'})`)
      } else if (data.configValid) {
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

  return {
    // Stanja
    activeTab, setActiveTab,
    fursStatus,
    lastSaved,
    selectedCountry,
    bulkVatFrom, setBulkVatFrom,
    bulkVatTo, setBulkVatTo,
    form,
    currentCountryConfig,
    isLoading,

    // Mutacije
    saveMutation,
    bulkVatMutation,

    // Handlerji
    handleCountryChange,
    handleSave,
    handleBulkVatChange,
    testFursConnection,
    updateField,
  }
}
