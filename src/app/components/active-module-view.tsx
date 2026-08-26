'use client'

// ============================================
// AKTIVNI MODUL PRIKAZ
// AnimatePresence + ErrorBoundary wrapper za aktivni modul
// ============================================

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/error-boundary'
import type { ComponentType } from 'react'

interface ActiveModuleViewProps {
  activeModule: string
  ActiveComponent: ComponentType
}

// Animirani prehod med moduli z ErrorBoundary zaščito
export const ActiveModuleView = memo(function ActiveModuleView({ activeModule, ActiveComponent }: ActiveModuleViewProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeModule}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.12 }}
        className="h-full"
      >
        <ErrorBoundary context={`POS:${activeModule}`} maxRetries={3}>
          <ActiveComponent />
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
})
