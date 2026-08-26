'use client'

import { memo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { OrderData } from '../types'
import { STATUS_STEPS, STEP_COLORS, getStepIndex } from '../constants'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Sledilnik napredka v slogu Domino's
// Prikazuje korake: Prejeto → V pripravi → Pripravljeno → Zaključeno
// ═══════════════════════════════════════════════════════════════

interface ProgressTrackerProps {
  order: OrderData
}

export const ProgressTracker = memo(function ProgressTracker({ order }: ProgressTrackerProps) {
  const currentStep = getStepIndex(order.status)
  const isCancelled = order.status === 'cancelled'
  const isDelivery = order.type === 'delivery'

  if (isCancelled) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-lg p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">{'\u274C'}</span>
        </div>
        <h2 className="text-xl font-bold text-red-700 dark:text-red-400">Naročilo je preklicano</h2>
        <p className="text-sm text-muted-foreground mt-1">Za več informacij kontaktirajte restavracijo.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <h2 className="font-bold text-lg mb-6">Status naročila</h2>
      <div className="space-y-0">
        {STATUS_STEPS.map((step, idx) => {
          // Preskoči korake za dostavo pri naročilih, ki niso dostava
          if ((step.key === 'on-the-way' || step.key === 'delivered') && !isDelivery) {
            if (step.key === 'delivered' && !isDelivery) return null
            if (step.key === 'on-the-way') return null
          }

          const isActive = idx === currentStep
          const isCompleted = idx < currentStep
          const isPending = idx > currentStep
          const StepIcon = step.icon

          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Časovnica */}
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-500 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : isActive
                      ? `${STEP_COLORS[step.color]?.bg || 'bg-blue-500'} text-white shadow-lg ${STEP_COLORS[step.color]?.shadow || 'shadow-blue-500/30'} animate-pulse`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                {idx < (isDelivery ? 5 : 3) && (
                  <div className={`w-0.5 h-8 transition-all duration-500 ${
                    isCompleted ? 'bg-emerald-500' : isActive ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>

              {/* Vsebina */}
              <div className={`pb-6 ${isPending ? 'opacity-40' : ''}`}>
                <p className={`font-semibold ${isCompleted ? 'text-emerald-600' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {idx === 0 && 'Vaše naročilo je bilo sprejeto'}
                    {idx === 1 && 'Naša ekipa pripravlja vaše naročilo'}
                    {idx === 2 && 'Vaše naročilo je v peči'}
                    {idx === 3 && 'Vaše naročilo je pripravljeno za prevzem'}
                    {idx === 4 && 'Voznik je na poti k vam'}
                    {idx === 5 && 'Vaše naročilo je dostavljeno. Dober tek!'}
                  </p>
                )}
                {isCompleted && (
                  <p className="text-xs text-emerald-600 mt-0.5">Končano {'\u2713'}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
