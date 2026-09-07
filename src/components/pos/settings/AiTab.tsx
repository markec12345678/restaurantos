'use client'

import { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Bot, TrendingUp, MessageSquare, Key, CheckCircle2, XCircle } from 'lucide-react'

// ============================================
// AI ZAVIHEK — Nastavitve umetne inteligence
// ============================================
// Stranka lahko nastavi:
//   - Gemini API ključ (za AI napovedi in asistent)
//   - Vklop/izklop AI napovedi prodaje
//   - Vklop/izklop AI asistent (NL query)
//   - Vklop/izklop AI voice ordering
// ============================================

interface AiTabProps {
  form: Record<string, unknown>
  updateField: (_field: string, _value: unknown) => void
}

export const AiTab = memo(function AiTab({ form, updateField }: AiTabProps) {
  const geminiApiKey = (form.geminiApiKey as string) || ''
  const aiForecastEnabled = (form.aiForecastEnabled as boolean) ?? true
  const aiAssistantEnabled = (form.aiAssistantEnabled as boolean) ?? true
  const aiVoiceOrderEnabled = (form.aiVoiceOrderEnabled as boolean) ?? false
  const hasApiKey = !!geminiApiKey && geminiApiKey.length > 10

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── Gemini API ključ ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Gemini API ključ
          </CardTitle>
          <CardDescription>
            Pridobite brezplačni ključ na{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Google AI Studio
            </a>
            . Brez ključa so AI funkcije onemogočene.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="geminiApiKey">API ključ</Label>
            <div className="flex gap-2">
              <Input
                id="geminiApiKey"
                type="password"
                value={geminiApiKey}
                onChange={e => updateField('geminiApiKey', e.target.value)}
                placeholder="AIzaSy..."
                className="font-mono"
              />
              {hasApiKey ? (
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Aktiven
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" /> Manjka
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── AI Napovedi prodaje ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            AI napovedi prodaje
          </CardTitle>
          <CardDescription>
            Napoveduje dnevno prodajo glede na zgodovino, dan v tednu, vreme in dogodke.
            Priporoča optimalno zalogo in število zaposlenih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant={aiForecastEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiForecastEnabled', true)}
                className="btn-press"
              >
                Omogoči
              </Button>
              <Button
                variant={!aiForecastEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiForecastEnabled', false)}
                className="btn-press"
              >
                Onemogoči
              </Button>
            </div>
            <Badge variant={aiForecastEnabled ? 'default' : 'secondary'}>
              {aiForecastEnabled ? 'Omogočeno' : 'Onemogočeno'}
            </Badge>
          </div>
          {!hasApiKey && aiForecastEnabled && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Za delovanje je potreben Gemini API ključ.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── AI Asistent ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            AI asistent (NL query)
          </CardTitle>
          <CardDescription>
            Naravno jezikovni vmesnik — postavljajte vprašanja o poslovanju.
            Primer: &ldquo;Koliko smo prodali pice včeraj?&rdquo; ali &ldquo;Kateri artikel prinaša največ prihodka?&rdquo;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant={aiAssistantEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiAssistantEnabled', true)}
                className="btn-press"
              >
                Omogoči
              </Button>
              <Button
                variant={!aiAssistantEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiAssistantEnabled', false)}
                className="btn-press"
              >
                Onemogoči
              </Button>
            </div>
            <Badge variant={aiAssistantEnabled ? 'default' : 'secondary'}>
              {aiAssistantEnabled ? 'Omogočeno' : 'Onemogočeno'}
            </Badge>
          </div>
          {!hasApiKey && aiAssistantEnabled && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Za delovanje je potreben Gemini API ključ.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── AI Glasovno naročanje ─── */}
      <Card className="card-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            AI glasovno naročanje (beta)
          </CardTitle>
          <CardDescription>
            Gost lahko naroči z govorom preko mikrofona. AI pretvori govor v naročilo.
            Primer: &ldquo;Vzel bi eno pico Margherita in Coca-Colo.&rdquo;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant={aiVoiceOrderEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiVoiceOrderEnabled', true)}
                className="btn-press"
              >
                Omogoči
              </Button>
              <Button
                variant={!aiVoiceOrderEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateField('aiVoiceOrderEnabled', false)}
                className="btn-press"
              >
                Onemogoči
              </Button>
            </div>
            <Badge variant={aiVoiceOrderEnabled ? 'default' : 'secondary'}>
              {aiVoiceOrderEnabled ? 'Omogočeno' : 'Onemogočeno'}
            </Badge>
          </div>
          {!hasApiKey && aiVoiceOrderEnabled && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Za delovanje je potreben Gemini API ključ.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Povzetek ─── */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>
              AI funkcije uporabljajo Google Gemini AI. Brezplačni tier vključuje 15 zahtevkov/minuto.
              Za večjo obremenitev nadgradite na plačljivi tier na Google AI Studio.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
