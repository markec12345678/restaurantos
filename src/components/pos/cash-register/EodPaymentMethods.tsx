'use client'

import { memo } from 'react'
import { Wallet } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodPaymentMethodsProps {
  eodData: EodData
}

export const EodPaymentMethods = memo(function EodPaymentMethods({ eodData }: EodPaymentMethodsProps) {
  if (eodData.paymentMethods.length === 0) return null
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-2 font-medium text-sm flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5" /> Plačilne metode
      </div>
      <div className="space-y-1 p-2">
        {eodData.paymentMethods.map((pm: { method: string; count: number; revenue: number; tips: number }, i: number) => (
          <div key={i} className="flex items-center justify-between text-sm py-1">
            <span className="capitalize">{pm.method === 'cash' ? 'Gotovina' : pm.method === 'card' ? 'Kartica' : pm.method === 'mobile' ? 'Mobilno' : pm.method}</span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{pm.count}&times;</span>
              <span className="font-semibold">&euro;{safeToFixed(pm.revenue, 2)}</span>
              {pm.tips > 0 && <span className="text-xs text-emerald-600">+&euro;{safeToFixed(pm.tips, 2)} tip</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
