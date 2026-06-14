'use client'

import { useState, useCallback, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Shield } from 'lucide-react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { TestResult, FursEnvironment, FursSettings, FursStatus } from './furs/constants'

// Lazy-loaded pod-komponente
const FursStatusCards = dynamic(() => import('./furs/FursStatusCards').then((m) => m.FursStatusCards), { ssr: false })
const CertificateConfig = dynamic(() => import('./furs/CertificateConfig').then((m) => m.CertificateConfig), { ssr: false })
const TestResults = dynamic(() => import('./furs/TestResults').then((m) => m.TestResults), { ssr: false })
const CurrentConfig = dynamic(() => import('./furs/CurrentConfig').then((m) => m.CurrentConfig), { ssr: false })
const FursSpecification = dynamic(() => import('./furs/FursSpecification').then((m) => m.FursSpecification), { ssr: false })

export const FursManager = memo(function FursManager() {
  const queryClient = useQueryClient()
  const [certPath, setCertPath] = useState('')
  const [certPassword, setCertPassword] = useState('')
  const [environment, setEnvironment] = useState<FursEnvironment>('test')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.furs.settings,
    queryFn: async () => {
      const res = await authFetch('/api/settings')
      return res.json() as Promise<FursSettings>
    },
  })

  const { data: fursStatus } = useQuery({
    queryKey: queryKeys.furs.status,
    queryFn: async () => {
      const res = await authFetch('/api/furs')
      return res.json() as Promise<FursStatus>
    },
    refetchInterval: 60000,
  })

  // FIX FURS-11 MEDIUM: Test connection uses GET (prejšnji POST z action je failal Zod validacijo)
  const testConnection = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/furs', { method: 'GET' })
      const data = await res.json()
      setTestResult({ success: data.connected, ...data })
    } catch {
      setTestResult({ success: false, error: 'Povezava ni uspela' })
    } finally {
      setTesting(false)
    }
  }, [])

  const saveCertificate = useCallback(async () => {
    setSaving(true)
    try {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fursCertPath: certPath,
          fursCertPassword: certPassword,
          fursEnvironment: environment,
        }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.furs.settings })
        toast.success('FURS certifikat shranjen!')
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }, [certPath, certPassword, environment, queryClient])

  const testInvoice = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // FIX HIGH: Prejšnja koda je pošiljala { action: 'test_invoice' } kar ne ustreza
      // fursVerifySchema (ki zahteva orderId). Testni račun potrebuje veljaven orderId.
      // Za testiranje FURS povezave uporabimo GET /api/furs (connectivity check) namesto POST
      const res = await authFetch('/api/furs', { method: 'GET' })
      const data = await res.json()
      setTestResult(data)
      if (data.connected) {
        toast.success(`FURS povezava OK (${data.environment || 'test'})`)
      } else {
        toast.error(`FURS ni dosegljiv: ${data.message || 'Neznana napaka'}`)
      }
    } catch {
      setTestResult({ success: false, error: 'Testna povezava ni uspela' })
      toast.error('Napaka pri testiranju FURS povezave')
    } finally {
      setTesting(false)
    }
  }, [])

  const handleCertPathChange = useCallback((v: string) => setCertPath(v), [])
  const handleCertPasswordChange = useCallback((v: string) => setCertPassword(v), [])
  const handleEnvironmentChange = useCallback((v: FursEnvironment) => setEnvironment(v), [])

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  const isSimulation = fursStatus?.isSimulation !== false
  const isConnected = fursStatus?.connected || false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            FURS Davčno potrjevanje
          </h2>
          <p className="text-muted-foreground">Upravljanje FURS certifikata in overjanje računov</p>
        </div>
        <Badge variant={isSimulation ? 'secondary' : 'default'} className={isSimulation ? '' : 'bg-green-600'}>
          {isSimulation ? 'Simulacija' : 'Produkcija'}
        </Badge>
      </div>

      {/* Status */}
      <FursStatusCards
        isConnected={isConnected}
        environment={environment}
        certPath={certPath}
        verifiedCount={fursStatus?.verifiedCount || 0}
      />

      {/* Certificate configuration */}
      <CertificateConfig
        certPath={certPath}
        certPassword={certPassword}
        environment={environment}
        saving={saving}
        onCertPathChange={handleCertPathChange}
        onCertPasswordChange={handleCertPasswordChange}
        onEnvironmentChange={handleEnvironmentChange}
        onSave={saveCertificate}
      />

      {/* Test results */}
      <TestResults
        testing={testing}
        testResult={testResult}
        onTestConnection={testConnection}
        onTestInvoice={testInvoice}
      />

      {/* Current config */}
      <CurrentConfig settings={settings ?? null} />

      {/* FURS specification info */}
      <FursSpecification />
    </div>
  )
})
