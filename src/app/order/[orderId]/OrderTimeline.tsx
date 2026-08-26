'use client'

import { memo } from 'react'
import type { TrackingData } from './types'

// =====================================================================
// RESTAURANTOS ORDER TRACKING — Order Timeline Component
// =====================================================================

interface OrderTimelineProps {
  tracking: TrackingData
}

export const OrderTimeline = memo(function OrderTimeline({
  tracking,
}: OrderTimelineProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-bold mb-4">Status naročila</h3>
      <div className="space-y-0">
        {tracking.timeline.map((step, idx) => (
          <div key={step.status} className="flex gap-3">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                step.completed
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step.completed ? '✓' : idx + 1}
              </div>
              {idx < tracking.timeline.length - 1 && (
                <div className={`w-0.5 h-8 ${step.completed ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
            {/* Content */}
            <div className="pb-4">
              <p className={`font-medium text-sm ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </p>
              {step.time && (
                <p className="text-xs text-gray-400">
                  {new Date(step.time).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
