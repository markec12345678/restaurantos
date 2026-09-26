'use client'
// ============================================
// R141-c (epic #115 P2-28) — sekcije dnevnega pregleda (operativne):
// Rezervacije · Ekipa & izmene · Zaloge · Naročilnice
// Hardcoded sl oznake (kanon), badge-i iz literal lookup map (BUG-04),
// časi rezervacij prek ljubljanaDateTimeParts (R43 kanon — dateTime je UTC).
// ============================================

import { CalendarDays, Package, Star, Truck, Users } from 'lucide-react'
import { formatEUR, formatNumberSl } from '@/lib/safe-format'
import { slCount, GOST_FORMS } from '@/lib/sl-plural'
import { ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import {
  EXPIRY_SEVERITY_TEXT,
  LOW_STOCK_SEVERITY_BADGES,
  LOW_STOCK_SEVERITY_UNKNOWN,
  PO_STATUS_BADGES,
  PO_STATUS_UNKNOWN,
  RESERVATION_STATUS_BADGES,
  RESERVATION_STATUS_UNKNOWN,
  SHIFT_STATUS_BADGES,
  SHIFT_STATUS_UNKNOWN,
  SHIFT_TYPE_BADGES,
  SHIFT_TYPE_UNKNOWN,
  daysToExpirySeverity,
  formatDaysToExpiry,
  formatSlDateShort,
  roleLabel,
  summarizeCovers,
} from './constants'
import type {
  InventorySection,
  PurchasingSection,
  ReservationSection,
  StaffSection,
  UpcomingReservation,
} from './constants'
import { BadgeChip, DeepLinkButton, EmptyText, ScrollList, SectionCard } from './section-card'

/** Čas rezervacije → 'HH:mm' v Ljubljani (R43: dateTime je UTC!) */
function reservationTime(dateTime: string): string {
  return ljubljanaDateTimeParts(dateTime).time
}

/** Skromna črta z opombo / posebno željo (subtle, samo kadar obstaja) */
function NoteLine({ reservation }: { reservation: UpcomingReservation }) {
  const notes = reservation.notes?.trim() || ''
  const requests = reservation.specialRequests?.trim() || ''
  if (!notes && !requests) return null
  return (
    <p className="mt-0.5 text-xs italic text-muted-foreground">
      {notes}
      {notes && requests ? ' · ' : ''}
      {requests ? `Želje: ${requests}` : ''}
    </p>
  )
}

export function ReservationsSection({ section }: { section: ReservationSection | undefined }) {
  const upcoming = section?.upcoming ?? []
  const summary = summarizeCovers(section?.summary)

  return (
    <SectionCard icon={CalendarDays} title="Rezervacije" count={upcoming.length}>
      {/* povzetek (chips) — vrednosti iz strežniškega summary, 0 je legitimno */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="status" aria-label="Povzetek rezervacij">
        <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Gostov danes: {summary.expectedGuests}
        </span>
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Potrjene: {summary.reservationsToday}
        </span>
        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Na mizi: {summary.seated}
        </span>
        <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Odpovedane: {summary.cancelled}
        </span>
        {summary.noShow > 0 && (
          <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Niso prišli: {summary.noShow}
          </span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <EmptyText>Ni rezervacij za danes.</EmptyText>
      ) : (
        <ScrollList ariaLabel="Prihajajoče rezervacije">
          {upcoming.map((r) => {
            const statusCfg = RESERVATION_STATUS_BADGES[r.status] ?? RESERVATION_STATUS_UNKNOWN
            return (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium tabular-nums">{reservationTime(r.dateTime)}</span>
                    <span className="truncate font-medium">{r.customerName}</span>
                    {r.isVip && (
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="VIP gost" />
                    )}
                    {r.tableNumber && (
                      <span className="text-xs text-muted-foreground">Miza {r.tableNumber}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{slCount(r.partySize, GOST_FORMS)}</p>
                  <NoteLine reservation={r} />
                </div>
                <BadgeChip cfg={statusCfg} />
              </li>
            )
          })}
        </ScrollList>
      )}
    </SectionCard>
  )
}

export function TeamSection({ section }: { section: StaffSection | undefined }) {
  const shifts = section?.shifts ?? []
  const coverage = section?.coverage
  const pendingTimeOff = section?.pendingTimeOff ?? 0

  return (
    <SectionCard icon={Users} title="Ekipa & izmene" count={shifts.length}>
      <p className="mb-3 text-xs text-muted-foreground" role="status" aria-label="Pokritost izmen">
        Na izmeni: {coverage?.scheduled ?? 0} · Potrjeno: {coverage?.confirmed ?? 0}
      </p>

      {shifts.length === 0 ? (
        <EmptyText>Ni izmen za danes.</EmptyText>
      ) : (
        <ScrollList ariaLabel="Izmene danes">
          {shifts.map((s, i) => {
            const typeCfg = SHIFT_TYPE_BADGES[s.shiftType] ?? SHIFT_TYPE_UNKNOWN
            const statusCfg = SHIFT_STATUS_BADGES[s.status] ?? SHIFT_STATUS_UNKNOWN
            return (
              <li key={`${s.employeeName}-${s.startTime}-${i}`} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.employeeName}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {roleLabel(s.role)} · {s.startTime}–{s.endTime}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <BadgeChip cfg={typeCfg} />
                  <BadgeChip cfg={statusCfg} />
                </div>
              </li>
            )
          })}
        </ScrollList>
      )}

      {pendingTimeOff > 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Prošnje za dopust v postopku: {pendingTimeOff}
        </p>
      )}
    </SectionCard>
  )
}

export function InventorySection({ section }: { section: InventorySection | undefined }) {
  const lowStock = section?.lowStock ?? []
  const expiring = section?.expiring ?? []
  const expiredCount = section?.expiredCount ?? 0
  const lowStockCount = section?.lowStockCount ?? lowStock.length

  return (
    <SectionCard
      icon={Package}
      title="Zaloge"
      count={lowStockCount > 0 ? lowStockCount : undefined}
      action={<DeepLinkButton moduleId="reorder-center" label="Odpri center naročil" />}
    >
      {lowStock.length === 0 && expiring.length === 0 && expiredCount === 0 ? (
        <EmptyText>Zaloge so v redu — ni opozoril.</EmptyText>
      ) : (
        <div className="space-y-3">
          {lowStock.length > 0 && (
            <ScrollList ariaLabel="Artikli pod minimalno zalogo">
              {lowStock.map((item) => {
                const sevCfg = LOW_STOCK_SEVERITY_BADGES[item.status] ?? LOW_STOCK_SEVERITY_UNKNOWN
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatNumberSl(item.quantity)} / {formatNumberSl(item.minQuantity)} {item.unit}
                      </p>
                    </div>
                    <BadgeChip cfg={sevCfg} />
                  </li>
                )
              })}
            </ScrollList>
          )}

          {expiring.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Roki uporabnosti</p>
              <ScrollList ariaLabel="Serije z bližajočim se rokom">
                {expiring.map((b) => {
                  const sev = daysToExpirySeverity(b.daysToExpiry)
                  return (
                    <li key={`${b.lotNumber}-${b.itemName}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          Lot {b.lotNumber} · {formatNumberSl(b.quantityRemaining)} {b.unit}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs tabular-nums ${EXPIRY_SEVERITY_TEXT[sev]}`}>
                        {formatDaysToExpiry(b.daysToExpiry)}
                      </span>
                    </li>
                  )
                })}
              </ScrollList>
            </div>
          )}

          {expiredCount > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              Potečenih serij: {expiredCount}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

export function PurchasingSection({ section }: { section: PurchasingSection | undefined }) {
  const openPos = section?.openPos ?? []
  const arrivingToday = section?.arrivingToday ?? []

  return (
    <SectionCard icon={Truck} title="Naročilnice" count={(section?.openCount ?? openPos.length) || undefined}>
      {arrivingToday.length > 0 && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-100 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" role="status">
          Danes prihaja: {arrivingToday.map((p) => `${p.poNumber} (${p.supplierName})`).join(', ')}
        </p>
      )}

      {openPos.length === 0 ? (
        <EmptyText>Ni odprtih naročilnic.</EmptyText>
      ) : (
        <ScrollList ariaLabel="Odprte naročilnice">
          {openPos.map((po) => {
            const statusCfg = PO_STATUS_BADGES[po.status] ?? PO_STATUS_UNKNOWN
            return (
              <li key={po.poNumber} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {po.supplierName}
                    {po.expectedDate ? ` · pričakovano ${formatSlDateShort(po.expectedDate)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs font-medium tabular-nums">{formatEUR(po.totalAmount)}</span>
                  <BadgeChip cfg={statusCfg} />
                </div>
              </li>
            )
          })}
        </ScrollList>
      )}
    </SectionCard>
  )
}
