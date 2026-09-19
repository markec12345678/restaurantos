'use client'

import { useCallback, useEffect, useState, Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleDot,
  CreditCard,
  Gem,
  Gift,
  Loader2,
  Mail,
  Printer,
  Smartphone,
  Ticket,
} from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { formatEUR } from '@/lib/safe-format'
import { paymentMethodLabelSl } from '@/lib/payment-methods-sl' // R62: enoten vir (prej surov enum "cash" na tiskanem poročilu)
import { ljubljanaYesterdayStr } from '@/lib/timezone-sl' // R48: yesterday iz lib (prej lokalna kopija)

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
  // R65: polna dnevna primerjava (OPTIONAL — starejši odgovori brez teh polj
  // ostanejo veljavni; sekcija se potem graciozno ne upodobi)
  prevOrdersCount?: number
  ordersChangePct?: number | null
  prevTips?: number
  tipsChangePct?: number | null
  prevAvgTicket?: number
  avgTicketChangePct?: number | null
  paymentMethods: Array<{ method: string; count: number; amount: number }>
  topItems: Array<{ name: string; quantity: number; revenue: number }>
  furs: { sent: number; failed: number }
}

// R48: ljubljanaYesterdayStr zdaj živi v @/lib/timezone-sl (ENOTEN vir resnice —
// deli ga tudi EmailTab datumski izbirnik); lokalna kopija odstranjena.

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

// R65: kompakten delta čip za vrstice primerjave (brez "ni primerjave"
// besedila — to rešuje sekcija sama; undefined = se vrstica ne čipiči)
function DeltaChip({ pct }: { pct: number | null | undefined }) {
  if (pct === undefined) return null
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums print:bg-transparent ${
        up
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      }`}
      aria-label={`Sprememba ${up ? 'nazaj' : 'dol'} ${Math.abs(pct)} %`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

// R65: ena vrstica primerjave — label + DVOJNA CSS vrstica (danes teal /
// včeraj muted, proporcionalno na max obeh dni) + vrednosti + delta čip.
// Tiskalo-varno: barve so tinti ozadij (print-color-adjust: exact je že
// globalno nastavljen), širine so % — delujejo tudi na A4.
function CompareRow({
  label,
  today,
  yesterday,
  pct,
  formatter,
}: {
  label: string
  today: number
  yesterday: number
  pct: number | null | undefined
  formatter: (v: number) => string
}) {
  const max = Math.max(today, yesterday)
  const width = (v: number) => {
    if (v <= 0 || max <= 0) return '0%'
    return `${Math.max((v / max) * 100, 3)}%` // min 3 % da je očesno viden
  }
  return (
    <div
      className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-x-3 gap-y-1 border-b py-2.5 last:border-0 sm:grid-cols-[9rem_1fr_10rem] print:gap-y-0"
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">danes</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/50 print:bg-muted/30">
            <div
              className="h-full rounded-full bg-teal-600 dark:bg-teal-500"
              style={{ width: width(today) }}
              role="presentation"
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatter(today)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">včeraj</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/50 print:bg-muted/30">
            <div
              className="h-full rounded-full bg-slate-300 dark:bg-slate-600 print:bg-slate-300"
              style={{ width: width(yesterday) }}
              role="presentation"
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{formatter(yesterday)}</span>
        </div>
      </div>
      <div className="justify-self-end sm:justify-self-start">
        <DeltaChip pct={pct} />
      </div>
    </div>
  )
}

// R62: ikone metod — SAMO client (lib ostane čista/strežniško-varna)
const PAYMENT_METHOD_ICONS: Record<string, ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />, // R62: scannable UI; tisk ostane tipografsko čist (ikone imajo print varljivo barvo — muted ozadje)
  card: <CreditCard className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />,
  mobile: <Smartphone className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />,
  voucher: <Ticket className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
  loyalty: <Gem className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400" />,
  giftcard: <Gift className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />,
}

function DigestPrintInner() {
  const [date, setDate] = useState('')
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // R62: "Pošlji po e-pošti" — wire obstoječega POST /api/reports/digest-send (Task 22)
  // na tiskano stran (prek samo v Nastavitve → E-pošta). Idempotentnost na strani
  // API-ja (pending/failed logika) → gumb je varen za ponovne klikе.
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [sendMsg, setSendMsg] = useState<string | null>(null)
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

  // R62: zamenjava datuma → počisti rezultat pošiljanja (prikaz IN akcija
  // vedno istega datuma — varnostni vzorec EmailTab R51)
  useEffect(() => {
    setSendState('idle')
    setSendMsg(null)
  }, [date])

  async function handleSend() {
    if (!date || sendState === 'sending') return
    setSendState('sending')
    setSendMsg(null)
    try {
      const res = await authFetch('/api/reports/digest-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        skipped?: boolean
        reason?: string
        error?: string
        sent?: number
        failed?: number
      }
      if (res.status === 401) throw new Error('Nisi prijavljen — odpri POS in se prijavi (PIN), nato poskusi znova.')
      if (res.status === 429) throw new Error('Preveč zahtevkov — poskusi čez približno minuto.')
      if (!res.ok) throw new Error(json.error || `Napaka ${res.status}`)
      if (json.skipped) {
        setSendState('done')
        setSendMsg(json.reason || 'Povzetek je že bil poslan vsem prejemnikom.')
      } else {
        setSendState('done')
        setSendMsg(
          `Povzetek poslan — ${json.sent ?? 0} uspešno${json.failed ? `, ${json.failed} neuspešno` : ''}.`
        )
      }
    } catch (e) {
      setSendState('error')
      setSendMsg(e instanceof Error ? e.message : 'Pošiljanje ni uspelo — poskusi znova.')
    }
  }

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
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="btn-press"
              onClick={() => void handleSend()}
              disabled={!data || sendState === 'sending'}
            >
              {sendState === 'sending' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="h-4 w-4" aria-hidden="true" />
              )}
              Pošlji po e-pošti
            </Button>
            <Button size="sm" className="btn-press" onClick={() => window.print()} disabled={!data}>
              <Printer className="h-4 w-4" />
              Natisni / shrani PDF
            </Button>
          </div>
        </div>
        {/* R62: povratna informacija o pošiljanju — pod orodno vrstico, skrito pri tisku */}
        {sendMsg && (
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto flex max-w-3xl items-start gap-2 px-4 pb-3 text-sm print:hidden ${
              sendState === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {sendState === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{sendMsg}</span>
          </div>
        )}
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
                    {/* R65: delta naročil — samo ko je realna vrednost (null/undefined = brez baze, razloži sekcija primerjave) */}
                    {data.ordersChangePct != null && (
                      <div className="mt-1">
                        <ChangeBadge pct={data.ordersChangePct} />
                      </div>
                    )}
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

              {/* R65: Primerjava s prejšnjim dnem — polna (prej samo promet čip) */}
              {typeof data.prevOrdersCount === 'number' && (
                <section className="break-inside-avoid" aria-label="Primerjava s prejšnjim dnem">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Primerjava s prejšnjim dnem
                  </h2>
                  {data.prevOrdersCount > 0 ? (
                    <div className="rounded-lg border bg-muted/30 px-3 py-1 print:bg-white">
                      <CompareRow
                        label="Promet"
                        today={data.revenue}
                        yesterday={data.prevRevenue}
                        pct={data.revenueChangePct}
                        formatter={formatEUR}
                      />
                      <CompareRow
                        label="Naročila"
                        today={data.ordersCount}
                        yesterday={data.prevOrdersCount}
                        pct={data.ordersChangePct}
                        formatter={v => String(Math.round(v))}
                      />
                      <CompareRow
                        label="Povp. račun"
                        today={data.avgTicket}
                        yesterday={data.prevAvgTicket ?? 0}
                        pct={data.avgTicketChangePct}
                        formatter={formatEUR}
                      />
                      <CompareRow
                        label="Napitnine"
                        today={data.tips}
                        yesterday={data.prevTips ?? 0}
                        pct={data.tipsChangePct}
                        formatter={formatEUR}
                      />
                    </div>
                  ) : (
                    <p className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground print:bg-white">
                      Prejšnji dan ni imel prometa — dnevna primerjava ni na voljo.
                    </p>
                  )}
                </section>
              )}

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
                      data.paymentMethods.map((m, i) => (
                        <tr
                          key={m.method}
                          className={`border-b transition-colors last:border-0 hover:bg-muted/40 print:hover:bg-white ${
                            i % 2 === 1 ? 'bg-muted/20 print:bg-white' : ''
                          }`}
                        >
                          <td className="py-2 pr-3 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60 print:bg-muted/30"
                                aria-hidden="true"
                              >
                                {PAYMENT_METHOD_ICONS[m.method] ?? (
                                  <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                              {paymentMethodLabelSl(m.method)}
                            </span>
                          </td>
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
                        <tr
                          key={`${it.name}-${i}`}
                          className={`border-b transition-colors last:border-0 hover:bg-muted/40 print:hover:bg-white ${
                            i % 2 === 1 ? 'bg-muted/20 print:bg-white' : ''
                          }`}
                        >
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
                                i === 0
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-muted/60 text-muted-foreground print:bg-muted/30'
                              }`}
                            >
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-medium">{it.name}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{formatEUR(it.revenue)}</td>
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
