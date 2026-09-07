'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// SETUP PROGRESS — Pokaže kaj je nastavljeno, kaj manjka
// ============================================

interface CheckItem {
  label: string
  configured: boolean
  tab: string
  critical?: boolean
}

export function SetupProgress() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!settings) return null

  const checks: CheckItem[] = [
    {
      label: 'FURS certifikat',
      configured: !!(settings.hasFursCert || settings.fursEnvironment === 'test'),
      tab: 'furs',
      critical: true,
    },
    {
      label: 'AI (Gemini API ključ)',
      configured: !!settings.hasGeminiKey,
      tab: 'ai',
    },
    {
      label: 'Stripe plačila',
      configured: !!settings.hasStripe,
      tab: 'integrations',
    },
    {
      label: 'Twilio SMS',
      configured: !!settings.hasTwilio,
      tab: 'integrations',
    },
    {
      label: 'Glovo dostava',
      configured: !!settings.hasGlovo,
      tab: 'integrations',
    },
    {
      label: 'Wolt dostava',
      configured: !!settings.hasWolt,
      tab: 'integrations',
    },
    {
      label: 'e-Računi',
      configured: !!settings.hasEracuni,
      tab: 'integrations',
    },
    {
      label: 'Email SMTP',
      configured: !!settings.hasEmailConfig,
      tab: 'email',
      critical: true,
    },
  ]

  const configuredCount = checks.filter(c => c.configured).length
  const totalCount = checks.length
  const progressPercent = Math.round((configuredCount / totalCount) * 100)
  const criticalMissing = checks.filter(c => !c.configured && c.critical)

  return (
    <Card className="card-lift animate-fade-in-up">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {progressPercent === 100 ? '✅' : '⚙️'} Setup napredek
          </span>
          <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
            {configuredCount}/{totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2.5" />
          <p className="text-xs text-muted-foreground text-right">
            {progressPercent}% konfigurirano
          </p>
        </div>

        {/* Critical warning */}
        {criticalMissing.length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 animate-fade-in-up">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Kritične nastavitve manjkajo:
              </span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {criticalMissing.map(c => (
                <li key={c.label} className="text-xs text-amber-600 dark:text-amber-500 ml-6">
                  • {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Checklist */}
        <div className="grid grid-cols-2 gap-2">
          {checks.map(check => (
            <div
              key={check.label}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-sm transition-colors',
                check.configured
                  ? 'bg-emerald-50 dark:bg-emerald-950/20'
                  : 'bg-muted/30'
              )}
            >
              {check.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : check.critical ? (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn(
                'truncate',
                check.configured
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-muted-foreground'
              )}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        {/* All configured */}
        {progressPercent === 100 && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 animate-fade-in-up">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Vse nastavitve so konfigurirane! 🎉
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
