'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

interface PaymentSuccessAnimationProps {
  totalWithTip: number
}

export const PaymentSuccessAnimation = memo(function PaymentSuccessAnimation({ totalWithTip }: PaymentSuccessAnimationProps) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3, type: 'spring' }}
      className="flex flex-col items-center justify-center py-12 gap-4"
      role="status"
      aria-live="assertive"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </motion.div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg font-bold text-emerald-700 dark:text-emerald-400"
      >
        Plačilo uspešno!
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-sm text-muted-foreground"
      >
        €{totalWithTip.toFixed(2)}
      </motion.p>
    </motion.div>
  )
})
