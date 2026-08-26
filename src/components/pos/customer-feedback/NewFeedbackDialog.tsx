'use client'

// ============================================
// DIALOG ZA NOVO MNENJE GOSTA
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MessageSquare, Star, ThumbsUp, Sparkles, Send } from 'lucide-react'
import { FEEDBACK_TAGS, RATING_FIELDS } from './constants'
import type { NewFeedbackDialogProps } from './constants'

export const NewFeedbackDialog = memo(function NewFeedbackDialog({
  open,
  onOpenChange,
  newFeedback,
  onNewFeedbackChange,
  onSubmit,
  isSubmitting,
}: NewFeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Novo mnenje gosta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="feedback-guest-name" className="text-xs font-medium text-muted-foreground">Ime gosta</label>
            <Input
              id="feedback-guest-name"
              value={newFeedback.guestName}
              onChange={e => onNewFeedbackChange({ ...newFeedback, guestName: e.target.value })}
              placeholder="Ime in priimek"
              className="mt-1"
              autoFocus
            />
          </div>
          {/* Ocene */}
          <div className="grid grid-cols-2 gap-4">
            {RATING_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(n => {
                    const currentRating = Number((newFeedback as unknown as Record<string, unknown>)[key] ?? 0)
                    return (
                      <button
                        key={n}
                        onClick={() => onNewFeedbackChange({ ...newFeedback, [key]: n })}
                        className="p-0.5"
                        aria-label={n <= currentRating ? `${n} od 5 zvezdic` : `Izberi ${n} zvezdic`}
                      >
                        <Star className={`h-6 w-6 transition-colors ${
                          n <= currentRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-500 hover:text-amber-300'
                        }`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Bi se vrnil / priporoca */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNewFeedbackChange({ ...newFeedback, wouldReturn: !newFeedback.wouldReturn })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                newFeedback.wouldReturn
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
              aria-label={newFeedback.wouldReturn ? 'Oznaci: ne bi se vrnil' : 'Oznaci: vrnil se bi'}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Vrnil se bi
            </button>
            <button
              onClick={() => onNewFeedbackChange({ ...newFeedback, wouldRecommend: !newFeedback.wouldRecommend })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                newFeedback.wouldRecommend
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
              aria-label={newFeedback.wouldRecommend ? 'Oznaci: ne priporoca' : 'Oznaci: priporoca'}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Priporocam
            </button>
          </div>
          {/* Oznake */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Oznake</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {FEEDBACK_TAGS.map(tag => {
                const isSelected = newFeedback.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => onNewFeedbackChange({
                      ...newFeedback,
                      tags: isSelected ? newFeedback.tags.filter(t => t !== tag) : [...newFeedback.tags, tag],
                    })}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition border ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-label={isSelected ? `Odstrani oznako ${tag}` : `Dodaj oznako ${tag}`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Komentar */}
          <div>
            <label htmlFor="feedback-comment" className="text-xs font-medium text-muted-foreground">Komentar</label>
            <Textarea
              id="feedback-comment"
              value={newFeedback.comment}
              onChange={e => onNewFeedbackChange({ ...newFeedback, comment: e.target.value })}
              placeholder="Kaj je gost dejal..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Preklici</Button>
          <Button
            onClick={onSubmit}
            disabled={newFeedback.overallRating === 0 || isSubmitting}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Shrani mnenje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
