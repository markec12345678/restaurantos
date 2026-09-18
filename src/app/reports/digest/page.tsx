'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, ArrowLeft, CheckCircle2, Printer } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { formatEUR } from '@/lib/safe-format'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'

// ============================================
// TISKANA VERZIJA DNEVNEGA POVZETKA (/reports/digest)
// ============================================
// Runda 42: digest obstaja kot email HTML + predogled v Email zavihku.
// Ta stran doda TRETJI izhod: optimizirana za tisk / "Shrani kot PDF"
// (window.print() → brskalnikova "Save as PDF" — brez PDF odvisnosti,
// deluje povsod, vključno z mobilnimi brskalniki).
//
// Podatki: /api/reports/digest-preview?date=YYYY-MM-DD (admin auth —
// authFetch iz sessionStorage; brez tokena → prijavi se prek POS-a).
//
// Tisk: @page A4 + print: Tailwind variante (toolbar skrit, kartice brez
// senc, print-color-adjust: exact da ostanejo akcenti tudi na papirju).
// ============================================

interface DigestData {
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

/** Včeraj po ljubljanskem času (digest semantika = server-local včeraj). */
function ljubljanaYesterdayStr(): string {
  const today = ljubljanaTodayStr()
  const [y, m, d] = today.split('-').map(Number)
  const yesterday = new Date(y, m - 1, d - 1)
  const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
  const dd = String(yesterday.getDate()).padStart(2, '0')
  return `${yesterday.getFullYear()}-${mm}-${dd}`
}

/** YYYY-MM-DD → "18. september 2026" (sl-SI, deterministično — ročno, brez Intl). */
const MESECI = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']
function formatDatumSl(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d}. ${MESECI[(m || 1) - 1]} ${y}`
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">(ni primerjave z prejšnjim dnem)</span>
  }
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold print:bg-transparent ${
        up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function DigestPrintInner() {
  const [date, setDate] = useState('')
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    // RUNDA 45: podpora ?date=YYYY-MM-DD (EOD modul linka DANAŠNJI dan;
    // brez parametra ostane privzeta digest semantika = včeraj po LJ)
    const q = searchParams.get('date')
    const initial = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ljubljanaYesterdayStr()
    setDate(initial)
  }, [searchParams])

  const load = useCallback(async (targetDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/reports/digest-preview?date=${encodeURIComponent(targetDate)}`)
      if (res.status === 401) {
        setError('Nisi prijavljen — odpri POS in se prijavi (PIN), nato vrni na to stran.')
        setData(null)
        return
      }
      if (!res.ok) throw new Error(`Napaka ${res.status}`)
      const json = (await res.json()) as { data: DigestData }
      setData(json.data)
    } catch {
      setError('Povzetek ni uspel — preveri povezavo ali poskusi drug datum.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (date) void load(date)
  }, [date, load])

  const generatedAt = new Date().toLocaleString('sl-SI', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background print:bg-white">
      {/* Global print pravila — @page + barve */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar — skrit pri tisku */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="btn-press">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Nazaj v POS
            </Link>
          </Button>
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Datum:
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-8 w-40 text-sm"
              aria-label="Datum povzetka"
            />
          </label>
          <Button size="sm" className="btn-press ml-auto" onClick={() => window.print()} disabled={!data}>
            <Printer className="h-4 w-4" />
            Natisni / shrani PDF
          </Button>
        </div>
      </div>

      {/* A4 list */}
      <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="rounded-xl border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {loading && (
            <div className="space-y-4" aria-label="Nalaganje povzetka">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center print:hidden">
              <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/">Odpri POS (prijava)</Link>
              </Button>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Glava */}
              <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight print:text-lg">Dnevni poslovni povzetek</h1>
                  <p className="text-sm text-muted-foreground">
                    RestaurantOS · {formatDatumSl(data.date)}
                  </p>
                </div>
                <p className="text-right text-[10px] text-muted-foreground print:mt-1">
                  Generirano {generatedAt}
                  <br />Dokument ni račun · informativna vrednost
                </p>
              </header>

              {/* KPI vrstica */}
              <section>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:gap-2">
                  <div className="rounded-lg border-t-2 border-t-teal-600 bg-muted/40 p-3 print:bg-white">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Skupni promet</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">{formatEUR(data.revenue)}</p>
                    <div className="mt-1"><ChangeBadge pct={data.revenueChangePct} /></div>
                  </div>
                  <div className="rounded-lg border-t-2 border-t-sky-600 bg-muted/40 p-3 print:bg-white">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Naročila</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">{data.ordersCount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">povp. račun {formatEUR(data.avgTicket)}</p>
                  </div>
                  <div className="rounded-lg border-t-2 border-t-amber-500 bg-muted/40 p-3 print:bg-white">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Napitnine</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatEUR(data.tips)}</p>
                  </div>
                  <div className="rounded-lg border-t-2 border-t-rose-500 bg-muted/40 p-3 print:bg-white">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">DDV</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{formatEUR(data.tax)}</p>
                  </div>
                </div>
              </section>

              {/* Metode plačila */}
              <section className="break-inside-avoid">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metode plačila</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Metoda</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Št. plačil</th>
                      <th className="py-1.5 text-right font-medium">Znesek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paymentMethods.length === 0 ? (
                      <tr><td colSpan={3} className="py-2 text-muted-foreground">Ni plačanih naročil za izbrani dan.</td></tr>
                    ) : (
                      data.paymentMethods.map((m) => (
                        <tr key={m.method} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{m.method}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{m.count}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{formatEUR(m.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              {/* Top artikli */}
              <section className="break-inside-avoid">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top 5 artiklov</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">#</th>
                      <th className="py-1.5 pr-3 font-medium">Artikel</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Količina</th>
                      <th className="py-1.5 text-right font-medium">Prihodek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topItems.length === 0 ? (
                      <tr><td colSpan={4} className="py-2 text-muted-foreground">Ni prodanih artiklov za izbrani dan.</td></tr>
                    ) : (
                      data.topItems.map((it, i) => (
                        <tr key={`${it.name}-${i}`} className="border-b last:border-0">
                          <td className="py-2 pr-3 tabular-nums text-muted-foreground">{i + 1}.</td>
                          <td className="py-2 pr-3 font-medium">{it.name}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{formatEUR(it.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              {/* FURS */}
              <section className="break-inside-avoid rounded-lg border bg-muted/40 p-3 print:bg-white">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">FURS fiskalizacija</h2>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span><strong className="tabular-nums">{data.furs.sent}</strong> uspešno overjenih računov</span>
                  {data.furs.failed > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      {data.furs.failed} neuspešnih — zahteva pregled!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      brez napak
                    </span>
                  )}
                </p>
              </section>

              {/* Noga */}
              <footer className="border-t pt-3 text-[10px] text-muted-foreground print:pt-2">
                Avtomatsko generirano iz RestaurantOS · podatki so informativni in niso fiskalni dokument · za Z-poročilo odpri POS → Blagajna → Z-Poročilo
              </footer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// RUNDA 45: useSearchParams zahteva Suspense mejo pri statičnem prerenderju
export default function DigestPrintPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/30 dark:bg-background" />}>
      <DigestPrintInner />
    </Suspense>
  )
}
