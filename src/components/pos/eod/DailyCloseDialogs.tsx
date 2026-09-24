'use client'

// ============================================
// DAILY CLOSE DIALOGS (R126-b, P0-02)
// CloseDailyDialog  — popis gotovine + opombe → POST /api/daily-close;
//                     po oddaji pokaže izid kontrakta (R126-a):
//                     "Razlika ±X € (prag Y €)" + "Zaključeno" / "Poslano v odobritev"
// RejectDailyCloseDialog — obvezna opomba (min. 3 znaki)
// ReopenDailyCloseDialog — obvezni razlog (min. 3 znaki)
// ============================================

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, CheckCircle2, Clock, Loader2, Lock, LockOpen, XCircle } from 'lucide-react'
import { formatEUR, parseDecimalInput } from '@/lib/safe-format'
import { formatSignedEUR } from './constants'
import type { DailyClosePostResult } from './constants'

/** Idempotency key — client-side, enkrat na odprtje dialoga (crypto.randomUUID + fallback) */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `dc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface CloseDailyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pričakovana gotovina dneva (orientacija PRED oddajo — iz GET /api/end-of-day) */
  expectedCash: number
  isPending: boolean
  onSubmit: (input: { countedCash: number; notes: string; idempotencyKey: string }) => void
  /** Izid POST-a (kontrakt R126-a) — ko pride, dialog pokaže odločitev praga namesto obrazca */
  result: DailyClosePostResult | null
}

export const CloseDailyDialog = memo(function CloseDailyDialog({
  open, onOpenChange, expectedCash, isPending, onSubmit, result,
}: CloseDailyDialogProps) {
  // Komponenta se remounta za vsako odprtje (starš poda drugačen `key`) →
  // obrazec je vedno čist in idempotency key je svež, enkrat na odprtje dialoga.
  const [countedCash, setCountedCash] = useState('')
  const [notes, setNotes] = useState('')
  const [idempotencyKey] = useState(() => newIdempotencyKey())

  const parsedCash = countedCash.trim() === '' ? NaN : parseDecimalInput(countedCash)
  const isValid = !Number.isNaN(parsedCash) && parsedCash >= 0 && idempotencyKey !== ''

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isPending) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />Dnevni zaključek — zaključi dan
          </DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-3" data-testid="daily-close-result">
            <div className={result.requiresApproval
              ? 'p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
              : 'p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800'}>
              <p className={`flex items-center gap-2 text-sm font-semibold ${result.requiresApproval ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {result.requiresApproval ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {result.requiresApproval ? 'Poslano v odobritev' : 'Zaključeno'}
              </p>
              <p className="text-sm mt-1">
                Razlika: <span className="font-bold tabular-nums">{formatSignedEUR(result.variance)}</span>
                {' '}(prag {formatEUR(result.threshold)})
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.requiresApproval
                  ? 'Z-poročilo ostane v osnutku, dokler vodja zaključka ne odobri.'
                  : 'Z-poročilo je finalizirano s popisano gotovino.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Popis gotovine gre na reconciliacijo dneva. Če razlika presega prag, zaključek potrebuje odobritev vodje.
              </p>
            </div>
            <div>
              <label htmlFor="daily-close-counted-cash" className="text-sm font-medium mb-1 block">
                Fizični popis gotovine (&euro;)
              </label>
              <DecimalInput
                id="daily-close-counted-cash"
                value={countedCash}
                onValueChange={n => setCountedCash(String(n))}
                placeholder="0.00"
                aria-label="Fizični popis gotovine"
                autoFocus
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">Pričakovano danes: {formatEUR(expectedCash)}</p>
            </div>
            <div>
              <label htmlFor="daily-close-notes" className="text-sm font-medium mb-1 block">Opombe (opcionalno)</label>
              <Textarea
                id="daily-close-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opombe k dnevnemu zaključku…"
                rows={3}
                aria-label="Opombe k dnevnemu zaključku"
                disabled={isPending}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Zapri</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Prekliči</Button>
              <Button
                onClick={() => onSubmit({ countedCash: parsedCash, notes, idempotencyKey })}
                disabled={isPending || !isValid}
                className="gap-1"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                {isPending ? 'Pošiljanje…' : 'Zaključi dan'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export interface RejectDailyCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (rejectedNote: string) => void
}

export const RejectDailyCloseDialog = memo(function RejectDailyCloseDialog({
  open, onOpenChange, isPending, onConfirm,
}: RejectDailyCloseDialogProps) {
  // Remount za vsako odprtje (starš poda drugačen `key`) → polje vedno začisto
  const [note, setNote] = useState('')

  const valid = note.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isPending) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />Zavrni dnevni zaključek
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Zaključek bo zavrnjen, dan ponovno odprt, Z-poročilo pa se vrne v osnutek. Opomba je obvezna.
          </p>
          <div>
            <label htmlFor="daily-close-reject-note" className="text-sm font-medium mb-1 block">
              Opomba zavrnitve (min. 3 znaki)
            </label>
            <Textarea
              id="daily-close-reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Zakaj zaključek ni v redu…"
              rows={3}
              aria-label="Opomba zavrnitve"
              disabled={isPending}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Prekliči</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(note.trim())}
            disabled={isPending || !valid}
            className="gap-1"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            {isPending ? 'Zavračanje…' : 'Zavrni zaključek'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export interface ReopenDailyCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (reopenReason: string) => void
}

export const ReopenDailyCloseDialog = memo(function ReopenDailyCloseDialog({
  open, onOpenChange, isPending, onConfirm,
}: ReopenDailyCloseDialogProps) {
  // Remount za vsako odprtje (starš poda drugačen `key`) → polje vedno začisto
  const [reason, setReason] = useState('')

  const valid = reason.trim().length >= 3

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isPending) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5" />Ponovno odpri dan
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Dan bo ponovno odprt, Z-poročilo pa de-finalizirano (nazaj v osnutek). Razlog se zabeleži v revizijo.
            </p>
          </div>
          <div>
            <label htmlFor="daily-close-reopen-reason" className="text-sm font-medium mb-1 block">
              Razlog za ponovno odpiranje (min. 3 znaki)
            </label>
            <Textarea
              id="daily-close-reopen-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Npr. popravek gotovine, zamudni račun…"
              rows={3}
              aria-label="Razlog za ponovno odpiranje"
              disabled={isPending}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Prekliči</Button>
          <Button
            onClick={() => onConfirm(reason.trim())}
            disabled={isPending || !valid}
            className="gap-1"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockOpen className="h-3 w-3" />}
            {isPending ? 'Odpiranje…' : 'Ponovno odpri dan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
