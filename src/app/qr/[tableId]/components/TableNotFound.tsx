'use client'

import { memo } from 'react'
import { AlertCircle } from 'lucide-react'
import type { TranslationValue } from '../translations'

interface TableNotFoundProps {
  t: TranslationValue
}

export const TableNotFound = memo(function TableNotFound({ t }: TableNotFoundProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t.tableNotFound}</h1>
        <p className="text-muted-foreground">{t.tryAgain}</p>
      </div>
    </div>
  )
})
