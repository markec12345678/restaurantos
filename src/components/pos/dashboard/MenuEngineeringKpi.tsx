'use client'

// ============================================
// MENU ENGINEERING KPI (Nadzorna plošča)
// QA 2026-09-17, runda 3 — nova funkcionalnost:
// kompakten menedžerski pregled kvadrantov (Zvezda/Uganka/
// Delavski konj/Pes) + TOP zvezde po prihodku + akcijski
// nasveti. Deli react-query cache s polnim modulom
// (isti queryKey: queryKeys.menuEngineering.all).
// ============================================

import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { authFetch } from '../PinLogin'
import { usePOSStore } from '@/lib/store'
import { formatEUR, safeToFixed } from '@/lib/safe-format'
import { analyzeEngineeringData } from '../menu-engineering/analysis'
import {
  QUADRANT_COLORS,
  QUADRANT_LABELS,
  QUADRANT_ICONS,
  QUADRANT_DESCRIPTIONS,
  type QuadrantKey,
} from '../menu-engineering/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight, Lightbulb, UtensilsCrossed } from 'lucide-react'

const QUADRANT_ORDER: QuadrantKey[] = ['star', 'puzzle', 'plowhorse', 'dog']

export const MenuEngineeringKpi = memo(function MenuEngineeringKpi() {
  const setActiveModule = usePOSStore((s) => s.setActiveModule)

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.menuEngineering.all,
    queryFn: async () => {
      const res = await authFetch('/api/reports/popular')
      if (!res.ok) throw new Error(`Popular API ${res.status}`)
      const popular = await res.json()

      const foodCostMap: Record<string, number> = {}
      try {
        const fcRes = await authFetch('/api/food-cost')
        if (fcRes.ok) {
          const fcData = await fcRes.json()
          if (Array.isArray(fcData)) {
            fcData.forEach((item: Record<string, unknown>) => {
              foodCostMap[(item.menuItemId || item.id) as string] = (item.foodCost || item.costPerServing || 0) as number
            })
          }
        }
      } catch {
        // food-cost je opcijski — nadaljuj s 30 % približkom
      }

      return analyzeEngineeringData(popular, foodCostMap)
    },
    staleTime: 60 * 1000,
  })

  // TOP 3 zvezde po prihodku (za mini lestvico)
  const topStars = useMemo(
    () => (data?.items ?? []).filter((i) => i.quadrant === 'star').sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    [data],
  )

  const maxStarRevenue = useMemo(() => Math.max(...topStars.map((s) => s.revenue), 1), [topStars])

  // Akcijski nasveti (max 2, najbolj relevantna)
  const insights = useMemo(() => {
    if (!data || data.totalItems === 0) return []
    const out: string[] = []
    if (data.dogs > 0) out.push(`${data.dogs} artiklov v rdeči coni — premisli o posodobitvi menija`)
    if (data.plowhorses > 0) out.push(`${data.plowhorses} priljubljenih z nizko maržo — rahla korekcija cene`)
    if (data.puzzles > 0) out.push(`${data.puzzles} dobičkonosnih spregledanih — izpostavi jih na meniju`)
    if (data.stars > 0 && out.length < 2) out.push(`${data.stars} zvezdnih artiklov — promoviraj jih v akcijah`)
    return out.slice(0, 2)
  }, [data])

  if (isLoading) {
    return (
      <section aria-labelledby="me-kpi-heading" className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </section>
    )
  }

  if (isError || !data || data.totalItems === 0) {
    return (
      <section aria-labelledby="me-kpi-heading" className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Meni analiza ni na voljo{isError ? ' (napaka pri nalaganju)' : ' (ni podatkov o prodaji)'}.
          {!isError && ' Podatki se bodo prikazali po prvih prodanih artiklih.'}
          {isError && (
            <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={() => refetch()}>
              {isRefetching ? 'Osveževanje…' : 'Poskusi znova'}
            </Button>
          )}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="me-kpi-heading" className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 id="me-kpi-heading" className="text-lg font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" aria-hidden="true" />
            Menu Engineering — kvadranti menija
          </h3>
          <p className="text-sm text-muted-foreground">
            {data.totalItems} artiklov · mediani: {data.medianPopularity} kosov / {safeToFixed(data.medianProfitability, 0)} % marže
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setActiveModule('menu-engineering')}
        >
          Polna analiza <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Kvadrant KPI kartice */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUADRANT_ORDER.map((q) => {
          const count = q === 'star' ? data.stars : q === 'puzzle' ? data.puzzles : q === 'plowhorse' ? data.plowhorses : data.dogs
          const Icon = QUADRANT_ICONS[q]
          const share = data.totalItems > 0 ? Math.round((count / data.totalItems) * 100) : 0
          return (
            <div
              key={q}
              className="relative rounded-xl border bg-card p-4 overflow-hidden group hover:shadow-md transition-shadow"
              aria-label={`${QUADRANT_LABELS[q]}: ${count} artiklov. ${QUADRANT_DESCRIPTIONS[q]}`}
              title={QUADRANT_DESCRIPTIONS[q]}
            >
              {/* Barvna črta na vrhu kartice */}
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: QUADRANT_COLORS[q] }} aria-hidden="true" />
              <div className="flex items-start justify-between">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `${QUADRANT_COLORS[q]}1a`, color: QUADRANT_COLORS[q] }}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {share} %
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{count}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                {QUADRANT_LABELS[q]}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* TOP zvezde po prihodku */}
        {topStars.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <QUADRANT_ICONS.star className="h-4 w-4" style={{ color: QUADRANT_COLORS.star }} aria-hidden="true" />
              Top zvezde po prihodku
            </p>
            <ul className="space-y-2.5">
              {topStars.map((s) => (
                <li key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium truncate" title={s.name}>{s.name}</span>
                    <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatEUR(s.revenue)} · {s.quantitySold}×
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full bg-muted overflow-hidden"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(8, (s.revenue / maxStarRevenue) * 100)}%`, background: QUADRANT_COLORS.star }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Akcijski nasveti */}
        {insights.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Priporočila za meni
            </p>
            <ul className="space-y-2">
              {insights.map((insight) => (
                <li key={insight} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {insight}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground/80 italic">
              {QUADRANT_DESCRIPTIONS.dog}
            </p>
          </div>
        )}
      </div>
    </section>
  )
})
