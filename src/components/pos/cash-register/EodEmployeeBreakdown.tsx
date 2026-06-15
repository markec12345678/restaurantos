'use client'

import { memo } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodEmployeeBreakdownProps {
  eodData: EodData
}

export const EodEmployeeBreakdown = memo(function EodEmployeeBreakdown({ eodData }: EodEmployeeBreakdownProps) {
  if (eodData.employeeBreakdown.length === 0) return null
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-2 font-medium text-sm">Pregled po zaposlenih</div>
      {eodData.employeeBreakdown.map((emp: { employeeId: string; employeeName?: string; orderCount: number; revenue: number; tips: number }, i: number) => (
        <div key={i} className="flex items-center justify-between text-sm p-2 border-b last:border-0">
          <span>{String((emp as Record<string, unknown>).employeeName || emp.employeeId)}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{emp.orderCount} naročil</span>
            <span className="font-semibold">&euro;{emp.revenue.toFixed(2)}</span>
            {emp.tips > 0 && <span className="text-xs text-emerald-600">+&euro;{emp.tips.toFixed(2)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
})
