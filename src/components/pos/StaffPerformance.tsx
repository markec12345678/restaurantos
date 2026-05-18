'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Analitika učinkovitosti zaposlenih
// Toast POS + 7shifts + Square standard
// Napitnine, čas strežbe, obračun miz, upsell, ocena
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Trophy, TrendingUp, DollarSign, Clock, Users, Star,
  BarChart3, Timer, UtensilsCrossed, ArrowUpRight, ArrowDownRight,
  Award, Zap, Target, Coffee, ChefHat, Wine,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'

// ─── Tipi ──────────────────────────────────────────────────────
interface PerformanceEmployee {
  employeeId: string
  employeeName: string
  role: string
  jobs: string[]
  totalOrders: number
  totalRevenue: number
  totalTips: number
  avgOrderValue: number
  avgServiceTime: number
  tableTurnover: number
  upsellRate: number
  revenuePerHour: number
  hoursWorked: number
  voidRate: number
  orderTypeBreakdown: { dineIn: number; takeout: number; delivery: number }
  shiftsWorked: number
  performanceScore: number
}

interface PerformanceData {
  period: string
  startDate: string
  endDate: string
  employees: PerformanceEmployee[]
  totals: {
    totalRevenue: number
    totalTips: number
    totalOrders: number
    avgServiceTime: number
    avgPerformanceScore: number
  }
}

const ROLE_ICONS: Record<string, typeof ChefHat> = {
  server: UtensilsCrossed,
  chef: ChefHat,
  bartender: Wine,
  host: Users,
  manager: Award,
  prep: Coffee,
}

const ROLE_LABELS: Record<string, string> = {
  server: 'Natakar(ka)',
  chef: 'Kuhar(ica)',
  bartender: 'Barman/ka',
  host: 'Gostitelj(ica)',
  manager: 'Vodja',
  prep: 'Pripravnik(ica)',
  staff: 'Osebje',
  admin: 'Admin',
}

const PERIOD_LABELS: Record<string, string> = {
  today: 'Danes',
  week: 'Zadnji teden',
  month: 'Ta mesec',
}

export function StaffPerformance() {
  const [period, setPeriod] = useState('week')

  const { data, isLoading } = useQuery<PerformanceData>({
    queryKey: ['staff-performance', period],
    queryFn: async () => {
      const res = await authFetch(`/api/staff-performance?period=${period}`)
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const employees = data?.employees || []
  const totals = data?.totals

  // Top performer
  const topPerformer = employees[0]
  // Most tips
  const mostTips = [...employees].sort((a, b) => b.totalTips - a.totalTips)[0]
  // Fastest
  const fastest = [...employees].filter(e => e.avgServiceTime > 0).sort((a, b) => a.avgServiceTime - b.avgServiceTime)[0]
  // Best upseller
  const bestUpseller = [...employees].sort((a, b) => b.upsellRate - a.upsellRate)[0]

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800'
    if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-800'
    if (score >= 40) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800'
    return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Učinkovitost zaposlenih
          </h2>
          <p className="text-muted-foreground text-sm">
            Analitika in ocena za {PERIOD_LABELS[period] || period}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Danes</SelectItem>
            <SelectItem value="week">Zadnji teden</SelectItem>
            <SelectItem value="month">Ta mesec</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skupni KPI-ji */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Skupni prihodek</span>
            </div>
            <p className="text-xl font-bold">€{(totals?.totalRevenue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Skupne napitnine</span>
            </div>
            <p className="text-xl font-bold">€{(totals?.totalTips || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Skupna naročila</span>
            </div>
            <p className="text-xl font-bold">{totals?.totalOrders || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Timer className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Povpr. čas strežbe</span>
            </div>
            <p className="text-xl font-bold">{(totals?.avgServiceTime || 0).toFixed(0)} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Povpr. ocena</span>
            </div>
            <p className="text-xl font-bold">{(totals?.avgPerformanceScore || 0).toFixed(0)}/100</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers - Featured Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topPerformer && (
          <Card className="border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Top izvajalec</span>
              </div>
              <p className="text-lg font-bold">{topPerformer.employeeName}</p>
              <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[topPerformer.role] || topPerformer.role}</p>
              <div className="flex items-center justify-between">
                <Badge className={getScoreBadge(topPerformer.performanceScore)}>
                  {topPerformer.performanceScore}/100
                </Badge>
                <span className="text-sm font-semibold">€{topPerformer.totalRevenue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}
        {mostTips && (
          <Card className="border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Največ napitnin</span>
              </div>
              <p className="text-lg font-bold">{mostTips.employeeName}</p>
              <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[mostTips.role] || mostTips.role}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{mostTips.totalOrders} naročil</span>
                <span className="text-sm font-semibold text-emerald-600">€{mostTips.totalTips.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}
        {fastest && (
          <Card className="border-blue-300 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-blue-500" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Najhitrejši</span>
              </div>
              <p className="text-lg font-bold">{fastest.employeeName}</p>
              <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[fastest.role] || fastest.role}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Povprečno</span>
                <span className="text-sm font-semibold text-blue-600">{fastest.avgServiceTime.toFixed(0)} min</span>
              </div>
            </CardContent>
          </Card>
        )}
        {bestUpseller && bestUpseller.upsellRate > 0 && (
          <Card className="border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-purple-500" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Najboljši upseller</span>
              </div>
              <p className="text-lg font-bold">{bestUpseller.employeeName}</p>
              <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[bestUpseller.role] || bestUpseller.role}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upsell stopnja</span>
                <span className="text-sm font-semibold text-purple-600">{bestUpseller.upsellRate.toFixed(0)}%</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Podrobna tabela zaposlenih */}
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

                    {/* Performance bar */}
                    <div className="mb-3">
                      <Progress value={emp.performanceScore} className="h-2" />
                    </div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Prihodek</p>
                        <p className="text-sm font-bold">€{emp.totalRevenue.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Napitnine</p>
                        <p className="text-sm font-bold text-amber-600">€{emp.totalTips.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Naročila</p>
                        <p className="text-sm font-bold">{emp.totalOrders}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Povpr. naročilo</p>
                        <p className="text-sm font-bold">€{emp.avgOrderValue.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Čas strežbe</p>
                        <p className="text-sm font-bold">{emp.avgServiceTime > 0 ? `${emp.avgServiceTime.toFixed(0)} min` : '-'}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Prih./uro</p>
                        <p className="text-sm font-bold">€{emp.revenuePerHour.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/20">
                        <p className="text-[10px] text-muted-foreground">Upsell</p>
                        <p className={`text-sm font-bold ${emp.upsellRate >= 20 ? 'text-emerald-600' : emp.upsellRate >= 10 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {emp.upsellRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    {/* Extra metrics row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {emp.hoursWorked.toFixed(1)}h delal
                      </span>
                      <span className="flex items-center gap-1">
                        <UtensilsCrossed className="h-3 w-3" />
                        {emp.tableTurnover.toFixed(1)}x obračun miz
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {emp.orderTypeBreakdown.dineIn} na mestu · {emp.orderTypeBreakdown.takeout} za s seboj · {emp.orderTypeBreakdown.delivery} dostava
                      </span>
                      {emp.voidRate > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <ArrowDownRight className="h-3 w-3" />
                          {emp.voidRate.toFixed(1)}% stornacij
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

      {/* Namigi za izboljšavo */}
      {employees.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Priporočila za izboljšavo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Počasni natakarji */}
              {employees.filter(e => e.avgServiceTime > 0).sort((a, b) => b.avgServiceTime - a.avgServiceTime).slice(0, 2).map(emp => (
                <div key={emp.employeeId} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {emp.employeeName} — Počasna strežba
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Povprečni čas {emp.avgServiceTime.toFixed(0)} min je nad povprečjem. Priporočamo dodatno usposabljanje ali pomoč med vršnimi urami.
                  </p>
                </div>
              ))}

              {/* Nizka upsell stopnja */}
              {employees.filter(e => e.upsellRate < 10 && e.totalOrders > 5).slice(0, 2).map(emp => (
                <div key={emp.employeeId} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      {emp.employeeName} — Priložnost za upsell
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upsell stopnja {emp.upsellRate.toFixed(0)}% je nizka. Predlagamo usposabljanje za predlaganje dodatkov, prilog in pijač.
                  </p>
                </div>
              ))}

              {/* Visoka stornacija */}
              {employees.filter(e => e.voidRate > 5).map(emp => (
                <div key={emp.employeeId} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {emp.employeeName} — Visoka stopnja stornacij
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stopnja stornacij {emp.voidRate.toFixed(1)}% je nad 5%. Preverite vzroke — morebiti napake pri vnosu ali težave s komunikacijo.
                  </p>
                </div>
              ))}

              {/* Top performer nagrada */}
              {topPerformer && topPerformer.performanceScore >= 80 && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {topPerformer.employeeName} — Odlična nagrada
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Z oceno {topPerformer.performanceScore}/100 je {topPerformer.employeeName} vodilni izvajalec. Razmislite o nagradi ali priznanju za motivacijo!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
