'use client'

import { memo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, MessageSquare, Truck, FileText, Webhook, Eye, EyeOff } from 'lucide-react'

// ============================================
// INTEGRACIJE ZAVIHEK — Zunanje integracije
// ============================================
// Stranka lahko nastavi:
//   - Stripe (kartična plačila)
//   - Twilio (SMS obveščanje)
//   - Glovo (dostava)
//   - Wolt (dostava)
//   - e-Računi (računovodstvo)
//   - Webhooks (outbound event delivery)
// ============================================

interface IntegrationsTabProps {
  form: Record<string, unknown>
  updateField: (_field: string, _value: unknown) => void
}

export const IntegrationsTab = memo(function IntegrationsTab({ form, updateField }: IntegrationsTabProps) {
  const [showStripeSecret, setShowStripeSecret] = useState(false)
  const [showTwilioToken, setShowTwilioToken] = useState(false)

  const stripePk = (form.stripePublishableKey as string) || ''
  const stripeSk = (form.stripeSecretKey as string) || ''
  const twilioSid = (form.twilioAccountSid as string) || ''
  const twilioToken = (form.twilioAuthToken as string) || ''
  const twilioPhone = (form.twilioPhoneNumber as string) || ''
  const glovoSecret = (form.glovoWebhookSecret as string) || ''
  const woltSecret = (form.woltWebhookSecret as string) || ''

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── Stripe ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-500" />
            Stripe plačila
          </CardTitle>
          <CardDescription>
            Kartična plačila preko Stripe. Test ključi so na{' '}
            <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Stripe Dashboard
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="stripePk">Publishable key (pk_...)</Label>
            <Input
              id="stripePk"
              type="text"
              value={stripePk}
              onChange={e => updateField('stripePublishableKey', e.target.value)}
              placeholder="pk_test_..."
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripeSk">Secret key (sk_...)</Label>
            <div className="relative">
              <Input
                id="stripeSk"
                type={showStripeSecret ? 'text' : 'password'}
                value={stripeSk}
                onChange={e => updateField('stripeSecretKey', e.target.value)}
                placeholder="sk_test_..."
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => setShowStripeSecret(!showStripeSecret)}
              >
                {showStripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stripePk && stripeSk ? 'default' : 'secondary'}>
              {stripePk && stripeSk ? '✓ Konfigurirano' : 'Ni nastavljeno'}
            </Badge>
            {stripePk?.startsWith('pk_live_') && (
              <Badge variant="destructive">PRODUKCIJA</Badge>
            )}
            {stripePk?.startsWith('pk_test_') && (
              <Badge variant="outline">Test mode</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Twilio (SMS) ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            Twilio SMS
          </CardTitle>
          <CardDescription>
            SMS obveščanje gostov (rojstni dnevi, winback kampanje, loyalty točke).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="twilioSid">Account SID</Label>
              <Input
                id="twilioSid"
                type="text"
                value={twilioSid}
                onChange={e => updateField('twilioAccountSid', e.target.value)}
                placeholder="AC..."
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilioPhone">Telefonska številka</Label>
              <Input
                id="twilioPhone"
                type="text"
                value={twilioPhone}
                onChange={e => updateField('twilioPhoneNumber', e.target.value)}
                placeholder="+386..."
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilioToken">Auth Token</Label>
            <div className="relative">
              <Input
                id="twilioToken"
                type={showTwilioToken ? 'text' : 'password'}
                value={twilioToken}
                onChange={e => updateField('twilioAuthToken', e.target.value)}
                placeholder="••••••••"
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => setShowTwilioToken(!showTwilioToken)}
              >
                {showTwilioToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Badge variant={twilioSid && twilioToken ? 'default' : 'secondary'}>
            {twilioSid && twilioToken ? '✓ Konfigurirano' : 'Ni nastavljeno'}
          </Badge>
        </CardContent>
      </Card>

      {/* ─── Dostava: Glovo + Wolt ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-500" />
            Dostavne platforme
          </CardTitle>
          <CardDescription>
            Sprejemajte naročila iz Glovo in Wolt direktno v POS. Webhook skrivnost
            preveri pristnost dohodnih naročil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="glovoSecret">Glovo Webhook Secret</Label>
            <Input
              id="glovoSecret"
              type="password"
              value={glovoSecret}
              onChange={e => updateField('glovoWebhookSecret', e.target.value)}
              placeholder="••••••••"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Webhook URL: <code className="bg-muted px-1.5 py-0.5 rounded">/api/delivery/webhook/glovo</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="woltSecret">Wolt Webhook Secret</Label>
            <Input
              id="woltSecret"
              type="password"
              value={woltSecret}
              onChange={e => updateField('woltWebhookSecret', e.target.value)}
              placeholder="••••••••"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Webhook URL: <code className="bg-muted px-1.5 py-0.5 rounded">/api/delivery/webhook/wolt</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── e-Računi ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            e-Računi (računovodstvo)
          </CardTitle>
          <CardDescription>
            Samodejno pošiljanje računov v računovodski sistem e-Računi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="eracuniToken">API žeton (token)</Label>
            <Input
              id="eracuniToken"
              type="password"
              value={(form.eracuniApiToken as string) || ''}
              onChange={e => updateField('eracuniApiToken', e.target.value)}
              placeholder="••••••••"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eracuniUrl">API URL (opcijsko)</Label>
            <Input
              id="eracuniUrl"
              type="text"
              value={(form.eracuniApiUrl as string) || ''}
              onChange={e => updateField('eracuniApiUrl', e.target.value)}
              placeholder="https://www.eracuni.com/api/v1"
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Webhooks (outbound) ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-purple-500" />
            Outbound Webhooks
          </CardTitle>
          <CardDescription>
            Pošiljajte dogodke (novo naročilo, plačilo, storno) v zunanje sisteme.
            Upravljajte preko <code className="bg-muted px-1.5 py-0.5 rounded">/api/webhooks</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/webhooks', '_blank')}
            className="btn-press"
          >
            Upravljaj webhook-e
          </Button>
        </CardContent>
      </Card>
    </div>
  )
})
