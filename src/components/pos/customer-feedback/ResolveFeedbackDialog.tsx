'use client'

// ============================================
// DIALOG 'ODGOVORI IN REŠI' MNENJE GOSTA (P1-14, R140-c)
// PATCH /api/guests/feedback/[id] { status: 'resolved', response? } —
// odgovor je opcijski (strežnik: trim, 1..1000 znakov, Zod). Stil po kanonu
// NewFeedbackDialog (isti dialog/textarea/badge vzorec); hardcoded sl.
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MessageSquare, CheckCircle2 } from 'lucide-react'
import type { ResolveFeedbackDialogProps } from './constants'

export const ResolveFeedbackDialog = memo(function ResolveFeedbackDialog({
  open,
  onOpenChange,
  feedback,
  responseText,
  onResponseTextChange,
  onSubmit,
  isSubmitting,
}: ResolveFeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Odgovori in reši mnenje
          </DialogTitle>
        </DialogHeader>
        {/* Kontekst mnenja — whitelist polja (brez PII: brez email/telefona) */}
        {feedback && (
          <div className="rounded-lg bg-muted/30 p-3 space-y-1">
            <p className="font-medium text-sm">{feedback.guestName || 'Anonimen gost'}</p>
            {feedback.comment && (
              <p className="text-xs text-muted-foreground italic">&ldquo;{feedback.comment}&rdquo;</p>
            )}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="feedback-response" className="text-xs font-medium text-muted-foreground">
            Odgovor restavracije (opcijsko)
          </label>
          <Textarea
            id="feedback-response"
            value={responseText}
            onChange={e => onResponseTextChange(e.target.value)}
            placeholder="Npr. Se opravičujemo za dolgo čakanje — naslednjič kava na račun."
            className="mt-1"
            rows={4}
            maxLength={1000}
            autoFocus
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Mnenje se oznaci kot rešeno.</span>
            <span className="tabular-nums">{responseText.length}/1000</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Preklici
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSubmitting ? 'Shranjevanje...' : 'Reši mnenje'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
