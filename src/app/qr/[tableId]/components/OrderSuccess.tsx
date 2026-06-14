'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { statusIcons, statusColors } from '../types'
import type { TranslationValue } from '../translations'
import type { OrderResult } from '../types'

interface OrderSuccessProps {
  t: TranslationValue
  orderResult: OrderResult
  orderStatus: string
  onNewOrder: () => void
}

export const OrderSuccess = memo(function OrderSuccess({ t, orderResult, orderStatus, onNewOrder }: OrderSuccessProps) {
  const statusLabel = {
    pending: t.pending,
    'in-progress': t.inProgress,
    ready: t.ready,
    completed: t.completed,
  }[orderStatus] || orderStatus

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Check className="h-10 w-10 text-emerald-600" />
        </motion.div>

        <h1 className="text-2xl font-bold mb-2">{t.orderSuccess}</h1>
        <p className="text-muted-foreground mb-6">{t.orderFromTable} {orderResult.tableNumber}</p>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">{t.orderNumber}</p>
          <p className="text-3xl font-bold text-amber-600">#{orderResult.orderNumber}</p>
        </div>

        <div className="space-y-3 mb-8">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusColors[orderStatus] || 'bg-gray-100'}`}>
            <span className="text-lg">{statusIcons[orderStatus] || '\u23F3'}</span>
            <span className="font-medium">{statusLabel}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-2">
            <motion.div
              className="bg-emerald-500 h-2 rounded-full"
              initial={{ width: '0%' }}
              animate={{
                width: orderStatus === 'pending' ? '25%'
                  : orderStatus === 'in-progress' ? '60%'
                  : orderStatus === 'ready' ? '90%'
                  : '100%'
              }}
              transition={{ duration: 1 }}
            />
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {t.statusAutoUpdates}
          </p>
        </div>

        <button
          onClick={onNewOrder}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
        >
          {t.newOrder}
        </button>
      </motion.div>
    </div>
  )
})
