'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Shield, Check, AlertTriangle, X, Upload, TestTube, RefreshCw,
  Server, Key, FileKey, Wifi, WifiOff, Settings, Activity,
} from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'

export function FursManager() {
  const queryClient = useQueryClient()
  const [certPath, setCertPath] = useState('')
  const [certPassword, setCertPassword] = useState('')
  const [environment, setEnvironment] = useState<'test' | 'production'>('test')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['furs-settings'],
    queryFn: async () => {
      const res = await authFetch('/api/settings')
      return res.json()
    },
  })

  const { data: fursStatus } = useQuery({
    queryKey: ['furs-status'],
    queryFn: async () => {
      const res = await authFetch('/api/furs')
      return res.json()
    },
    refetchInterval: 60000,
  })

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/furs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection', environment }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({ success: false, error: 'Povezava ni uspela' })
    } finally {
      setTesting(false)
    }
  }

  async function saveCertificate() {
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
        queryClient.invalidateQueries({ queryKey: ['furs-settings'] })
        alert('FURS certifikat shranjen!')
      }
    } catch (err) {
      alert('Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }

  async function testInvoice() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/furs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_invoice', environment }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({ success: false, error: 'Testno račun ni uspel' })
    } finally {
      setTesting(false)
    }
  }

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
          {isSimulation ? '🔄 Simulacija' : '✅ Produkcija'}
        </Badge>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-500" />}
              <p className="text-xs text-muted-foreground">Povezava</p>
            </div>
            <p className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
              {isConnected ? 'Vzpostavljena' : 'Ni povezave'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Server className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-muted-foreground">Okolje</p>
            </div>
            <p className="font-bold">{environment === 'test' ? 'Testno' : 'Produkcijsko'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Key className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-muted-foreground">Certifikat</p>
            </div>
            <p className={`font-bold ${certPath ? 'text-green-600' : 'text-red-500'}`}>
              {certPath ? 'Naložen' : 'Manjka'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <p className="text-xs text-muted-foreground">Overjeni računi</p>
            </div>
            <p className="font-bold">{fursStatus?.verifiedCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Certificate configuration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileKey className="h-4 w-4" />
            Certifikat PKCS12 (p12/pfx)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-400">Pomembno za produkcijo</p>
                <p className="text-amber-700 dark:text-amber-500 mt-1">
                  V produkciji MORA biti naložen pravi FURS p12 certifikat. Brez certifikata se računi overjajo simulirano, kar NI skladno z zakonom ZDDV-1.
                  Certifikat pridobite na <a href="https://edavki.durs.si" target="_blank" className="underline">eDavki FURS</a>.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Pot do certifikata (.p12 / .pfx / .pem)</label>
              <Input
                placeholder="/path/to/certifikat.p12"
                value={certPath}
                onChange={e => setCertPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Npr.: /home/z/certificates/furs-test.p12 ali C:\certs\furs.p12
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Geslo certifikata</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={certPassword}
                onChange={e => setCertPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Okolje</label>
              <select
                value={environment}
                onChange={e => setEnvironment(e.target.value as 'test' | 'production')}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              >
                <option value="test">Testno (blagajne-test.fu.gov.si)</option>
                <option value="production">Produkcijsko (blagajne.fu.gov.si)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveCertificate} disabled={!certPath || saving} className="gap-2">
              <Upload className="h-4 w-4" />
              {saving ? 'Shranjujem...' : 'Shrani certifikat'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Testiranje povezave
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={testConnection} variant="outline" disabled={testing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
              Test povezave
            </Button>
            <Button onClick={testInvoice} disabled={testing} className="gap-2">
              <FileKey className="h-4 w-4" />
              Testni račun
            </Button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? <Check className="h-5 w-5 text-green-600" /> : <X className="h-5 w-5 text-red-600" />}
                <span className="font-bold">{testResult.success ? 'Uspešno!' : 'Napaka'}</span>
              </div>
              {testResult.isSimulation && (
                <p className="text-sm text-amber-600 mb-2">⚠ Simulirano overjanje (brez pravega certifikata)</p>
              )}
              {testResult.zoi && (
                <div className="text-xs space-y-1">
                  <p><span className="font-medium">ZOI:</span> <span className="font-mono">{testResult.zoi}</span></p>
                  {testResult.eor && <p><span className="font-medium">EOR:</span> <span className="font-mono">{testResult.eor}</span></p>}
                  {testResult.responseTime && <p><span className="font-medium">Odzivni čas:</span> {testResult.responseTime}ms</p>}
                </div>
              )}
              {testResult.error && <p className="text-sm text-red-600">{testResult.error}</p>}
              {testResult.validationErrors && (
                <div className="mt-2 space-y-1">
                  {testResult.validationErrors.map((e: any, i: number) => (
                    <p key={i} className="text-xs text-red-600">• {e.field}: {e.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current config */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Trenutna FURS konfiguracija
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Matična št.</span>
              <span className="font-mono">{settings?.businessId || '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">DDV ID</span>
              <span className="font-mono">{settings?.taxId || '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Blagajna</span>
              <span className="font-mono">{settings?.registerNumber || '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Poslovni prostor</span>
              <span className="font-mono">{settings?.premisesId || '—'}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Okolje</span>
              <Badge variant={settings?.fursEnvironment === 'production' ? 'default' : 'secondary'}>
                {settings?.fursEnvironment === 'production' ? 'Produkcija' : 'Test'}
              </Badge>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
              <span className="text-muted-foreground">Certifikat</span>
              <Badge variant={settings?.fursCertPath ? 'default' : 'secondary'} className={settings?.fursCertPath ? 'bg-green-600' : ''}>
                {settings?.fursCertPath ? 'Naložen' : 'Manjka'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FURS specification info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Specifikacija FURS overjanja</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>RestaurantOS implementira FURS davčno potrjevanje po specifikaciji ZDDV-1:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>ZOI</strong> (Zaščitni Oznak Izdajatelja) — RSA-SHA256 podpis podatkov računa</li>
            <li><strong>EOR</strong> (Enotna Oznaka Računa) — potrditev FURS strežnika</li>
            <li><strong>OAuth2</strong> avtentikacija z JWT Bearer (RS256)</li>
            <li><strong>PKCS12</strong> certifikat — podpora za OpenSSL + Node.js crypto fallback</li>
            <li><strong>QR koda</strong> za preverjanje na <a href="https://blagajne.fu.gov.si/validation" target="_blank" className="underline">blagajne.fu.gov.si</a></li>
            <li><strong>DDV stopnje</strong>: 22% (standardna), 9.5% (znižana), 0% (oproščeno)</li>
            <li><strong>FURS kode</strong>: S = Standardna, R = Znižana, Z = Oproščeno</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
