'use client'

import { memo } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatEUR } from '@/lib/safe-format'
import { StatusBadge } from './StatusBadge'

// =====================================================================
// Skupna kartica dostave (R137-c) — sekciji "Za prevzem" (mode 'ready')
// in "Moje dostave" (mode 'mine'). Mobilni prvi: veliki touch cilji
// (primarni gumb min-h-12, vrstice min-h-11), en stolpec max-w-md.
// PII omejena na voznikovo delo: naslov/telefon/prejemnik (legitimno) —
// brez e-pošte in ostalih gostovih podatkov.
// =====================================================================

interface DeliveryCardProps {
  mode: 'ready' | 'mine'
  orderNumber: string
  address: string
  city: string
  postCode: string
  recipientName: string
  recipientPhone: string
  instructions: string
  /** Vsota check totalov (null = ni podatka → ne izpisuj) */
  total: number | null
  /** Gotovina ob prevzemu (neplačano naročilo) → badge */
  cash: boolean
  /** samo mode 'mine' — dostavni status (badge) */
  status?: string
  /** primarni gumb (Prevzem / naslednji status); brez → brez gumba */
  primaryLabel?: string
  /** primarni gumb v teku → disabled (idempotentni klik) */
  busy?: boolean
  onPrimary?: () => void
  /** samo mode 'mine' — sekundarni gumb 'Težava' (failed dialog) */
  onTrouble?: () => void
}

/** Google Maps iskanje po naslovu (brez dependency — R137-a Q6) */
function mapsUrl(address: string, postCode: string, city: string): string {
  const query = [address, postCode, city].filter((part) => part !== '').join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export const DeliveryCard = memo(function DeliveryCard({
  mode,
  orderNumber,
  address,
  city,
  postCode,
  recipientName,
  recipientPhone,
  instructions,
  total,
  cash,
  status,
  primaryLabel,
  busy = false,
  onPrimary,
  onTrouble,
}: DeliveryCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Glava: #orderNumber + status badge (mine) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold">#{orderNumber}</span>
          {mode === 'mine' && status ? <StatusBadge status={status} /> : null}
        </div>

        {/* Naslov → Google Maps (nov zavihek) */}
        <a
          href={mapsUrl(address, postCode, city)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-start gap-2 rounded-lg p-1 text-sm font-medium underline-offset-2 hover:underline"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {address}
            {(postCode !== '' || city !== '') && (
              <span className="text-muted-foreground">, {postCode} {city}</span>
            )}
          </span>
        </a>

        {/* Telefon → tel: link */}
        {recipientPhone !== '' && (
          <a
            href={`tel:${recipientPhone}`}
            className="flex min-h-11 items-center gap-2 rounded-lg p-1 text-sm underline-offset-2 hover:underline"
          >
            <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{recipientName !== '' ? `${recipientName} · ${recipientPhone}` : recipientPhone}</span>
          </a>
        )}

        {/* Navodila (če obstajajo) */}
        {instructions !== '' && (
          <p className="rounded-lg bg-muted p-2.5 text-sm text-muted-foreground">{instructions}</p>
        )}

        {/* Znesek + gotovina ob prevzemu */}
        {(total !== null || cash) && (
          <div className="flex items-center justify-between gap-2">
            {total !== null ? (
              <span className="text-lg font-bold tabular-nums">{formatEUR(total)}</span>
            ) : (
              <span />
            )}
            {cash && (
              <Badge className="border-amber-300 bg-amber-100 text-amber-900">Gotovina ob prevzemu</Badge>
            )}
          </div>
        )}

        {/* Primarni gumb — velik touch cilj */}
        {primaryLabel && onPrimary && (
          <Button className="min-h-12 w-full text-base font-semibold" disabled={busy} onClick={onPrimary}>
            {busy ? 'Pošiljanje ...' : primaryLabel}
          </Button>
        )}

        {/* Sekundarni gumb Težava (samo moje dostave v teku) */}
        {mode === 'mine' && onTrouble && (
          <Button variant="outline" className="min-h-11 w-full" disabled={busy} onClick={onTrouble}>
            Težava
          </Button>
        )}
      </CardContent>
    </Card>
  )
})
