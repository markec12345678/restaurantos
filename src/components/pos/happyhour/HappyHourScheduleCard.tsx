'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Trash2, Clock, Percent, Tag, CalendarRange } from 'lucide-react'
import { type HappyHourSchedule, DAY_LABELS } from './types'
import { formatEUR } from '@/lib/safe-format'

// ============================================
// KARTICA URNIKA HAPPY HOUR — R69 poliš
// ============================================
// Stilskа izboljšava (obvezna točka runde): jantarni akcentni trak, živi
// status "ZDAJ AKTIVEN" izračunan PER KARTICO (prej je bil skupni banner
// edini vir resnice — vse kartice so svetilele, kadar je bil katerikoli
// aktiven!), pika-badge Aktiven/Neaktiven, ikone na značkah, izpostavljeni
// dnevnik (danes z obročem), hover-reveal izbris (dotik: vedno viden) in
// aria-labeli z imenom urnika za bralnike zaslona.

interface HappyHourScheduleCardProps {
  schedule: HappyHourSchedule
  currentlyActive: boolean
  onToggleActive: (_id: string, _isActive: boolean) => void
  onDelete: (_id: string) => void
}

/** Ali je ta urnik TRENUTNO v svojem časovnem oknu (per-kartica živi status)? */
function isScheduleLiveNow(s: HappyHourSchedule): boolean {
  try {
    const now = new Date()
    const currentDay = now.getDay() === 0 ? 7 : now.getDay() // 1=pon, 7=ned
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const days: number[] = JSON.parse(s.daysOfWeek || '[]')
    if (!days.includes(currentDay)) return false
    if (currentTime < s.startTime || currentTime >= s.endTime) return false
    if (s.validFrom && now < new Date(s.validFrom)) return false
    if (s.validTo && now > new Date(s.validTo)) return false
    return true
  } catch {
    return false
  }
}

export const HappyHourScheduleCard = memo(function HappyHourScheduleCard({
  schedule,
  currentlyActive,
  onToggleActive,
  onDelete,
}: HappyHourScheduleCardProps) {
  const s = schedule
  const live = s.isActive && currentlyActive && isScheduleLiveNow(s)
  const today = new Date().getDay() === 0 ? 7 : new Date().getDay()

  let days: number[] = []
  try { days = JSON.parse(s.daysOfWeek || '[]') } catch { days = [] }
  const hasDiscount = s.discountType !== 'none'
  const hasValidityWindow = !!(s.validFrom || s.validTo)

  return (
    <Card
      className={`group relative overflow-hidden transition-colors ${
        live
          ? 'border-amber-300 shadow-amber-100 dark:border-amber-700 dark:shadow-amber-950/20'
          : !s.isActive ? 'opacity-60' : ''
      }`}
    >
      {/* Jantarni akcentni trak (vzorec CategoriesTab/MenusTab) */}
      <div
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${
          live
            ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500'
            : s.isActive
              ? 'bg-gradient-to-b from-amber-300 to-amber-400/40 dark:from-amber-600 dark:to-amber-700/40'
              : 'bg-muted-foreground/20'
        }`}
      />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold truncate">{s.name}</h3>
              {live ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  role="status"
                >
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  ZDAJ AKTIVEN
                </span>
              ) : (
                <Badge
                  variant="outline"
                  className={s.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'text-muted-foreground'}
                >
                  <span
                    aria-hidden
                    className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`}
                  />
                  {s.isActive ? 'Aktiven' : 'Neaktiven'}
                </Badge>
              )}
            </div>
            {s.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className="gap-1 font-mono text-xs">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden />
                {s.startTime} – {s.endTime}
              </Badge>
              {hasDiscount && (
                <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white dark:text-amber-950">
                  {s.discountType === 'percentage'
                    ? <><Percent className="h-3 w-3" aria-hidden />−{s.discountAmount}%</>
                    : <><Percent className="h-3 w-3" aria-hidden />−{formatEUR(s.discountAmount)}</>}
                </Badge>
              )}
              {s.priceGroup && (
                <Badge variant="secondary" className="gap-1 max-w-44">
                  <Tag className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{s.priceGroup.name}</span>
                </Badge>
              )}
              {hasValidityWindow && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <CalendarRange className="h-3 w-3" aria-hidden />
                  {s.validFrom ? new Date(s.validFrom).toLocaleDateString('sl-SI') : '…'}
                  {' – '}
                  {s.validTo ? new Date(s.validTo).toLocaleDateString('sl-SI') : '…'}
                </Badge>
              )}
            </div>

            {/* Dnevi: vključeni izpostavljeni, današnji z obročem */}
            {days.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5" aria-label={`Aktivni dnevi: ${days.map(d => DAY_LABELS[d] || d).join(', ')}`}>
                {days.map(d => (
                  <span
                    key={d}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      d === today
                        ? 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-800'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {DAY_LABELS[d] || d}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              checked={s.isActive}
              onCheckedChange={v => onToggleActive(s.id, v)}
              aria-label={`Preklopi urnik ${s.name}`}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Izbriši urnik ${s.name}`}
              className="h-7 w-7 text-destructive transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onDelete(s.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
