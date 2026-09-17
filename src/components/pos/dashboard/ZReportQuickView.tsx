'use client'

// ═══════════════════════════════════════════════════════════════
// Z-REPORT QUICK VIEW — dnevni zaključek na en pogled (QA runda 8)
// ═══════════════════════════════════════════════════════════════
// Namembnost: menedžer na prvi plošči vidi status dnevnega zaključka:
//   • ali je Z-poročilo za danes že ustvarjeno / zaključeno
//   • žive številke dneva (prodaja, DDV, naročila, povprečje)
//   • razčlenitev plačil (gotovina / kartica / mobitel) iz osnutka
//   • CTA v polni modul (Blagajna → Dnevni zaključek)
//
// Varnost: GET /api/z-report zahteva 'manage_cash' — za vloge brez
// dovoljenja (natakar) se kartica TIHO SKRIJE (403 → null), ker je
// to finančni pregled. Žive številke so fallback iz dashboard API,
// ko osnutek za danes še ne obstaja.
//
// ŽIVOST (runda 11): osnutek se na strežniku posodobi ob vsakem plačilu
// (refreshZDraftForPayment), tukaj pa ga držimo živega z:
//   • refetchInterval 30 s (plačila z DRUGIH naprav — npr. natakrjeva
//     tablica — se pojavijo najkasneje čez 30 s, brez ročnega refresha)
//   • invalidacijo queryKeys.zReport.all neposredno po plačilu/stornu/
//     void-item na ISTI napravi (useProcessPayment, useStornoMutations,
//     useVoidMutation) — takojšnja posodobitev brez čakanja intervala.
//
// Časovni pas: primerjava "danes" poteka v Europe/Ljubljana (enako
// kot strežniški ljubljanaDayBounds) — ne v strežniškem/brskalnem TZ.
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Banknote, CreditCard, Smartphone, ArrowRight, CircleDollarSign } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { formatEUR } from '@/lib/safe-format'
import { usePOSStore } from '@/lib/store'

interface TodayZReport {
  id: string
  reportDate: string
  status: string
  updatedAt?: string
  finalizedAt?: string | null
  totalSales: number
  totalNetSales: number
  totalTax: number
  cashSales: number
  cardSales: number
  mobileSales: number
  totalOrders: number
  avgOrderValue: number
}

interface ZReportQuickViewProps {
  /** Živi današnji prihodek iz /api/dashboard (fallback, če osnutek še ne obstaja) */
  todayRevenue: number
  /** Živa številka naročil iz /api/dashboard */
  totalOrders: number
  /** Živ povprečni račun iz /api/dashboard */
  avgOrderValue: number
}

/** Danes v Europe/Ljubljana kot 'YYYY-MM-DD' */
function ljubljanaToday(): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** ISO datetime → 'YYYY-MM-DD' v Ljubljani (sv-SE locale da ISO-like zapis) */
function ljubljanaDateKey(iso: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

/** ISO → 'HH:MM' v Ljubljani */
function ljubljanaTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

export const ZReportQuickView = memo(function ZReportQuickView({
  todayRevenue,
  totalOrders,
  avgOrderValue,
}: ZReportQuickViewProps) {
  const setActiveModule = usePOSStore((s) => s.setActiveModule)

  const { data: reports, isError, isLoading } = useQuery({
    queryKey: queryKeys.zReport.all,
    queryFn: async () => {
      const res = await authFetch('/api/z-report')
      // 403 = vloga brez manage_cash — kartica se skrije (ni napaka UX)
      if (res.status === 403) return null
      if (!res.ok) throw new Error('Napaka pri nalaganju Z-poročil')
      return res.json() as Promise<TodayZReport[]>
    },
    staleTime: 30_000,
    retry: false,
    // Živi osnutek: poceni GET, osveži vsakih 30 s (samo ko je kartica
    // montirana in tab aktiven — TanStack Query pavzira v ozadju)
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  if (isLoading) return <Skeleton className="h-40" />
  // Skrito za vloge brez dovoljenja ali ob napaki (dashboard ima druge KPI-je)
  if (isError || reports === null) return null

  const todayKey = ljubljanaToday()
  const today = (Array.isArray(reports) ? reports : []).find(
    (r) => ljubljanaDateKey(r.reportDate) === todayKey,
  )

  // Številke: iz osnutka, sicer žive iz dashboard API-ja
  const sales = today ? Number(today.totalSales) : todayRevenue
  const tax = today ? Number(today.totalTax) : null
  const orders = today ? today.totalOrders : totalOrders
  const avg = today ? Number(today.avgOrderValue) : avgOrderValue

  // Razčlenitev plačil (samo kadar osnutek obstaja — vseeno kar je znano)
  const cash = today ? Number(today.cashSales) : 0
  const card = today ? Number(today.cardSales) : 0
  const mobile = today ? Number(today.mobileSales) : 0
  const paySum = cash + card + mobile
  const hasPaySplit = today && paySum > 0

  const isFinalized = today?.status === 'finalized' || today?.status === 'approved'
  const stamp = today?.updatedAt ? ljubljanaTime(today.updatedAt) : null

  return (
    <Card aria-label="Dnevni zaključek — hitri pregled">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold">Dnevni zaključek (Z-poročilo)</h3>
          </div>
          <div className="flex items-center gap-2">
            {today ? (
              isFinalized ? (
                <Badge className="bg-green-600 text-white" aria-live="polite">Zaključeno{stamp ? ` ob ${stamp}` : ''}</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500 text-amber-600" aria-live="polite">Osnutek{stamp ? ` · ${stamp}` : ''}</Badge>
              )
            ) : (
              <Badge variant="secondary" aria-live="polite">Še ni ustvarjeno</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 pointer-coarse:min-h-11"
              onClick={() => setActiveModule('z-report')}
              aria-label="Odpri polni dnevni zaključek"
            >
              Polni pregled <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" /> Prodaja z DDV
            </div>
            <div className="text-lg font-bold text-green-700">{formatEUR(sales)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">DDV</div>
            <div className="text-lg font-bold text-amber-600">{tax === null ? '—' : formatEUR(tax)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Naročila</div>
            <div className="text-lg font-bold">{orders}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Povprečno</div>
            <div className="text-lg font-bold">{formatEUR(avg)}</div>
          </div>
        </div>

        {hasPaySplit && (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Plačila</span>
              <div className="flex items-center gap-3" aria-label="Razčlenitev plačil">
                <span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5" aria-hidden="true" />{formatEUR(cash)}</span>
                <span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" aria-hidden="true" />{formatEUR(card)}</span>
                {mobile > 0 && <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" aria-hidden="true" />{formatEUR(mobile)}</span>}
              </div>
            </div>
            {/* Razdeljena vrstica — segmenti proporcionalni zneskom */}
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Gotovina ${formatEUR(cash)}, kartica ${formatEUR(card)}${mobile > 0 ? `, mobitel ${formatEUR(mobile)}` : ''}`}
            >
              <div className="bg-green-600" style={{ width: `${paySum > 0 ? (cash / paySum) * 100 : 0}%` }} />
              <div className="bg-sky-600" style={{ width: `${paySum > 0 ? (card / paySum) * 100 : 0}%` }} />
              {mobile > 0 && <div className="bg-purple-600" style={{ width: `${(mobile / paySum) * 100}%` }} />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
