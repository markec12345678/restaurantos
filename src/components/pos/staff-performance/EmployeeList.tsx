'use client'

// ─── Podrobna tabela zaposlenih ────────────────────────────────

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Trophy, Clock, UtensilsCrossed, BarChart3, ArrowDownRight } from 'lucide-react'
import { ROLE_ICONS, ROLE_LABELS, getScoreBg, getScoreColor, type EmployeeListProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const EmployeeList = memo(function EmployeeList({
  employees,
}: EmployeeListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-4 w-4" />
          Vsi zaposleni — Podrobna analitika
        </CardTitle>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Ni podatkov za izbrano obdobje</p>
            <p className="text-sm">Poskusite drugo časovno obdobje</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((emp, idx) => {
              const RoleIcon = ROLE_ICONS[emp.role] || Users
              return (
                <div key={emp.employeeId} className={`p-4 rounded-xl border-2 ${getScoreBg(emp.performanceScore)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                        <RoleIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{emp.employeeName}</p>
                          {idx === 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]"><Trophy className="h-3 w-3 mr-0.5" />#1</Badge>}
                          {idx === 1 && <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 text-[10px]">#2</Badge>}
                          {idx === 2 && <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px]">#3</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[emp.role] || emp.role}
                          {emp.jobs.length > 0 && ` · ${emp.jobs.join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getScoreColor(emp.performanceScore)}`}>
                        {emp.performanceScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground">od 100</p>
                    </div>
                  </div>

                  {/* Progress bar za oceno */}
                  <div className="mb-3">
                    <Progress value={emp.performanceScore} className="h-2" />
                  </div>

                  {/* KPI mreža */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Prihodek</p>
                      <p className="text-sm font-bold">€{safeToFixed(emp.totalRevenue, 2)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Napitnine</p>
                      <p className="text-sm font-bold text-amber-600">€{safeToFixed(emp.totalTips, 2)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Naročila</p>
                      <p className="text-sm font-bold">{emp.totalOrders}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Povpr. naročilo</p>
                      <p className="text-sm font-bold">€{safeToFixed(emp.avgOrderValue, 2)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Čas strežbe</p>
                      <p className="text-sm font-bold">{emp.avgServiceTime > 0 ? `${safeToFixed(emp.avgServiceTime, 0)} min` : '-'}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Prih./uro</p>
                      <p className="text-sm font-bold">€{safeToFixed(emp.revenuePerHour, 2)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      <p className="text-[10px] text-muted-foreground">Upsell</p>
                      <p className={`text-sm font-bold ${emp.upsellRate >= 20 ? 'text-emerald-600' : emp.upsellRate >= 10 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {safeToFixed(emp.upsellRate, 0)}%
                      </p>
                    </div>
                  </div>

                  {/* Dodatne metrike */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {safeToFixed(emp.hoursWorked, 1)}h delal
                    </span>
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" />
                      {safeToFixed(emp.tableTurnover, 1)}x obračun miz
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {emp.orderTypeBreakdown.dineIn} na mestu · {emp.orderTypeBreakdown.takeout} za s seboj · {emp.orderTypeBreakdown.delivery} dostava
                    </span>
                    {emp.voidRate > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <ArrowDownRight className="h-3 w-3" />
                        {safeToFixed(emp.voidRate, 1)}% stornacij
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
