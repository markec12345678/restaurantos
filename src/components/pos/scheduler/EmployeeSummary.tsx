'use client'
import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3 } from 'lucide-react'
import { type ShiftType, statusLabels, statusColors, calcHours } from './constants'

// ============================================
// EMPLOYEE SUMMARY CARD — Povzetek po zaposlenem
// ============================================
interface EmployeeSummaryCardProps {
  empId: string
  empShifts: ShiftType[]
}

export const EmployeeSummaryCard = memo(function EmployeeSummaryCard({ empId, empShifts }: EmployeeSummaryCardProps) {
  const emp = empShifts[0]?.employee
  if (!emp) return null
  const totalH = empShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
  const completedH = empShifts.filter(s => s.status === 'completed').reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)
  return (
    <Card key={empId} className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold">{emp.name}</p>
          <p className="text-[10px] text-muted-foreground">{emp.role}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-bold">{totalH.toFixed(1)}h</p>
          <p className="text-[10px] text-muted-foreground">{completedH.toFixed(1)}h opravljenih</p>
        </div>
      </div>
      <div className="space-y-1">
        {empShifts.map(s => (
          <div key={s.id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{format(new Date(s.date), 'EEE d', { locale: sl })}</span>
            <span>{s.startTime}—{s.endTime} ({calcHours(s.startTime, s.endTime, s.breakMinutes).toFixed(1)}h)</span>
            <Badge variant="outline" className={`text-[8px] h-4 px-1 ${statusColors[s.status]}`}>
              {statusLabels[s.status]}
            </Badge>
          </div>
        ))}
      </div>
      {/* Urna kartica */}
      <div className="mt-2 pt-2 border-t">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>40h tedensko</span>
          <span className={totalH > 40 ? 'text-red-600 font-bold' : totalH >= 35 ? 'text-emerald-600' : ''}>
            {totalH.toFixed(1)}h ({((totalH / 40) * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={Math.min(100, (totalH / 40) * 100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={totalH > 40 ? 'Prekoračene ure' : totalH >= 35 ? 'Zadostne ure' : 'Nizke ure'}>
          <div className={`h-full rounded-full transition-all ${totalH > 40 ? 'bg-red-500' : totalH >= 35 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, (totalH / 40) * 100)}%` }} />
        </div>
      </div>
    </Card>
  )
})

// ============================================
// EMPLOYEE SUMMARY — Celoten povzetek po zaposlenih
// ============================================
interface EmployeeSummaryProps {
  shiftsByEmployee: Record<string, ShiftType[]>
}

export const EmployeeSummary = memo(function EmployeeSummary({ shiftsByEmployee }: EmployeeSummaryProps) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" /> Povzetek po zaposlenih
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(shiftsByEmployee).map(([empId, empShifts]) => (
          <EmployeeSummaryCard key={empId} empId={empId} empShifts={empShifts} />
        ))}
      </div>
    </div>
  )
})
