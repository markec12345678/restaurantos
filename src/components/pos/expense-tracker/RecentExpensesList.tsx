'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Receipt } from 'lucide-react'
import { CATEGORIES, PAYMENT_METHODS } from './constants'

// ============================================
// Recent expenses list
// ============================================
interface RecentExpensesListProps {
  expenses: Array<{
    id: string; category: string; description: string; amount: number;
    date: string; vendor: string; paymentMethod: string; recurring: boolean
  }>
}

export const RecentExpensesList = memo(function RecentExpensesList({ expenses }: RecentExpensesListProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Zadnji vnosi</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {expenses.slice(0, 20).map((exp) => {
            const catInfo = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[CATEGORIES.length - 1]
            const CatIcon = catInfo.icon
            const payMethod = PAYMENT_METHODS.find(p => p.id === exp.paymentMethod) || PAYMENT_METHODS[0]
            const PayIcon = payMethod.icon
            return (
              <div key={exp.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className={`h-9 w-9 rounded-full bg-${catInfo.color}-100 dark:bg-${catInfo.color}-900/30 flex items-center justify-center flex-shrink-0`}>
                  <CatIcon className={`h-4 w-4 text-${catInfo.color}-600`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{exp.description}</p>
                    {exp.recurring && <Badge variant="outline" className="text-[9px]">Ponavljajoč</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{catInfo.label}</span>
                    {exp.vendor && <span>· {exp.vendor}</span>}
                    <span>· {format(new Date(exp.date), 'dd.MM.yyyy')}</span>
                    <PayIcon className="h-3 w-3" />
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600">-€{exp.amount.toFixed(2)}</span>
              </div>
            )
          })}
          {expenses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni zabeleženih stroškov</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
