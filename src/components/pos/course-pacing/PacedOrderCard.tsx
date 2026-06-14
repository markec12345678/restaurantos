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
            {format(new Date(order.createdAt), 'HH:mm')}
          </span>
          <Badge variant="outline" className="text-[9px]">
            {order.courses.filter(c => c.status === 'served').length}/{order.courses.length} jedi
          </Badge>
        </div>
      </div>

      {/* Course progress bar */}
      <div className="flex h-2">
        {order.courses.map((course, idx) => (
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
        {order.courses.map((course, courseIdx) => {
          const isCurrentCourse = courseIdx === order.currentCourseIndex
          const canFire = course.status === 'waiting' && (
            courseIdx === 0 || order.courses[courseIdx - 1]?.status === 'served' || order.courses[courseIdx - 1]?.status === 'ready'
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
