'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { Flame, Layers } from 'lucide-react'
import { CourseCard } from './CourseCard'
import { COURSE_STATUS_CONFIG } from './constants'
import type { PacedOrderCardProps } from './constants'

// ============================================
// KARTICA NAROČILA S TOKOVI — R134 realni podatki
// ============================================
// Header vsebuje ORDER-LEVEL požiganje (fire next / fire all prek
// POST /api/orders/[id]/courses/fire) — ne tekmuje s course-level
// akcijami na posameznih karticah tokov.
// ============================================

export const PacedOrderCard = memo(function PacedOrderCard({
  order,
  onFireNext,
  onFireAll,
  onCourseAction,
  busyCourseId,
  busyOrderFire,
}: PacedOrderCardProps) {
  // FIX RangeError: Invalid time value — order.createdAt je lahko undefined/null
  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return '—'
      return format(d, 'HH:mm')
    } catch {
      return '—'
    }
  }
  // FIX TypeError: order.courses je lahko undefined (defenzivni kontrakt)
  const courses = Array.isArray(order?.courses) ? order.courses : []
  const servedCount = courses.filter(c => c.status === 'served').length

  // Progress bar po realnih statusih
  const progressColor = (status: string | null): string => {
    switch (status) {
      case 'served': return 'bg-zinc-400'
      case 'ready': return 'bg-emerald-500'
      case 'fired': return 'bg-orange-500'
      case 'preparing': return 'bg-amber-500'
      case 'held': return 'bg-amber-400'
      case 'cancelled': return 'bg-red-400'
      default: return 'bg-zinc-200 dark:bg-zinc-700'
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Order header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-muted/50 border-b">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-bold text-lg">#{order.orderNumber}</span>
          {order.tableNumber !== null && order.tableNumber !== undefined && (
            <Badge variant="secondary" className="text-xs">
              Miza {order.tableNumber}
            </Badge>
          )}
          {order.customerName && (
            <span className="text-sm text-muted-foreground truncate max-w-[140px]" title={order.customerName}>{order.customerName}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(order.createdAt)}
          </span>
          <Badge variant="outline" className="text-[9px]">
            {servedCount}/{courses.length} tokov
          </Badge>
          {/* Order-level fire akcije */}
          <Button
            size="sm"
            disabled={busyOrderFire || !order.hasPending}
            className="h-7 text-[11px] bg-orange-600 hover:bg-orange-700 gap-1 pointer-coarse:h-9"
            onClick={() => onFireNext(order.id)}
            aria-label="Požgi naslednji tok"
            title="Požge tok z najmanjšo številko med čakajočimi (zadržani preskočeni)"
          >
            <Flame className="h-3 w-3" />
            Naslednji
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyOrderFire || !order.hasPending}
            className="h-7 text-[11px] border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:hover:bg-orange-950/40 gap-1 pointer-coarse:h-9"
            onClick={() => onFireAll(order.id)}
            aria-label="Požgi vse čakajoče tokove"
            title="Požge VSE čakajoče tokove (zadržani preskočeni)"
          >
            <Layers className="h-3 w-3" />
            Vse
          </Button>
        </div>
      </div>

      {/* Course progress bar */}
      <div className="flex h-2" role="img" aria-label={`Napredek tokov: ${servedCount} od ${courses.length} postreženih`}>
        {courses.map((course, idx) => (
          <div
            key={course.courseNumber === null ? 'none' : `cn-${course.courseNumber}`}
            className={`flex-1 transition-colors ${progressColor(course.status)} ${idx > 0 ? 'ml-0.5' : ''}`}
            aria-label={`${course.name}: ${COURSE_STATUS_CONFIG[course.status ?? '']?.label ?? 'neznano'}`}
          />
        ))}
      </div>

      {/* Course cards */}
      <CardContent className="p-3 space-y-2">
        {(() => {
          // "Trenutni" tok = najnižji pending courseNumber (kandidat za fire next)
          const pendingNumbers = courses
            .filter(c => c.status === 'pending' && c.courseNumber !== null)
            .map(c => c.courseNumber as number)
          const currentNumber = pendingNumbers.length > 0 ? Math.min(...pendingNumbers) : null
          return courses.map((course) => (
            <CourseCard
              key={course.courseNumber === null ? 'none' : `cn-${course.courseNumber}`}
              course={course}
              isCurrentCourse={course.courseNumber !== null && course.courseNumber === currentNumber}
              onAction={(action) => {
                if (course.courseId) onCourseAction(course.courseId, action)
              }}
              disabled={busyCourseId === course.courseId}
            />
          ))
        })()}
      </CardContent>
    </Card>
  )
})
