// ============================================
// Error fallback sub-component
// A11Y FIX (WCAG 1.4.3, 1.4.6): refaktoriran z uporabo shadcn design tokene
// (prej inline stili z hardcoded barvami — ne dark-mode aware).
// ============================================

import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorFallbackProps {
  error: Error | null
  retryCount: number
  maxRetries: number
  exhausted: boolean
  contextLabel: string
  onRetry: () => void
  onReset: () => void
}

export function ErrorFallback({
  error,
  retryCount,
  maxRetries,
  exhausted,
  contextLabel,
  onRetry,
  onReset,
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto my-10 max-w-xl"
    >
      <Card className="border-destructive/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10" aria-hidden="true">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-destructive">
            Napaka v {contextLabel}
          </CardTitle>
          <CardDescription>
            Prišlo je do nepričakovane napake. Poskusite znova ali ponastavite modul.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {retryCount > 1 && (
            <p className="text-center text-sm text-muted-foreground">
              Ponovni poskus {retryCount}/{maxRetries}
              {exhausted && ' — doseženih maksimalnih poskusov'}
            </p>
          )}

          {isDev && error && (
            <Alert variant="destructive">
              <AlertDescription>
                <pre className="overflow-auto max-h-32 text-xs whitespace-pre-wrap font-mono">
                  {error.message}
                </pre>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {!exhausted && (
              <Button onClick={onRetry} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Poskusi znova
              </Button>
            )}
            <Button onClick={onReset} variant={exhausted ? 'destructive' : 'secondary'}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Ponastavi modul
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
