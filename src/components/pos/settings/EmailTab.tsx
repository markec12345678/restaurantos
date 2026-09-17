'use client'

import { memo, useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Mail, Eye, EyeOff, Send, Settings2, Clock, Inbox, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { formatEUR } from '@/lib/safe-format'
import { buildDailyDigestHtml } from '@/lib/email/digest-html'

// ============================================
// EMAIL ZAVIHEK — SMTP nastavitve + dnevni menedžerski digest
// ============================================
// Task 21 FIX:
//   - lažni test (setTimeout) → REALNO pošiljanje prek /api/settings/test-email
//   - emailFrom (neobstoječe polje) → emailFromAddress (schema kolona)
//   - prejemniki: raw string → JSON array (konsistentno z email lib)
//   - NOVO: emailEnabled Switch — digest brez tega preskoči pošiljanje
//   - NOVO: predogled dnevnega povzetka (/api/reports/digest-preview)
// ============================================

interface DigestPreviewData {
  date: string
  ordersCount: number
  revenue: number
  tips: number
  tax: number
  avgTicket: number
  prevRevenue: number
  revenueChangePct: number | null
  paymentMethods: Array<{ method: string; count: number; amount: number }>
  topItems: Array<{ name: string; quantity: number; revenue: number }>
  furs: { sent: number; failed: number }
}

/** Razčleni emailReportRecipients vrednost (JSON ali legacy raw string) v prikazni seznam. */
export function parseRecipients(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
  } catch {
    // legacy: "a@b.si, c@d.si" — razdeli po vejici
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

export const EmailTab = memo(function EmailTab({ form, updateField }: {
  form: Record<string, unknown>
  updateField: (_field: string, _value: unknown) => void
}) {
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<DigestPreviewData | null>(null)

  const smtpHost = (form.emailSmtpHost as string) || ''
  const smtpPort = (form.emailSmtpPort as string) || ''
  const smtpUser = (form.emailSmtpUser as string) || ''
  const smtpPassword = (form.emailSmtpPassword as string) || ''
  const emailFrom = (form.emailFromAddress as string) || ''
  const emailEnabled = form.emailEnabled === true
  // FIX: prej raw string — zdaj JSON array (konsistentno z getReportRecipients)
  const recipientsRaw = (form.emailReportRecipients as string) || '[]'
  const [recipientsText, setRecipientsText] = useState(() => parseRecipients(recipientsRaw).join(', '))

  // Sync iz form → lokalni prikaz (form se naloži asinhrono)
  useEffect(() => {
    setRecipientsText(parseRecipients(recipientsRaw).join(', '))
  }, [recipientsRaw])

  const handleRecipientsChange = useCallback((text: string) => {
    setRecipientsText(text)
    const list = text.split(',').map(s => s.trim()).filter(Boolean)
    updateField('emailReportRecipients', JSON.stringify(list))
  }, [updateField])

  const hasSmtpConfig = !!(smtpHost && smtpPort && smtpUser)
  const hasRecipients = parseRecipients(recipientsRaw).length > 0

  async function handleTestEmail() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await authFetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testTo.trim() ? { to: testTo.trim() } : {}),
      })
      const json = (await res.json()) as { success?: boolean; error?: string; to?: string; from?: string; host?: string }
      if (res.ok && json.success) {
        setTestResult({ ok: true, message: `Poslano na ${json.to} (prek ${json.host || smtpHost})` })
        toast.success('Testni email uspešno poslan')
      } else {
        setTestResult({ ok: false, message: json.error || `Napaka ${res.status}` })
        toast.error('Testno pošiljanje ni uspelo')
      }
    } catch {
      setTestResult({ ok: false, message: 'Povezava s strežnikom ni uspela' })
      toast.error('Testno pošiljanje ni uspelo')
    } finally {
      setTesting(false)
    }
  }

  async function handlePreview() {
    setPreviewLoading(true)
    try {
      const res = await authFetch('/api/reports/digest-preview')
      if (!res.ok) throw new Error(`Napaka ${res.status}`)
      const json = (await res.json()) as { data: DigestPreviewData }
      setPreview(json.data)
    } catch {
      toast.error('Predogled ni uspel — preveri povezavo/pravice')
    } finally {
      setPreviewLoading(false)
    }
  }

  function openHtmlPreview() {
    if (!preview) return
    // Reuse produkcije: isti HTML kot email. Odpremo ločen zavihek prek Blob URL.
    const blob = new Blob([buildDailyDigestHtml(preview)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── Email storitev (glavni switch) ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-teal-600" />
            Email storitev
          </CardTitle>
          <CardDescription>
            Omogoči samodejna poročila po e-pošti: dnevni menedžerski povzetek (ob 2:00 UTC)
            in Z-report ob zaključku smene.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="emailEnabled" className="cursor-pointer">Samodejna pošiljanja</Label>
              <p className="text-xs text-muted-foreground">
                Brez tega stikala emaili ne bodo poslani, tudi če je SMTP nastavljen.
              </p>
            </div>
            <Switch
              id="emailEnabled"
              checked={emailEnabled}
              onCheckedChange={checked => updateField('emailEnabled', checked)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={emailEnabled ? 'default' : 'secondary'}>
              {emailEnabled ? '✓ Omogočeno' : 'Onemogočeno'}
            </Badge>
            <Badge variant={hasSmtpConfig ? 'default' : 'secondary'}>
              {hasSmtpConfig ? '✓ SMTP nastavljen' : 'SMTP manjka'}
            </Badge>
            <Badge variant={hasRecipients ? 'default' : 'secondary'}>
              {hasRecipients ? `✓ ${parseRecipients(recipientsRaw).length} prejemnikov` : 'Ni prejemnikov'}
            </Badge>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Dnevni povzetek pošilja cron ob <strong>02:00 UTC</strong> (03:00 po zimskem / 04:00 po poletnem
              času — Europe/Ljubljana) za prejšnji dan. Z-report pošilja ob zaključku smene.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── SMTP strežnik ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-teal-600" />
            SMTP strežnik
          </CardTitle>
          <CardDescription>
            Konfiguracija za pošiljanje e-pošte. Priporočamo Gmail SMTP ali SendGrid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  aria-label={showSmtpPassword ? 'Skrij geslo' : 'Pokaži geslo'}
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
            <Send className="h-5 w-5 text-emerald-600" />
            Pošiljatelj
          </CardTitle>
          <CardDescription>
            E-poštni naslov, ki bo prikazan kot pošiljatelj poročil
            (če je prazno, se uporabi naslov restavracije iz Podjetje zavihka).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="emailFrom">From e-pošta</Label>
            <Input
              id="emailFrom"
              type="email"
              value={emailFrom}
              onChange={e => updateField('emailFromAddress', e.target.value)}
              placeholder="porocila@restavracija.si"
              className="font-mono text-sm"
            />
          </div>
          <Badge variant={emailFrom ? 'default' : 'secondary'}>
            {emailFrom ? '✓ Nastavljeno' : 'Uporabi fallback (naslov restavracije)'}
          </Badge>
        </CardContent>
      </Card>

      {/* ─── Prejemniki poročil ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-purple-600" />
            Prejemniki poročil
          </CardTitle>
          <CardDescription>
            Naslovi, ki prejemajo dnevni povzetek in Z-report poročila. Ločite z vejico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="emailRecipients">Prejemniki (vejica ločena)</Label>
            <Input
              id="emailRecipients"
              type="text"
              value={recipientsText}
              onChange={e => handleRecipientsChange(e.target.value)}
              placeholder="vodja@restavracija.si, racunovodstvo@restavracija.si"
              className="text-sm"
            />
          </div>
          {parseRecipients(recipientsRaw).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parseRecipients(recipientsRaw).map((r, i) => (
                <Badge key={`${r}-${i}`} variant="outline" className="font-normal">
                  <Mail className="h-3 w-3 mr-1" />
                  {r}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Test pošiljanje (REALNO) ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-600" />
            Test e-pošte
          </CardTitle>
          <CardDescription>
            Pošlje resničen testni email prek zgoraj shranjenih SMTP nastavitev
            (deluje tudi, če so samodejna pošiljanja še onemogočena).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="Naslov (prazno = prvi prejemnik zgoraj)"
              className="text-sm flex-1"
            />
            <Button onClick={handleTestEmail} disabled={testing} className="btn-press">
              {testing ? 'Pošiljam...' : 'Pošlji test e-pošto'}
            </Button>
          </div>
          {testResult?.ok && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-start gap-1.5 animate-fade-in-up">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              {testResult.message}
            </p>
          )}
          {testResult && !testResult.ok && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5 animate-fade-in-up break-words">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {testResult.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Predogled dnevnega povzetka ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-600" />
            Predogled dnevnega povzetka
          </CardTitle>
          <CardDescription>
            Kako bo izgledal menedžerski email za včerajšnji dan (isti HTML kot produkcija).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewLoading} className="btn-press">
              {previewLoading ? 'Nalagam...' : 'Naloži predogled'}
            </Button>
            {preview && (
              <Button variant="secondary" onClick={openHtmlPreview} className="btn-press">
                <FileText className="h-4 w-4 mr-1" />
                Odpri HTML predogled
              </Button>
            )}
          </div>

          {previewLoading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {preview && !previewLoading && (
            <div className="space-y-3 animate-fade-in-up">
              <p className="text-xs text-muted-foreground">Podatki za {preview.date}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Promet</p>
                  <p className="text-lg font-bold">{formatEUR(preview.revenue)}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Naročila</p>
                  <p className="text-lg font-bold">{preview.ordersCount}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Povp. račun</p>
                  <p className="text-lg font-bold">{formatEUR(preview.avgTicket)}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Ddanek (DDV)</p>
                  <p className="text-lg font-bold">{formatEUR(preview.tax)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={preview.furs.failed > 0 ? 'destructive' : 'default'}>
                  FURS: {preview.furs.sent} poslanih{preview.furs.failed > 0 ? `, ${preview.furs.failed} napak` : ', brez napak'}
                </Badge>
                <span>
                  Napitnine: {formatEUR(preview.tips)} · ddv konfiguracija v cenah ni vključena
                </span>
              </div>
              {preview.topItems.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Top artikli
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {preview.topItems.map((it, i) => (
                        <li key={`${it.name}-${i}`} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{i + 1}. {it.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {it.quantity}× · {formatEUR(it.revenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
