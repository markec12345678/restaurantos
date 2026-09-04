'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Building2, Cloud, HardDrive } from 'lucide-react'

interface SetupStatus {
  isInitialized: boolean
  mode: 'single' | 'multi'
  hasEmployees: boolean
  hasLocations: boolean
  hasSettings: boolean
  counts: { employees: number; locations: number; settings: number }
  multiLocationReady: boolean
  databaseUrl: string
}

export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationCode, setLocationCode] = useState('HQ')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationPostCode, setLocationPostCode] = useState('')
  const [locationPhone, setLocationPhone] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [registerNumber, setRegisterNumber] = useState('')
  const [fursEnvironment, setFursEnvironment] = useState<'test' | 'production'>('test')

  useEffect(() => { checkStatus() }, [])

  async function checkStatus() {
    try {
      const res = await fetch('/api/setup/status')
      if (!res.ok) throw new Error('Napaka pri pridobivanju stanja')
      const data = await res.json()
      setStatus(data)
      if (data.isInitialized) {
        setTimeout(() => router.push('/'), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, adminName, adminEmail, adminPin, restaurantName,
          locationName, locationCode: locationCode.toUpperCase(),
          locationAddress, locationCity, locationPostCode, locationPhone,
          businessId, taxId, registerNumber, fursEnvironment,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri inicializaciji')

      setSuccess(`Sistem uspešno inicializiran! Admin PIN: ${adminPin}. Preusmerjam na prijavo...`)
      setTimeout(() => router.push('/'), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (status?.isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Sistem je že inicializiran</h2>
            <p className="text-muted-foreground mb-4">Preusmerjam na prijavo...</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">RestaurantOS Setup</h1>
          <p className="text-muted-foreground mt-2">Prvi zagon — nastavitev admin uporabnika in lokacije</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Način delovanja</CardTitle>
            <CardDescription>Izberite, ali gre za eno lokacijo ali pripravo na več lokacij</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'multi')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single" className="gap-2"><HardDrive className="w-4 h-4" />Ena lokacija</TabsTrigger>
                <TabsTrigger value="multi" className="gap-2"><Cloud className="w-4 h-4" />Več lokacij</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="mt-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-emerald-900">Priporočeno za 1 restavracijo</p>
                    <p className="text-emerald-700 mt-1">Uporablja vgrajeno PostgreSQL bazo (PGlite) — brez konfiguracije. Podatki se shranjujejo lokalno. Deluje takoj po namestitvi.</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="multi" className="mt-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <Cloud className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Za 2+ lokacije (lanško, franšize)</p>
                    <p className="text-blue-700 mt-1">Zahteva zunanjo PostgreSQL bazo v oblaku (Supabase, Neon, Railway). Vse lokacije delijo skupno bazo. Nastavi <code className="bg-blue-100 px-1 rounded">DATABASE_URL</code> v .env.</p>
                    {!status?.multiLocationReady && (
                      <p className="text-amber-700 mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" />DATABASE_URL ni nastavljen — trenutno delujete v PGlite načinu</p>
                    )}
                    {status?.multiLocationReady && (
                      <p className="text-emerald-700 mt-2 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Zunanja baza zaznana — pripravljen za multi-lokacijo</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Admin uporabnik</CardTitle>
              <CardDescription>Glavni administrator s polnimi dovoljenji</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Ime in priimek *</Label>
                  <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Janez Novak" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">E-pošta *</Label>
                  <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="janez@restavracija.si" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPin">PIN (4 številke) *</Label>
                <Input
                  id="adminPin" value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234" maxLength={4} inputMode="numeric" pattern="\d{4}" required
                  className="max-w-[120px] text-lg font-mono tracking-widest text-center"
                />
                <p className="text-xs text-muted-foreground">PIN se uporablja za hitro prijavo v POS. Izberite 4 številke, ki si jih boste zapomnili.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Restavracija & lokacija</CardTitle>
              <CardDescription>{mode === 'single' ? 'Podatki o vaši restavraciji' : 'Prva lokacija (kasneje lahko dodate več v nastavitvah)'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurantName">Ime restavracije *</Label>
                <Input id="restaurantName" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="Restavracija Pri Janezu" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="locationName">Ime lokacije *</Label>
                  <Input id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Glavna restavracija" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationCode">Koda *</Label>
                  <Input id="locationCode" value={locationCode} onChange={(e) => setLocationCode(e.target.value.toUpperCase().slice(0, 10))} placeholder="HQ" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationAddress">Naslov</Label>
                <Input id="locationAddress" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Slovenska cesta 1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locationPostCode">Poštna številka</Label>
                  <Input id="locationPostCode" value={locationPostCode} onChange={(e) => setLocationPostCode(e.target.value)} placeholder="1000" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="locationCity">Mesto</Label>
                  <Input id="locationCity" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="Ljubljana" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationPhone">Telefon</Label>
                <Input id="locationPhone" value={locationPhone} onChange={(e) => setLocationPhone(e.target.value)} placeholder="+386 1 234 5678" />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">FURS podatki (opcijsko)</CardTitle>
              <CardDescription>Davčna številka in poslovni podatki za FURS potrjevanje računov</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessId">Matična številka</Label>
                  <Input id="businessId" value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="12345678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Davčna številka (DDV)</Label>
                  <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="SI12345678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registerNumber">Št. blagajne</Label>
                  <Input id="registerNumber" value={registerNumber} onChange={(e) => setRegisterNumber(e.target.value)} placeholder="BL01" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>FURS okolje</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={fursEnvironment === 'test' ? 'default' : 'outline'} onClick={() => setFursEnvironment('test')} className="flex-1">Testno (priporočeno za začetek)</Button>
                  <Button type="button" variant={fursEnvironment === 'production' ? 'default' : 'outline'} onClick={() => setFursEnvironment('production')} className="flex-1">Produkcija</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Testno okolje omogoča preverjanje brez pravega FURS certifikata. Preklopite na produkcijo, ko dobite certifikat.</p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-900">{success}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-12 text-base" size="lg">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Inicializiram...</>
            ) : 'Inicializiraj sistem'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Po inicializaciji se lahko prijavite s PIN kodo in začnete uporabljati sistem. Vse nastavitve lahko kasneje spremenite v nastavitvah.</p>
        </div>
      </div>
    </div>
  )
}
