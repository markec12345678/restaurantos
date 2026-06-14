'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Flame, CheckCircle2, Zap, Clock } from 'lucide-react'
import { STATUS_CONFIG } from './constants'
import type { CourseCardProps } from './constants'

// ─── Ikone za statuse ──────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  waiting: <Clock className="h-4 w-4" />,
  firing: <Flame className="h-4 w-4 animate-pulse" />,
  preparing: <Zap className="h-4 w-4" />,
  ready: <CheckCircle2 className="h-4 w-4" />,
  served: <CheckCircle2 className="h-4 w-4" />,
}

// ============================================
// KARTICA JEDI (POSAMEZNI COURSE)
// ============================================
export const CourseCard = memo(function CourseCard({
  course,
  isCurrentCourse,
  canFire,
  canMarkReady,
  onFire,
  onReady,
}: CourseCardProps) {
  const config = STATUS_CONFIG[course.status]

  return (
    <div
      className={`rounded-lg border-2 p-3 transition-all ${
        isCurrentCourse
          ? 'border-primary shadow-sm'
          : 'border-transparent'
      } ${config.bg}`}
    >
      {/* Course header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={config.color}>{STATUS_ICONS[course.status]}</span>
          <span className="font-semibold text-sm">{course.name}</span>
          <Badge variant="outline" className="text-[9px] h-4">
            {course.items.length} {course.items.length === 1 ? 'artikel' : 'artiklov'}
          </Badge>
          {course.status === 'firing' && (
            <Badge className="bg-orange-500 text-white text-[10px] h-5 animate-pulse">
              FIRE!
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {/* Action buttons */}
          {canFire && (
            <Button
              size="sm"
              className="h-8 text-xs bg-orange-600 hover:bg-orange-700 gap-1"
              onClick={onFire}
              aria-label={`Fire ${course.name}`}
            >
              <Flame className="h-3.5 w-3.5" />
              FIRE
            </Button>
          )}
          {canMarkReady && (
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
              onClick={onReady}
              aria-label={`Označi ${course.name} kot pripravljeno`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pripravljeno
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 ml-6">
        {course.items.map(item => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span className="font-bold">{item.quantity}x</span>
            <span className={item.status === 'served' ? 'line-through text-muted-foreground' : ''}>
              {item.name}
            </span>
            {item.modifiers.length > 0 && (
              <div className="flex gap-0.5">
                {item.modifiers.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
            {item.notes && (
              <span className="text-[10px] text-amber-600 italic">{item.notes}</span>
            )}
            <span className={`ml-auto text-[10px] ${
              item.status === 'served' ? 'text-gray-500' :
              item.status === 'ready' ? 'text-emerald-500' :
              item.status === 'preparing' ? 'text-blue-500' :
              'text-yellow-500'
            }`}>
              {item.status === 'served' ? '✓' : item.status === 'ready' ? '✓' : item.status === 'preparing' ? '⏳' : '○'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
