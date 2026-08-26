'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from 'lucide-react'
import { paymentMethodLabels } from './constants'

// ============================================
// TIPS EMPLOYEE TABLE — Podrobnosti po zaposlenih
// ============================================

interface TipsEmployeeTableProps {
  tipsByEmp: Array<{ employeeName: string; tips: number; orderCount: number; avgTip: number }>
  fmt: (_n: number) => string
}

export const TipsEmployeeTable = memo(function TipsEmployeeTable({ tipsByEmp, fmt }: TipsEmployeeTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Podrobnosti po zaposlenih</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Zaposleni</th>
                <th className="text-right p-3 font-medium">Napitnine</th>
                <th className="text-right p-3 font-medium">Naročila</th>
                <th className="text-right p-3 font-medium">Povp.</th>
              </tr>
            </thead>
            <tbody>
              {tipsByEmp.map((emp, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">{emp.employeeName}</td>
                  <td className="p-3 text-right text-emerald-600 font-semibold">{fmt(emp.tips)}</td>
                  <td className="p-3 text-right">{emp.orderCount}</td>
                  <td className="p-3 text-right">{fmt(emp.avgTip)}</td>
                </tr>
              ))}
              {tipsByEmp.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Ni napitnin</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})

// ============================================
// TIPS PAYMENT METHODS — Napitnine po plačilnih metodah
// ============================================

interface TipsPaymentMethodsProps {
  paymentMethods: Array<{ method: string; tips: number; count: number }>
  fmt: (_n: number) => string
}

export const TipsPaymentMethods = memo(function TipsPaymentMethods({ paymentMethods, fmt }: TipsPaymentMethodsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Napitnine po plačilnih metodah
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {paymentMethods.map((pm, idx) => (
            <div key={idx} className="text-center p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">{paymentMethodLabels[pm.method] || pm.method}</p>
              <p className="text-lg font-bold text-emerald-600">{fmt(pm.tips || 0)}</p>
              <p className="text-xs text-muted-foreground">{pm.count} naročil</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
