'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Flame, CheckCircle2, Clock, PauseCircle, PlayCircle, Send } from 'lucide-react'
import { COURSE_STATUS_CONFIG, COURSE_ITEM_STATUS_MARK } from './constants'
import type { CourseCardProps, CourseAction } from './constants'

// ============================================
// KARTICA TOKA (posamezen Course) — R134 realni statusi
// ============================================
// Gumbi po statusu (kanon: pending → Fire + Hold; held → Fire + Unhold;
// fired → Ready; ready → Served). 'preparing' (legacy item-level vpisi) in
// zaprti statusi (served/cancelled) nimajo akcij. Explicitni fire na held je
// DOVOLJEN (natakar namerno požge) — gumb Fire ostane viden.
// ============================================

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  held: <PauseCircle className="h-4 w-4" />,
  fired: <Flame className="h-4 w-4 animate-pulse" />,
  preparing: <Flame className="h-4 w-4" />,
  ready: <CheckCircle2 className="h-4 w-4" />,
  served: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <Clock className="h-4 w-4" />,
}

const NEUTRAL = { color: 'text-muted-foreground', bg: '', label: '—' }

/** Gumbi glede na realni course status */
export function actionsForStatus(status: string | null): CourseAction[] {
  switch (status) {
    case 'pending': return ['fire', 'hold']
    case 'held': return ['fire', 'unhold']
    case 'fired': return ['ready']
    case 'ready': return ['served']
    default: return []
  }
}

export const CourseCard = memo(function CourseCard({
  course,
  isCurrentCourse,
  onAction,
  disabled,
}: CourseCardProps) {
  const config = (course.status && COURSE_STATUS_CONFIG[course.status]) || NEUTRAL
  // FIX: course.items je lahko undefined (defenzivni kontrakt)
  const courseItems = Array.isArray(course?.items) ? course.items : []
  const actions = actionsForStatus(course.status)
  const isHeld = course.status === 'held'

  return (
    <div
      className={`rounded-lg border-2 p-3 transition-all ${
        isCurrentCourse ? 'border-primary shadow-sm' : 'border-transparent'
      } ${config.bg} ${isHeld ? 'border-dashed' : ''}`}
    >
      {/* Course header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={config.color}>{STATUS_ICONS[course.status ?? '']}</span>
          <span className="font-semibold text-sm truncate">{course.name}</span>
          {course.courseNumber !== null && (
            <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">T{course.courseNumber}</Badge>
          )}
          <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">
            {courseItems.length} {courseItems.length === 1 ? 'artikel' : 'artiklov'}
          </Badge>
          {isHeld && (
            <Badge className="bg-amber-500 text-white text-[10px] h-5 flex-shrink-0">ZADRŽAN</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {/* Akcijski gumbi po statusu */}
          {actions.includes('fire') && (
            <Button
              size="sm"
              disabled={disabled || !course.courseId}
              className="h-8 text-xs bg-orange-600 hover:bg-orange-700 gap-1 pointer-coarse:h-10"
              onClick={() => onAction('fire')}
              aria-label={`Požgi tok ${course.name}`}
            >
              <Flame className="h-3.5 w-3.5" />
              Fire
            </Button>
          )}
          {actions.includes('hold') && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !course.courseId}
              className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40 gap-1 pointer-coarse:h-10"
              onClick={() => onAction('hold')}
              aria-label={`Zadrži tok ${course.name}`}
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Hold
            </Button>
          )}
          {actions.includes('unhold') && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !course.courseId}
              className="h-8 text-xs gap-1 pointer-coarse:h-10"
              onClick={() => onAction('unhold')}
              aria-label={`Sprosti tok ${course.name}`}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Unhold
            </Button>
          )}
          {actions.includes('ready') && (
            <Button
              size="sm"
              disabled={disabled || !course.courseId}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1 pointer-coarse:h-10"
              onClick={() => onAction('ready')}
              aria-label={`Označi tok ${course.name} kot pripravljen`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pripravljeno
            </Button>
          )}
          {actions.includes('served') && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || !course.courseId}
              className="h-8 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40 gap-1 pointer-coarse:h-10"
              onClick={() => onAction('served')}
              aria-label={`Označi tok ${course.name} kot postrežen`}
            >
              <Send className="h-3.5 w-3.5" />
              Postreženo
            </Button>
          )}
          {actions.length === 0 && !course.courseId && course.courseNumber !== null && (
            <span className="text-[10px] text-muted-foreground">Akcije niso možne (manjka courseId)</span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 ml-6">
        {courseItems.map(item => {
          // FIX: item.modifiers je lahko undefined
          const modifiers = Array.isArray(item?.modifiers) ? item.modifiers : []
          const mark = COURSE_ITEM_STATUS_MARK[item.status] ?? { text: 'text-zinc-500', mark: '○' }
          return (
            <div key={item.id} className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-bold">{item.quantity}x</span>
              <span className={`truncate min-w-0 ${item.status === 'served' ? 'line-through text-muted-foreground' : ''}`} title={item.name}>
                {item.name}
              </span>
              {modifiers.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {modifiers.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
              {item.notes && (
                <span className="text-[10px] text-amber-600 italic truncate">{item.notes}</span>
              )}
              <span className={`ml-auto text-[10px] flex-shrink-0 ${mark.text}`}>{mark.mark}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
