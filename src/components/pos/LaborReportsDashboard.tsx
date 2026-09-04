'use client'

// ============================================
// LABOR REPORTS DASHBOARD
// ============================================
// Prikazuje 3 ključne labor reporte:
//   1. Scheduled vs Actual (prisotnost)
//   2. Overtime Analysis (nadure)
//   3. Attendance History (zgodovina)
// ============================================

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Calendar, Clock, TrendingUp, AlertCircle, User,
  Loader2, RefreshCw, DollarSign, Timer,
} from 'lucide-react'
import { format, subDays } from 'date-fns'

// --- Tipi ---
interface ScheduledVsActualEntry {
  employeeId: string
  employeeName: string
  date: string
  scheduledStart?: string
  scheduledEnd?: string
  scheduledHours: number
  actualStart?: string
  actualEnd?: string
  actualHours: number
  arrivedLate: boolean
  lateMinutes: number
  leftEarly: boolean
  earlyMinutes: number
  status: 'present' | 'absent' | 'late' | 'partial' | 'no_show'
}

interface OvertimeEntry {
  employeeId: string
  employeeName: string
  dailyOvertimeHours: number
  weeklyOvertimeHours: number
  holidayOvertimeHours: number
  totalOvertimeHours: number
  overtimePay: number
  regularPay: number
  totalPay: number
}

interface AttendanceEntry {
  employeeId: string
  employeeName: string
  date: string
  clockIn?: string
  clockOut?: string
  totalHours: number
  breakMinutes: number
  payRate: number
  totalPay: number
  type: string
  status: string
}

// --- Status config ---
const statusConfig: Record<string, { color: string; label: string }> = {
  present: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Prisoten' },
  late: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Zamuja' },
  partial: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Delno' },
  absent: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Odsoten' },
  no_show: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Ni se javil' },
}

// --- Komponenta ---
export function LaborReportsDashboard() {
  const [activeTab, setActiveTab] = useState('scheduled_vs_actual')

  // Date range: zadnjih 7 dni
  const dateTo = new Date()
  const dateFrom = subDays(dateTo, 7)

  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  })

  // Fetch report
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['labor-reports', activeTab, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/labor-reports?type=${activeTab}&${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Labor Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Analiza delovnega časa, nadur in prisotnosti
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Osveži
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scheduled_vs_actual">Scheduled vs Actual</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        {/* Scheduled vs Actual */}
        <TabsContent value="scheduled_vs_actual" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : data?.summary ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-5 gap-3">
                <StatCard title="Načrtovane ure" value={`${data.summary.totalScheduledHours}h`} icon={Clock} color="bg-blue-50 border-blue-200 text-blue-800" />
                <StatCard title="Dejanske ure" value={`${data.summary.totalActualHours}h`} icon={Timer} color="bg-green-50 border-green-200 text-green-800" />
                <StatCard title="Varianca" value={`${data.summary.totalVariance > 0 ? '+' : ''}${data.summary.totalVariance}h`} icon={TrendingUp} color={data.summary.totalVariance < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-800'} />
                <StatCard title="Punctuality" value={`${data.summary.punctualityRate}%`} icon={User} color="bg-purple-50 border-purple-200 text-purple-800" />
                <StatCard title="Zamujanja" value={data.summary.lateCount} icon={AlertCircle} color="bg-yellow-50 border-yellow-200 text-yellow-800" />
              </div>

              {/* Entries */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Prisotnost ({data.entries?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {(data.entries || []).map((entry: ScheduledVsActualEntry, i: number) => {
                        const cfg = statusConfig[entry.status] || statusConfig.present
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30">
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                              {cfg.label}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{entry.employeeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(entry.date), 'EEE dd.MM')} ·{' '}
                                {entry.scheduledStart}-{entry.scheduledEnd} ({entry.scheduledHours}h)
                                {entry.actualStart && ` → ${entry.actualStart}-${entry.actualEnd || '?'} (${entry.actualHours}h)`}
                              </div>
                              {entry.arrivedLate && (
                                <div className="text-xs text-yellow-600 mt-0.5">
                                  ⚠ Zamudil {entry.lateMinutes} min
                                </div>
                              )}
                              {entry.leftEarly && (
                                <div className="text-xs text-orange-600 mt-0.5">
                                  ⚠ Šel prezgodaj {entry.earlyMinutes} min
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Overtime */}
        <TabsContent value="overtime" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : data?.summary ? (
            <>
              <div className="grid grid-cols-4 gap-3">
                <StatCard title="Skupaj nadur" value={`${data.summary.totalOvertimeHours}h`} icon={Clock} color="bg-orange-50 border-orange-200 text-orange-800" />
                <StatCard title="Strošek nadur" value={`€${data.summary.totalOvertimePay.toFixed(0)}`} icon={DollarSign} color="bg-red-50 border-red-200 text-red-800" />
                <StatCard title="Redni strošek" value={`€${data.summary.totalRegularPay.toFixed(0)}`} icon={DollarSign} color="bg-green-50 border-green-200 text-green-800" />
                <StatCard title="% nadur" value={`${data.summary.overtimePayPercentage}%`} icon={TrendingUp} color="bg-purple-50 border-purple-200 text-purple-800" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Zaposleni z nadurami ({data.entries?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {(data.entries || []).map((entry: OvertimeEntry, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{entry.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              Dnevne: {entry.dailyOvertimeHours}h · Tedenske: {entry.weeklyOvertimeHours}h · Praznične: {entry.holidayOvertimeHours}h
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-orange-600">{entry.totalOvertimeHours}h</div>
                            <div className="text-xs text-muted-foreground">€{entry.overtimePay.toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Attendance */}
        <TabsContent value="attendance" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : data?.summary ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard title="Skupaj vnosov" value={data.summary.totalEntries} icon={Calendar} color="bg-blue-50 border-blue-200 text-blue-800" />
                <StatCard title="Skupaj ur" value={`${data.summary.totalHours}h`} icon={Clock} color="bg-green-50 border-green-200 text-green-800" />
                <StatCard title="Skupni strošek" value={`€${data.summary.totalPay.toFixed(0)}`} icon={DollarSign} color="bg-purple-50 border-purple-200 text-purple-800" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Zgodovina prisotnosti ({data.entries?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {(data.entries || []).map((entry: AttendanceEntry, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{entry.employeeName}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(entry.date), 'EEE dd.MM')} ·{' '}
                              {entry.clockIn || '?'}-{entry.clockOut || '?'}
                              {entry.breakMinutes > 0 && ` · odmor ${entry.breakMinutes}min`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{entry.totalHours}h</div>
                            <div className="text-xs text-muted-foreground">€{entry.totalPay.toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// --- StatCard ---
interface StatCardProps {
  title: string
  value: string | number
  icon: typeof Clock
  color: string
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className={`border-2 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">{title}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
