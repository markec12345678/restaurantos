'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { usePOSStore } from '@/lib/store'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import type { SettingsData, FursStatus, SettingsFormWithFlags } from './constants'
import { useSettingsSave } from './useSettingsSave'
import { mapCisEchoResponseToStatus } from './cis-status'
import { mapCisSendResponseToStatus } from './cis-send-status'
import type { CisSendResponse } from './cis-send-status'

// ============================================
// HOOK: Upravljanje nastavitev
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useSettingsManager() {
  const { country: storeCountry } = usePOSStore()
  const [activeTab, setActiveTab] = useState('country')
  const [fursStatus, setFursStatus] = useState<FursStatus>('disconnected')
  const [cisStatus, setCisStatus] = useState<FursStatus>('disconnected')
  const [cisSendStatus, setCisSendStatus] = useState<FursStatus>('disconnected')
  const [cisSendResult, setCisSendResult] = useState<CisSendResponse | null>(null)
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

  // SettingsFormWithFlags: API vrne tudi hasCisCert/hasFursCert flege
  // (nisem del zapisljivega SettingsData — glej constants.ts)
  const [form, setForm] = useState<SettingsFormWithFlags>({})

  useEffect(() => {
    if (settings) {
      queueMicrotask(() => {
        setForm({ ...settings })
        if (settings.country) {
          setSelectedCountry(settings.country as CountryCode)
        }
      })
    }
  }, [settings])

  const handleCountryChange = useCallback((code: CountryCode) => {
    // FIX r35: izbira države je SAMO predogled (lokalni state) — persistiran store
    // (pos_country v localStorage + i18n jezik + store taxRate) se posodobi šele ob
    // uspešnem Shrani (useSettingsSave onSuccess). Prej je klik na državo TAKOJ
    // preklopil jezik cele aplikacije in preživel reload brez shranjevanja
    // (r35 QA repro: klik HR → cel UI v hr, preživel reload).
    setSelectedCountry(code)
    const config = getCountryConfig(code)
    setForm(prev => ({
      ...prev,
      country: code,
      currency: config.currency,
      locale: config.locale,
      defaultVatRate: config.taxRates.standard,
      reducedVatRate: config.taxRates.reduced,
    }))
  }, [])

  const currentCountryConfig = getCountryConfig(selectedCountry)

  const { saveMutation, bulkVatMutation, handleSave, handleBulkVatChange } = useSettingsSave({
    form, bulkVatFrom, bulkVatTo,
  })

  // Posodobi lastSaved ko se saveMutation uspešno izvede
  useEffect(() => {
    if (saveMutation.isSuccess) {
      queueMicrotask(() => {
        setLastSaved(new Date().toLocaleTimeString('sl-SI'))
      })
    }
  }, [saveMutation.isSuccess])

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

  // CIS povezljivost (Hrvaška) — zrcali testFursConnection, ampak kliče
  // GET /api/cis/echo?environment=... (odgovor: { reachable, echoed, ... }).
  // Okolje prihaja iz forme (cisEnvironment) — zato je forma v deps.
  const testCisConnection = useCallback(async () => {
    setCisStatus('testing')
    try {
      const environment = form.cisEnvironment || 'test'
      const res = await authFetch(`/api/cis/echo?environment=${encodeURIComponent(environment)}`)
      const data = await res.json()
      const { status, message } = mapCisEchoResponseToStatus(data)
      setCisStatus(status)
      if (status === 'connected') {
        toast.success(message)
      } else {
        toast.error(message)
      }
    } catch {
      setCisStatus('error')
      toast.error('CIS povezava neuspešna - napaka pri preverjanju')
    }
  }, [form])

  // Testna oddaja računa (POST /api/cis/test-invoice) — polna fiskalizacijska
  // runda: ZKI + XML-dsig + SOAP POST + JIR parsing. Zahteva naložen P12
  // (hasCisCert flag iz /api/settings) — brez njega NE kliče API-ja.
  const sendCisTestInvoice = useCallback(async () => {
    if (!form.hasCisCert) {
      toast.error('FINA P12 certifikat ni nastavljen — vnesi pot in geslo ter shrani nastavitve')
      return
    }
    setCisSendStatus('testing')
    try {
      const environment = form.cisEnvironment || 'test'
      const res = await authFetch('/api/cis/test-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment }),
      })
      const data = (await res.json()) as CisSendResponse
      setCisSendResult(data)
      const { status, message } = mapCisSendResponseToStatus(data)
      setCisSendStatus(status)
      if (status === 'connected') {
        toast.success(message)
      } else {
        toast.error(message)
      }
    } catch {
      setCisSendStatus('error')
      toast.error('Testna oddaja neuspešna — napaka pri komunikaciji s strežnikom')
    }
  }, [form])

  const updateField = useCallback((field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  return {
    activeTab, setActiveTab,
    fursStatus,
    cisStatus,
    cisSendStatus,
    cisSendResult,
    lastSaved,
    selectedCountry,
    bulkVatFrom, setBulkVatFrom,
    bulkVatTo, setBulkVatTo,
    form,
    currentCountryConfig,
    isLoading,
    saveMutation,
    bulkVatMutation,
    handleCountryChange,
    handleSave,
    handleBulkVatChange,
    testFursConnection,
    testCisConnection,
    sendCisTestInvoice,
    updateField,
  }
}
