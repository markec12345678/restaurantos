'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { CourseCard } from './CourseCard'
import type { PacedOrderCardProps } from './constants'

// ============================================
// KARTICA NAROČILA S TEMPOM JEDI
// ============================================
export const PacedOrderCard = memo(function PacedOrderCard({
  order,
  onFireCourse,
  onReadyCourse,
}: PacedOrderCardProps) {
  // FIX RangeError: Invalid time value — order.createdAt je lahko undefined/null
  // Prej: format(new Date(order.createdAt), 'HH:mm') je crash-al.
  // Sedaj: varno formatiranje s preverbo veljavnosti datuma.
  const formatTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      // Preveri ali je datum veljaven (NaN check)
      if (isNaN(d.getTime())) return '—'
      return format(d, 'HH:mm')
    } catch {
      return '—'
    }
  }
  // FIX TypeError: t?.filter — order.courses je lahko undefined
  const courses = Array.isArray(order?.courses) ? order.courses : []
  return (
    <Card className="overflow-hidden">
      {/* Order header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">#{order.orderNumber}</span>
          {order.tableNumber && (
            <Badge variant="secondary" className="text-xs">
              Miza {order.tableNumber}
            </Badge>
          )}
          {order.customerName && (
            <span className="text-sm text-muted-foreground">{order.customerName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(order.createdAt)}
          </span>
          <Badge variant="outline" className="text-[9px]">
            {courses.filter(c => c.status === 'served').length}/{courses.length} jedi
          </Badge>
        </div>
      </div>

      {/* Course progress bar */}
      <div className="flex h-2">
        {courses.map((course, idx) => (
          <div
            key={course.id}
            className={`flex-1 transition-colors ${
              course.status === 'served' ? 'bg-gray-400' :
              course.status === 'ready' ? 'bg-emerald-500' :
              course.status === 'preparing' || course.status === 'firing' ? 'bg-orange-500' :
              'bg-gray-200 dark:bg-gray-700'
            } ${idx > 0 ? 'ml-0.5' : ''}`}
            aria-label={course.status === 'served' ? 'Postreženo' : course.status === 'ready' ? 'Pripravljeno' : course.status === 'preparing' || course.status === 'firing' ? 'V pripravi' : 'Čakajoče'}
          />
        ))}
      </div>

      {/* Course cards */}
      <CardContent className="p-3 space-y-2">
        {courses.map((course, courseIdx) => {
          const isCurrentCourse = courseIdx === order.currentCourseIndex
          const canFire = course.status === 'waiting' && (
            courseIdx === 0 || courses[courseIdx - 1]?.status === 'served' || courses[courseIdx - 1]?.status === 'ready'
          )
          const canMarkReady = course.status === 'firing' || course.status === 'preparing'

          return (
            <CourseCard
              key={course.id}
              course={course}
              isCurrentCourse={isCurrentCourse}
              canFire={canFire}
              canMarkReady={canMarkReady}
              onFire={() => onFireCourse(order.id, courseIdx)}
              onReady={() => onReadyCourse(order.id, courseIdx)}
            />
          )
        })}
      </CardContent>
    </Card>
  )
})
