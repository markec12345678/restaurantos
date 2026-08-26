'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X, Bell } from 'lucide-react'
import type { TranslationValue } from '../translations'

// ============================================
// OBVEŠČANJE O NAPAKI
// ============================================
interface ErrorToastProps {
  error: string | null
  onDismiss: () => void
  t: TranslationValue
}

export const ErrorToast = memo(function ErrorToast({ error, onDismiss, t }: ErrorToastProps) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-3xl mx-auto"
        >
          <div className="bg-red-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm flex-1">{error}</span>
            <button onClick={onDismiss} className="text-white/80 hover:text-white" aria-label={t.close}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// ============================================
// OBVEŠČANJE O KLICU NATAKARJA
// ============================================
interface WaiterCalledToastProps {
  waiterCalled: boolean
  t: TranslationValue
}

export const WaiterCalledToast = memo(function WaiterCalledToast({ waiterCalled, t }: WaiterCalledToastProps) {
  return (
    <AnimatePresence>
      {waiterCalled && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-3xl mx-auto"
        >
          <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
            <Bell className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">{t.waiterCalled}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
