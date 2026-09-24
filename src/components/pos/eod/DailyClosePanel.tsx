'use client'

// ============================================
// DAILY CLOSE PANEL — "Dnevni zaključek" (R126-b, P0-02)
// Status dnevnega zaključka za izbrani datum:
//   brez zapisa → CTA "Zaključi dan"
//   PENDING_APPROVAL → oranžen Alert (razlika > prag); admin: [Odobri] [Zavrni]
//   CLOSED → zelen badge + povzetek (popis, pričakovano, razlika, kdaj/kdo)
//   REOPENED → moder badge + razlog + CTA ponoven zaključek
// + zgodovina zadnjih 10 zaključkov (mini tabela)
// Integracija: EndOfDayManager — pod KPI karticami, pred sekcijami.
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, CheckCircle2, Clock, History, LockKeyhole, RefreshCcw } from 'lucide-react'
import { format } from 'date-fns'
import { formatEUR } from '@/lib/safe-format'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import {
  useApproveDailyClose,
  useCloseDay,
  useDailyClose,
  useRejectDailyClose,
  useReopenDailyClose,
} from './useDailyClose'
import { CloseDailyDialog, ReopenDailyCloseDialog, RejectDailyCloseDialog } from './DailyCloseDialogs'
import {
  formatSignedEUR,
  isVarianceWithinThreshold,
} from './constants'
import type {
  DailyClosePanelProps,
  DailyClosePostResult,
  DailyCloseRow,
  DailyCloseStatus,
} from './constants'

/** Status → oznaka + barvni razredi badge-a (Toast-stil: pastel + dark) */
const STATUS_META: Record<DailyCloseStatus, { label: string; className: string }> = {
  PENDING_APPROVAL: {
    label: 'Čaka odobritev',
    className: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  CLOSED: {
    label: 'Zaključen',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  REOPENED: {
    label: 'Ponovno odprt',
    className: 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  },
}

function statusMeta(status: DailyCloseStatus) {
  return STATUS_META[status] ?? { label: String(status), className: '' }
}

function rejectionNoteOf(row: DailyCloseRow): string | null {
  return row.rejectedNote ?? row.rejectNote ?? null
}

function approvalNoteOf(row: DailyCloseRow): string | null {
  return row.approvalNote ?? row.approvedNote ?? null
}

/** ISO day-start UTC (businessDate) → 'YYYY-MM-DD' po LJUBLJANSKEM dnevu */
function businessDateKey(value: string | undefined | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Ljubljana',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
  return parts // en-CA = ISO-oblika YYYY-MM-DD
}

/** ISO day-start UTC (businessDate) → 'dd. MM. yyyy' po LJUBLJANSKEM dnevu.
 * R126-d popavek: prej `value.slice(0,10)` (UTC datum!) je za poslovni dan
 * 24.09 (day-start 23.09T22:00Z) prikazal NAPAČEN datum 23.09. */
function businessDateLabel(value: string | undefined | null): string {
  if (!value) return '—'
  const date = new Date(value)
  // date-fns format ne podpira timeZone (to je date-fns-tz) → Intl z sl-SI
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

/** ISO časovni žig → 'dd. MM. yyyy HH:mm' */
function timestampLabel(value: string | undefined | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : format(date, 'dd. MM. yyyy HH:mm')
}

export const DailyClosePanel = memo(function DailyClosePanel({ date, expectedCash }: DailyClosePanelProps) {
  // ── Admin/pooblastila (useAuthUser — reaktiven vzorec Sidebar) ──
  // Backend (R126-a): approve/reject/reopen zahtevata requireAuth({ permission: 'admin' }) —
  // permissions.ts: role 'admin' bypass ALI ekspliciten 'admin' permission; manager NIMA
  // bypassa za admin-only rute → UI gumba pokaže po ISTEM pravilu (brez 403 presenečenj).
  const authUser = useAuthUser()
  const isApprover = !!authUser && (
    authUser.role === 'admin' ||
    authUser.permissions.includes('admin')
  )

  // ── Podatki: status izbranega dne + zgodovina (zadnjih 60, prikažem 10) ──
  const dayQuery = useDailyClose(date)
  const historyQuery = useDailyClose()

  const current = useMemo<DailyCloseRow | null>(() => {
    const list = dayQuery.data?.closes ?? []
    if (list.length === 0) return null
    // R126-d popavek: businessDate je day-start UTC — UTC datumski niz (slice
    // 0,10) je za LJ poslovni dan med 00:00 in 22:00 ZA DEN EN DAN nazaj.
    // Primerjaj LJUBLJANSKI datum ključ (En R126-d E2E najdba: "Brez zapisa"
    // se je prikazoval kljub CLOSED zapisu).
    const exact = list.find(row => businessDateKey(row.businessDate) === date)
    if (exact) return exact
    // GET ?date= je strežniško filtriran → prvi (edini) zapis je iskani dan;
    // če strežnik vrne tudi druge dneve, jih ne pokažem kot status TEH dneva.
    const first = list[0]
    return first && businessDateKey(first.businessDate) === date ? first : null
  }, [dayQuery.data, date])

  const history = useMemo(() => (historyQuery.data?.closes ?? []).slice(0, 10), [historyQuery.data])

  // ── Mutacije ──
  const closeMutation = useCloseDay()
  const approveMutation = useApproveDailyClose()
  const rejectMutation = useRejectDailyClose()
  const reopenMutation = useReopenDailyClose()

  // ── Dialogi ──
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closeResult, setCloseResult] = useState<DailyClosePostResult | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  // Instance ključi: vsako odprtje remonta dialog → čist obrazec + svež idempotency
  // key (CloseDailyDialog generira crypto.randomUUID v state initializerju).
  const [closeDialogKey, setCloseDialogKey] = useState(0)
  const [rejectDialogKey, setRejectDialogKey] = useState(0)
  const [reopenDialogKey, setReopenDialogKey] = useState(0)

  const openCloseDialog = useCallback(() => {
    setCloseResult(null)
    setCloseDialogKey(k => k + 1)
    setCloseDialogOpen(true)
  }, [])

  const handleCloseDialogChange = useCallback((open: boolean) => {
    setCloseDialogOpen(open)
    if (!open) setCloseResult(null)
  }, [])

  const handleSubmitClose = useCallback((input: { countedCash: number; notes: string; idempotencyKey: string }) => {
    closeMutation.mutate(
      { date, countedCash: input.countedCash, notes: input.notes, idempotencyKey: input.idempotencyKey },
      { onSuccess: (result) => setCloseResult(result) },
    )
  }, [closeMutation, date])

  const handleApprove = useCallback(() => {
    if (current) approveMutation.mutate({ id: current.id })
  }, [approveMutation, current])

  const handleConfirmReject = useCallback((rejectedNote: string) => {
    if (current) rejectMutation.mutate({ id: current.id, rejectedNote })
  }, [rejectMutation, current])

  const handleConfirmReopen = useCallback((reopenReason: string) => {
    if (current) reopenMutation.mutate({ id: current.id, reopenReason })
  }, [reopenMutation, current])

  const anyActionPending = closeMutation.isPending || approveMutation.isPending || rejectMutation.isPending || reopenMutation.isPending
  const dayError = dayQuery.isError

  return (
    <Card>
      <CardHeader className="p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <LockKeyhole className="h-4 w-4" />
            Dnevni zaključek
          </CardTitle>
          {current ? (
            <Badge className={statusMeta(current.status).className}>{statusMeta(current.status).label}</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Brez zapisa</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {dayError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dnevnega zaključka ni bilo mogoče naložiti</AlertTitle>
            <AlertDescription>Poskusite osvežiti stran ali se prijavite z dovoljenjem za gotovino (manage_cash).</AlertDescription>
          </Alert>
        ) : dayQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Status izbranega dne ── */}
            {!current ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Za ta dan še ni zapisa o dnevnem zaključku</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preštejte fizično gotovino in zaključite poslovni dan. Pričakovano danes: {formatEUR(expectedCash)}.
                  </p>
                </div>
                <Button onClick={openCloseDialog} className="gap-1 shrink-0" disabled={closeMutation.isPending}>
                  {closeMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  Zaključi dan
                </Button>
              </div>
            ) : current.status === 'PENDING_APPROVAL' ? (
              <div className="space-y-3">
                <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-200 [&>svg]:text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    Denarna razlika {formatSignedEUR(current.cashVariance)} presega prag {formatEUR(current.varianceThreshold)} — potreba odobritev
                  </AlertTitle>
                  <AlertDescription>
                    Pričakovano {formatEUR(current.expectedCash)} · popis {formatEUR(current.countedCash)}
                    {current.notes ? <> · opomba: {current.notes}</> : null}
                    {!isApprover ? (
                      <span className="mt-2 flex items-center gap-1 text-xs font-medium">
                        <Clock className="h-3 w-3" /> Čaka odobritev vodje
                      </span>
                    ) : null}
                  </AlertDescription>
                </Alert>
                {isApprover ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={anyActionPending}
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {approveMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {approveMutation.isPending ? 'Odobritev…' : 'Odobri'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRejectDialogKey(k => k + 1); setRejectDialogOpen(true) }}
                      disabled={anyActionPending}
                      className="gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {rejectMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                      {rejectMutation.isPending ? 'Zavračanje…' : 'Zavrni'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : current.status === 'CLOSED' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Popis gotovine</p>
                    <p className="font-bold tabular-nums">{formatEUR(current.countedCash)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Pričakovano</p>
                    <p className="font-bold tabular-nums">{formatEUR(current.expectedCash)}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${isVarianceWithinThreshold(current.cashVariance, current.varianceThreshold) ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                    <p className="text-xs text-muted-foreground">Razlika (prag {formatEUR(current.varianceThreshold, 0)})</p>
                    <p className={`font-bold tabular-nums ${isVarianceWithinThreshold(current.cashVariance, current.varianceThreshold) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatSignedEUR(current.cashVariance)}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Zaključil</p>
                    <p className="font-bold">{current.closedByName || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{timestampLabel(current.closedAt) || '—'}</p>
                  </div>
                </div>
                {current.notes ? <p className="text-xs text-muted-foreground">Opomba: {current.notes}</p> : null}
                {approvalNoteOf(current) ? <p className="text-xs text-muted-foreground">Opomba odobritve: {approvalNoteOf(current)}</p> : null}
                {isApprover ? (
                  <Button variant="outline" onClick={() => { setReopenDialogKey(k => k + 1); setReopenDialogOpen(true) }} disabled={anyActionPending} className="gap-1">
                    {reopenMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                    {reopenMutation.isPending ? 'Odpiranje…' : 'Ponovno odpri dan'}
                  </Button>
                ) : null}
              </div>
            ) : (
              current.status === 'REOPENED' && (
                <div className="space-y-3">
                  <Alert className="border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-900/10 dark:text-sky-200 [&>svg]:text-sky-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Ponovno odprto (razlog: {current.reopenReason || rejectionNoteOf(current) || 'ni podan'})</AlertTitle>
                    <AlertDescription>
                      Prejšnji zaključek: popis {formatEUR(current.countedCash)}, razlika {formatSignedEUR(current.cashVariance)}.
                      {current.reopenedByName ? <> Odprl: {current.reopenedByName}{current.reopenedAt ? `, ${timestampLabel(current.reopenedAt)}` : ''}.</> : null}
                    </AlertDescription>
                  </Alert>
                  <Button onClick={openCloseDialog} className="gap-1" disabled={closeMutation.isPending}>
                    {closeMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                    Zaključi dan znova
                  </Button>
                </div>
              )
            )}

            {/* ── Zgodovina zadnjih zaključkov ── */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />Zgodovina zadnjih zaključkov
              </h4>
              {historyQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Še ni zgodovine zaključkov.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Razlika</TableHead>
                        <TableHead>Odobril</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(row => {
                        const meta = statusMeta(row.status)
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap">{businessDateLabel(row.businessDate)}</TableCell>
                            <TableCell>
                              <Badge className={meta.className}>{meta.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatSignedEUR(row.cashVariance)}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.approvedByName || '—'}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* ── Dialogi: zaključek dneva / zavrnitev / ponovno odpiranje ── */}
      <CloseDailyDialog
        key={closeDialogKey}
        open={closeDialogOpen}
        onOpenChange={handleCloseDialogChange}
        expectedCash={expectedCash}
        isPending={closeMutation.isPending}
        onSubmit={handleSubmitClose}
        result={closeResult}
      />
      <RejectDailyCloseDialog
        key={rejectDialogKey}
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        isPending={rejectMutation.isPending}
        onConfirm={handleConfirmReject}
      />
      <ReopenDailyCloseDialog
        key={reopenDialogKey}
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        isPending={reopenMutation.isPending}
        onConfirm={handleConfirmReopen}
      />
    </Card>
  )
})
