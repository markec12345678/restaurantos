'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — AI Scheduler Modal
// Prikaze forecast, generated shifts in dovoli uporabniku
// potrditi/adjustirati pred apply.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, TrendingUp, Clock, Users } from 'lucide-react'
import { format } from 'date-fns'

// ─── Tipi (skladno z /api/ai/staff-scheduler response) ────────
interface GeneratedShift {
  date: string
  shiftType: 'morning' | 'afternoon' | 'evening' | 'night'
  startTime: string
  endTime: string
  employeeId: string
  employeeName: string
  role: string
  hours: number
  breakMinutes: number
  reasons: string[]
  warnings: string[]
}

interface SchedulerInsights {
  totalShifts: number
  totalHours: number
  totalLaborCost: number
  employeesUsed: number
  coverageGaps: number
  conflicts: string[]
  recommendations: string[]
}

interface AISchedulerResponse {
  generated: GeneratedShift[]
  insights: SchedulerInsights
  dryRun: boolean
}

// ─── Props ─────────────────────────────────────────────────────
export interface AISchedulerModalProps {
  open: boolean
  onClose: () => void
  startDate: string
  days?: number
  locationId?: string
  onApplied?: () => void
}

// ─── Komponenta ────────────────────────────────────────────────
export function AISchedulerModal({
  open,
  onClose,
  startDate,
  days = 7,
  locationId,
  onApplied,
}: AISchedulerModalProps) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [data, setData] = useState<AISchedulerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Generiraj preview
  async function generatePreview() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/ai/staff-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, days, locationId, dryRun: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as AISchedulerResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri generiranju')
    } finally {
      setLoading(false)
    }
  }

  // Potrdi in shrani v DB
  async function applySchedule() {
    if (!data) return
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/staff-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, days, locationId, apply: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onApplied?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri shranjevanju')
    } finally {
      setApplying(false)
    }
  }

  // Reset ko se odpre
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setData(null)
      setError(null)
    }
    if (isOpen && !data) {
      generatePreview()
    }
    if (!isOpen) onClose()
  }

  const shiftTypeLabels: Record<GeneratedShift['shiftType'], string> = {
    morning: 'Jutranja',
    afternoon: 'Popoldanska',
    evening: 'Večerna',
    night: 'Nočna',
  }

  const shiftTypeColors: Record<GeneratedShift['shiftType'], string> = {
    morning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    afternoon: 'bg-orange-100 text-orange-800 border-orange-300',
    evening: 'bg-blue-100 text-blue-800 border-blue-300',
    night: 'bg-purple-100 text-purple-800 border-purple-300',
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI razporejevalnik
          </DialogTitle>
          <DialogDescription>
            Algoritem upošteva 90-dnevno zgodovino prometa, razpoložljivost zaposlenih in EU delovno zakonodajo
            (48h/teden, 11h počitka, max 6 zaporednih dni).
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Generiram optimalni razpored...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Napaka</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Insights */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Users className="h-3 w-3" /> Zaposlenih
                </div>
                <p className="text-2xl font-bold">{data.insights.employeesUsed}</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" /> Skupaj ur
                </div>
                <p className="text-2xl font-bold">{data.insights.totalHours.toFixed(0)}h</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" /> Strošek dela
                </div>
                <p className="text-2xl font-bold">€{data.insights.totalLaborCost.toFixed(0)}</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <AlertTriangle className="h-3 w-3" /> Manjkajoči
                </div>
                <p className={`text-2xl font-bold ${data.insights.coverageGaps > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {data.insights.coverageGaps}
                </p>
              </div>
            </div>

            {/* Recommendations */}
            {data.insights.recommendations.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-3">
                <p className="text-xs font-semibold text-primary mb-1">Priporočila AI</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {data.insights.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conflicts */}
            {data.insights.conflicts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                <p className="text-xs font-semibold text-yellow-900 mb-1">
                  Konflikti ({data.insights.conflicts.length})
                </p>
                <ScrollArea className="h-16">
                  <ul className="text-xs text-yellow-800 space-y-1">
                    {data.insights.conflicts.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {/* Generated shifts preview */}
            <div className="flex-1 min-h-0">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Predogled izmen ({data.generated.length})
              </p>
              <ScrollArea className="h-64 border border-border rounded-md">
                <div className="divide-y divide-border">
                  {data.generated.map((shift, i) => (
                    <div key={i} className="p-2 hover:bg-muted/30 flex items-center gap-2">
                      <div className="w-20 text-xs text-muted-foreground">
                        {format(new Date(shift.date), 'EEE dd.MM')}
                      </div>
                      <Badge variant="outline" className={`text-xs ${shiftTypeColors[shift.shiftType]}`}>
                        {shiftTypeLabels[shift.shiftType]}
                      </Badge>
                      <div className="text-xs">
                        <span className="font-medium">{shift.employeeName}</span>
                        <span className="text-muted-foreground ml-2">
                          {shift.startTime}-{shift.endTime} · {shift.hours}h · {shift.role}
                        </span>
                      </div>
                      {shift.warnings.length > 0 && (
                        <AlertTriangle className="h-3 w-3 text-yellow-600 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applying}>
            Prekliči
          </Button>
          {data && !loading && (
            <>
              <Button variant="secondary" onClick={generatePreview} disabled={applying}>
                Ponovno generiraj
              </Button>
              <Button onClick={applySchedule} disabled={applying || data.generated.length === 0}>
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Shranjujem...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Potrdi in shrani
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
