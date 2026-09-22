'use client'

import { memo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Copy, ExternalLink, Link2, QrCode, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// NAROČILNA POVEZAVA (R89) — izdajni UI za R88 ordering token
// GET  /api/locations/[id]/ordering-token        → { orderingUrl, tokenVersion, ... }
// POST /api/locations/[id]/ordering-token/rotate → nova povezava (stara takoj mrtva)
// GET  /api/locations/[id]/qr-menu               → PNG (auth, prenesi z download atributom)
// ============================================

interface OrderingTokenData {
  locationId: string
  token: string
  orderingUrl: string
  locationName: string
  isActive: boolean
  tokenVersion: number
}

// Napaka s HTTP statusom — omogoča ločevanje 404 (izven dosega) od 503 (manjka HMAC skrivnost)
class OrderingTokenError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'OrderingTokenError'
    this.status = status
  }
}

async function fetchOrderingToken(locationId: string, rotate = false): Promise<OrderingTokenData> {
  const url = rotate
    ? `/api/locations/${locationId}/ordering-token/rotate`
    : `/api/locations/${locationId}/ordering-token`
  const res = await authFetch(url, rotate ? { method: 'POST' } : undefined)
  if (!res.ok) {
    let message = 'Napaka pri izdaji naročilne povezave'
    try {
      const json = (await res.json()) as { error?: string }
      if (json?.error) message = json.error
    } catch {
      // odgovor ni JSON — ostane generično sporočilo
    }
    throw new OrderingTokenError(res.status, message)
  }
  return res.json()
}

// Lokalna query tipka (ni v query-keys factory — hierarhično pod ['locations'],
// zato jo invalidateQueries({ queryKey: queryKeys.locations.all }) pokrije)
const orderingTokenKey = (locationId: string) => ['locations', locationId, 'ordering-token'] as const

export const OrderingLinkSection = memo(function OrderingLinkSection({ locationId }: { locationId: string }) {
  const queryClient = useQueryClient()
  const [rotateOpen, setRotateOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: orderingTokenKey(locationId),
    queryFn: () => fetchOrderingToken(locationId),
    staleTime: 5 * 60_000,
    retry: (failureCount, err) =>
      err instanceof OrderingTokenError && (err.status === 404 || err.status === 401 || err.status === 503)
        ? false
        : failureCount < 2,
  })

  const rotateMutation = useMutation({
    mutationFn: () => fetchOrderingToken(locationId, true),
    onSuccess: () => {
      toast.success('Nova povezava izdana')
      setRotateOpen(false)
      queryClient.invalidateQueries({ queryKey: orderingTokenKey(locationId) })
    },
    onError: (err: unknown) => {
      setRotateOpen(false)
      toast.error(
        err instanceof OrderingTokenError && err.status === 503
          ? 'Izdaja povezav ni konfigurirana (manjka HMAC skrivnost).'
          : 'Rotacija povezave ni uspela.'
      )
    },
  })

  async function handleCopy() {
    if (!data?.orderingUrl) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.orderingUrl)
      } else {
        // Fallback za okolja brez Clipboard API (starejši brskalniki / ne-zabezpečeni konteksti)
        const textarea = document.createElement('textarea')
        textarea.value = data.orderingUrl
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Povezava kopirana')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Kopiranje ni uspelo — kopirajte povezavo ročno.')
    }
  }

  const errorStatus = error instanceof OrderingTokenError ? error.status : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Naročilna povezava
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Javna povezava za spletno naročanje na tej lokaciji. Deluje samo s tem tokenom (R88).
        </p>

        {isLoading ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-44" />
          </div>
        ) : isError ? (
          errorStatus === 404 ? (
            <p className="text-sm text-muted-foreground">Povezava ni na voljo za to lokacijo.</p>
          ) : errorStatus === 503 ? (
            <p className="text-sm text-muted-foreground">Izdaja povezav ni konfigurirana (manjka HMAC skrivnost).</p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-destructive">Napaka pri nalaganju naročilne povezave.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-11">
                Poskusi znova
              </Button>
            </div>
          )
        ) : data ? (
          <>
            {/* Povezava + kopiranje */}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <Input
                readOnly
                value={data.orderingUrl}
                onFocus={e => e.currentTarget.select()}
                aria-label="Naročilna povezava"
                className="font-mono text-xs"
              />
              <Button
                onClick={handleCopy}
                aria-label="Kopiraj naročilno povezavo"
                className="h-11 gap-2"
              >
                <Copy className="h-4 w-4" /> {copied ? 'Kopirano' : 'Kopiraj'}
              </Button>
            </div>

            {/* Rotacija — stara povezava preneha delovati takoj */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                različica {data.tokenVersion}
              </Badge>
              <Button
                variant="outline"
                onClick={() => setRotateOpen(true)}
                disabled={rotateMutation.isPending}
                aria-label="Rotiraj naročilno povezavo"
                className="h-11 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <RefreshCw className={cn('h-4 w-4', rotateMutation.isPending && 'animate-spin')} /> Rotiraj
              </Button>
            </div>

            {/* QR meni */}
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href={`/api/locations/${locationId}/qr-menu`}
                download
                title="Prenos zahteva prijavo"
                aria-label="Prenesi QR meni (PNG) — prenos zahteva prijavo"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-11 gap-2')}
              >
                <QrCode className="h-4 w-4" /> QR meni (PNG)
              </a>
              <a
                href={`/qr-menu?locationId=${locationId}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Odpri spletni meni v novem zavihku"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-11 gap-2')}
              >
                <ExternalLink className="h-4 w-4" /> Odpri meni
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Prenos QR menija (PNG) zahteva prijavo v upravljalski vmesnik — povezava deluje v istem brskalniku.
            </p>
          </>
        ) : null}
      </CardContent>

      {/* Potrditev rotacije */}
      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotiraj naročilno povezavo?</AlertDialogTitle>
            <AlertDialogDescription>
              Stara povezava preneha delovati takoj. Objavljeno povezavo je treba zamenjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotateMutation.isPending}>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => {
                e.preventDefault()
                rotateMutation.mutate()
              }}
            >
              {rotateMutation.isPending ? 'Izdajam ...' : 'Rotiraj'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
})
