'use client'

// ============================================
// KARTICA REZERVACIJE
// ============================================
// RUNDA 46: detail-pass v dizajn jeziku R42–R45:
//  • barvna LEVA obroba per status (R43 TablesList vzorec — status na prvi pogled)
//  • časovni chip s tabular-nums + hex plosčica (stolpci ne poskakujejo)
//  • staggered animate-fade-in-up (40 ms, index-driven)
//  • akcijski gumbi s focus ringi; hover lift na kartici
// RUNDA 53:
//  • hitri premik časa ±30 min (razdeljen gumb pod časovnim chipom —
//    semantično vezan na čas; PUT dateTime, 409 konflikt → toast)
//  • partySize chip s pravo slovensko sklanjatvijo (dvojina: "2 osebi" —
//    prej trdo kodirano "2 oseb"; OSEBA_FORMS prek sl-plural)
//  • terminalna stanja (zaključena/preklicana/ni prišel) dušena
//    (opacity) — vizualna hijerarhija: aktivno naprej, mrtvo nazaj
// RUNDA 54:
//  • opomnik gostu: potrjena brez flaga → jantarni gumb "Pošlji opomnik"
//    v akcijski vrsti; s flagom → smaragdna značka "Opomnik poslan" v
//    metapodatkovni vrsti (bralcem zaslona: aria-label z gostom)
// RUNDA 55:
//  • drag-to-reschedule (samo timeline pogled, samo potrjene): celotna
//    kartica je HTML5 draggable (nativni ghost = celotna kartica); ročaj
//    GripVertical kot vizualna poka, dragging stanje = znižana opacity +
//    scale. Tipkovnica/terminalske kartice so izključene (±30 gumbi in
//    dialog ostajajo dostopna alternativa) — native DnD ni keyboard-
//    dostopen, kar dokumentiramo; a11y tok je ločen.
// RUNDA 57:
//  • značka opomnika pokaže tudi KDY: "Opomnik poslan ob 19:00"
//    (reminderSentAt, LJ cona prek reminderBadgeLabel); starejše vrstice
//    brez žiga padejo nazaj na suho "Opomnik poslan". tabular-nums, da
//    številke ne poskakujejo med renderi.
// ============================================

import { memo } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, Phone, Check, X, Edit, UserCheck, AlertCircle, UtensilsCrossed, Star, MessageSquare, ChevronsLeft, ChevronsRight, Bell, BellRing, GripVertical } from 'lucide-react'
import { statusLabels, statusColors, sourceLabels } from './constants'
import type { ReservationCardProps } from './constants'
import { slCount, OSEBA_FORMS } from '@/lib/sl-plural'
import { reminderBadgeLabel } from '@/lib/reservation-timeline'

/** Levo-obrobna barva per status (izrazitejša kot badge-only) */
const statusBorder: Record<string, string> = {
  confirmed: 'border-l-blue-500',
  seated: 'border-l-emerald-500',
  completed: 'border-l-gray-400',
  cancelled: 'border-l-red-500',
  no_show: 'border-l-amber-500',
}

/** Status pika ob imenu (barvna kontinuiteta leve obrobe) */
const statusDot: Record<string, string> = {
  confirmed: 'bg-blue-500',
  seated: 'bg-emerald-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
  no_show: 'bg-amber-500',
}

/** Terminalna stanja: ni več akcij, kartica se duši (vizualna hijerarhija) */
const isTerminalStatus = (status: string) =>
  status === 'completed' || status === 'cancelled' || status === 'no_show'

export const ReservationCard = memo(function ReservationCard({
  reservation,
  onEdit,
  onStatusChange,
  onTimeShift,
  onSendReminder,
  dragEnabled = false,
  isDragging = false,
  onDragStarted,
  onDragEnded,
  index = 0,
}: ReservationCardProps & { index?: number }) {
  const r = reservation
  const time = format(new Date(r.dateTime), 'HH:mm')
  const endTime = format(new Date(new Date(r.dateTime).getTime() + r.duration * 60000), 'HH:mm')
  const terminal = isTerminalStatus(r.status)
  // RUNDA 57: "Opomnik poslan ob HH:MM" (ali suho "Opomnik poslan")
  const reminderBadge = r.status === 'confirmed' ? reminderBadgeLabel(r.reminderSent, r.reminderSentAt) : null

  const nextActions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
    confirmed: [
      { status: 'seated', label: 'Posedljeno', icon: <UserCheck className="h-3.5 w-3.5" /> },
      { status: 'no_show', label: 'Ni prišel', icon: <AlertCircle className="h-3.5 w-3.5" /> },
      { status: 'cancelled', label: 'Prekliči', icon: <X className="h-3.5 w-3.5" /> },
    ],
    seated: [
      { status: 'completed', label: 'Zaključi', icon: <Check className="h-3.5 w-3.5" /> },
    ],
  }

  return (
    <Card
      className={`border border-l-4 ${statusBorder[r.status] ?? 'border-l-border'} card-lift transition-all duration-200 hover:shadow-md animate-fade-in-up ${
        terminal ? 'opacity-75 saturate-[.85] hover:opacity-100' : ''
      } ${isDragging ? 'opacity-40 scale-[.98] ring-2 ring-blue-500/30' : ''}`}
      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
      draggable={dragEnabled}
      onDragStart={(e) => {
        if (!dragEnabled) return
        // FF zahteva setData, sicer drag ne starta; format 'id|HH:MM'
        e.dataTransfer.setData('text/plain', `${r.id}|${time}`)
        e.dataTransfer.effectAllowed = 'move'
        onDragStarted?.(r.id, time)
      }}
      onDragEnd={() => onDragEnded?.()}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Levi stolpec: časovni chip + (ob potrjeni) hitri premik ±30 min */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="text-center min-w-14 rounded-md bg-muted/70 px-1.5 py-1">
                <p className="text-lg font-bold leading-none tabular-nums">{time}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">do {endTime}</p>
              </div>
              {r.status === 'confirmed' && onTimeShift && (
                <div
                  role="group"
                  aria-label="Hitri premik časa"
                  className="flex items-center rounded-md border border-border/70 overflow-hidden bg-background/60"
                >
                  <button
                    type="button"
                    onClick={() => onTimeShift(r.id, -30)}
                    title={`Premakni 30 min prej (iz ${time})`}
                    aria-label={`Premakni 30 min prej (iz ${time})`}
                    className="inline-flex h-6 w-9 items-center justify-center gap-px text-[10px] font-semibold text-muted-foreground hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors touch-manipulation"
                  >
                    <ChevronsLeft className="h-3 w-3" aria-hidden="true" />
                    <span className="tabular-nums">30</span>
                  </button>
                  <span className="w-px self-stretch bg-border/70" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => onTimeShift(r.id, 30)}
                    title={`Premakni 30 min kasneje (iz ${time})`}
                    aria-label={`Premakni 30 min kasneje (iz ${time})`}
                    className="inline-flex h-6 w-9 items-center justify-center gap-px text-[10px] font-semibold text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors touch-manipulation"
                  >
                    <span className="tabular-nums">30</span>
                    <ChevronsRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* Podatki */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[r.status] ?? 'bg-muted-foreground'}`} aria-hidden="true" />
                <span className="font-semibold text-sm truncate">{r.customerName}</span>
                <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${statusColors[r.status]}`}>
                  {statusLabels[r.status]}
                </Badge>
                {r.source !== 'walk_in' && (
                  <Badge variant="secondary" className="text-[9px] h-5 px-1.5">
                    {sourceLabels[r.source] || r.source}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {/* RUNDA 53: prava sklanjatev — 1 oseba · 2 osebi · 3 osebe · 5 oseb (prej trdo "oseb") */}
                <span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 tabular-nums"><Users className="h-3 w-3" />{slCount(r.partySize, OSEBA_FORMS)}</span>
                {r.table && (
                  <span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 tabular-nums"><UtensilsCrossed className="h-3 w-3" />Miza {r.table.number}</span>
                )}
                {r.customerPhone && (
                  <span className="flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{r.customerPhone}</span>
                )}
                {r.duration !== 120 && (
                  <span className="flex items-center gap-1 tabular-nums"><Clock className="h-3 w-3" />{r.duration} min</span>
                )}
              </div>

              {r.specialRequests && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.specialRequests}</span>
                </div>
              )}
              {r.notes && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.notes}</span>
                </div>
              )}
              {/* RUNDA 54/57: opomnik poslan — smaragdna značka z časovnim
                  žigom ("poslan ob 19:00") v metapodatkovni vrsti */}
              {reminderBadge && (
                <Badge
                  variant="outline"
                  className="mt-1.5 text-[10px] h-5 px-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 animate-fade-in-up tabular-nums"
                  aria-label={`Opomnik za ${r.customerName} je poslan`}
                  title={reminderBadge}
                >
                  <BellRing className="h-3 w-3" aria-hidden="true" />
                  {reminderBadge}
                </Badge>
              )}
            </div>
          </div>

          {/* Akcije */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* RUNDA 55: drag poka — samo timeline pogled + potrjene */}
            {dragEnabled && (
              <span
                aria-hidden="true"
                title="Povleci na drug časovni slot"
                className="inline-flex h-7 w-5 items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            )}
            {nextActions[r.status]?.map(action => (
              <Button
                key={action.status}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onStatusChange(r.id, action.status)}
              >
                {action.icon} {action.label}
              </Button>
            ))}
            {/* RUNDA 54: opomnik gostu — samo potrjene, še brez flaga */}
            {r.status === 'confirmed' && !r.reminderSent && onSendReminder && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-ring"
                title={`Opomni ${r.customerName} na rezervacijo ob ${time}`}
                aria-label={`Pošlji opomnik za ${r.customerName} ob ${time}`}
                onClick={() => onSendReminder(r.id)}
              >
                <Bell className="h-3.5 w-3.5" /> Opomnik
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7 focus-visible:ring-2 focus-visible:ring-ring" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
