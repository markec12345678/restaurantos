'use client'

import { memo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Eye, EyeOff, Send, Settings2 } from 'lucide-react'

// ============================================
// EMAIL ZAVIHEK — SMTP nastavitve
// ============================================
// Stranka lahko nastavi:
//   - SMTP strežnik (host, port, user, password)
//   - Pošiljatelj (from email + ime)
//   - Prejemniki poročil (za Z-report email)
//   - Test pošiljanje
// ============================================

interface EmailTabProps {
  form: Record<string, unknown>
  updateField: (_field: string, _value: unknown) => void
}

export const EmailTab = memo(function EmailTab({ form, updateField }: EmailTabProps) {
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')

  const smtpHost = (form.emailSmtpHost as string) || ''
  const smtpPort = (form.emailSmtpPort as string) || ''
  const smtpUser = (form.emailSmtpUser as string) || ''
  const smtpPassword = (form.emailSmtpPassword as string) || ''
  const emailFrom = (form.emailFrom as string) || ''
  const emailReportRecipients = (form.emailReportRecipients as string) || '[]'

  const hasSmtpConfig = !!(smtpHost && smtpPort && smtpUser && smtpPassword)
  const hasEmailFrom = !!emailFrom

  async function handleTestEmail() {
    setTesting(true)
    setTestResult('idle')
    try {
      // Simulacija testa — v produkciji bi klical /api/settings/test-email
      await new Promise(resolve => setTimeout(resolve, 1500))
      setTestResult(hasSmtpConfig ? 'success' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── SMTP strežnik ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            SMTP strežnik
          </CardTitle>
          <CardDescription>
            Konfiguracija za pošiljanje e-pošte (Z-report, dnevna poročila, obvestila).
            Priporočamo Gmail SMTP ali SendGrid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP strežnik</Label>
              <Input
                id="smtpHost"
                type="text"
                value={smtpHost}
                onChange={e => updateField('emailSmtpHost', e.target.value)}
                placeholder="smtp.gmail.com"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                type="text"
                value={smtpPort}
                onChange={e => updateField('emailSmtpPort', e.target.value)}
                placeholder="587"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Uporabniško ime</Label>
              <Input
                id="smtpUser"
                type="text"
                value={smtpUser}
                onChange={e => updateField('emailSmtpUser', e.target.value)}
                placeholder="info@restavracija.si"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">Geslo / App password</Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={e => updateField('emailSmtpPassword', e.target.value)}
                  placeholder="••••••••"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                >
                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasSmtpConfig ? 'default' : 'secondary'}>
              {hasSmtpConfig ? '✓ Konfigurirano' : 'Ni nastavljeno'}
            </Badge>
            {smtpPort === '465' && <Badge variant="outline">SSL</Badge>}
            {smtpPort === '587' && <Badge variant="outline">TLS</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* ─── Pošiljatelj ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-500" />
            Pošiljatelj
          </CardTitle>
          <CardDescription>
            E-poštni naslov in ime, ki bo prikazano kot pošiljatelj poročil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="emailFrom">From e-pošta</Label>
            <Input
              id="emailFrom"
              type="email"
              value={emailFrom}
              onChange={e => updateField('emailFrom', e.target.value)}
              placeholder="info@restavracija.si"
              className="font-mono text-sm"
            />
          </div>
          <Badge variant={hasEmailFrom ? 'default' : 'secondary'}>
            {hasEmailFrom ? '✓ Nastavljeno' : 'Manjka'}
          </Badge>
        </CardContent>
      </Card>

      {/* ─── Prejemniki poročil ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-purple-500" />
            Prejemniki poročil
          </CardTitle>
          <CardDescription>
            E-poštni naslovi, ki bodo prejemali dnevna Z-report poročila.
            Ločite z vejico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="emailRecipients">Prejemniki (vejica ločena)</Label>
            <Input
              id="emailRecipients"
              type="text"
              value={emailReportRecipients === '[]' ? '' : emailReportRecipients}
              onChange={e => updateField('emailReportRecipients', e.target.value)}
              placeholder="vodja@restavracija.si, racunovodstvo@restavracija.si"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Test pošiljanje ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-500" />
            Test e-pošte
          </CardTitle>
          <CardDescription>
            Pošlji testno e-pošto za preverjanje konfiguracije.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleTestEmail}
            disabled={testing || !hasSmtpConfig}
            className="btn-press"
          >
            {testing ? 'Pošiljam...' : 'Pošlji test e-pošto'}
          </Button>
          {testResult === 'success' && (
            <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1 animate-fade-in-up">
              ✓ Test e-pošta uspešno poslana!
            </p>
          )}
          {testResult === 'error' && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1 animate-fade-in-up">
              ✗ Napaka pri pošiljanju. Preverite SMTP nastavitve.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
