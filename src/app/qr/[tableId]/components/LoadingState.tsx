'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import type { TranslationValue } from '../translations'

interface LoadingStateProps {
  t: TranslationValue
}

export const LoadingState = memo(function LoadingState({ t }: LoadingStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"
        />
        <p className="text-lg text-muted-foreground">{t.loading}</p>
      </div>
    </div>
  )
})
