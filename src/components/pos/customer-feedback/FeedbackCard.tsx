'use client'

// ============================================
// KARTICA POSAMEZNEGA MNENJA GOSTA
// P1-14 (R140-c): status badge (new/in_review/resolved), kontekst mize/
// naročila/vira (snapshoti iz R140-b GET whitelist), resolved-by forenzika
// in akcije 'V obdelavo' / 'Odgovori in reši' (PATCH prek useFeedbackData).
// Varnost: prikazuje SAMO whitelist polja (brez guestId/orderId/PII).
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, ThumbsUp, Sparkles, Eye, CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { StarRating } from './StarRating'
import {
  FEEDBACK_STATUS_BADGES,
  FEEDBACK_STATUS_UNKNOWN,
  FEEDBACK_SOURCE_LABELS,
  parseFeedbackTags,
} from './constants'
import type { FeedbackCardProps } from './constants'

export const FeedbackCard = memo(function FeedbackCard({ fb, onStartReview, onResolve, isBusy }: FeedbackCardProps) {
  // Status (manjkajoče polje = DB default 'new'); badge iz lookup mape z
  // celimi literal razredi (BUG-04 kanon — NIKOLI dinamičnih konkatenacij).
  const status = fb.status ?? 'new'
  const statusCfg = FEEDBACK_STATUS_BADGES[status] ?? FEEDBACK_STATUS_UNKNOWN
  const sourceLabel = fb.source ? (FEEDBACK_SOURCE_LABELS[fb.source] ?? fb.source) : null
  const hasContext = Boolean(fb.tableNumber || fb.orderRef || sourceLabel)
  const canStartReview = status === 'new'
  const canResolve = status !== 'resolved'
  const showActions = Boolean(onStartReview || onResolve) && (canStartReview || canResolve)
  // P1-14 obrambna globina: useFeedbackData ŽE normalizira tags (JSON String
  // → tabela), ampak kartica je zadnja črta obrambe — tuja/stara pot NE SME
  // crashati na fb.tags.map (Runtime ChunkLoad lekcija 12:20). Pure helper.
  const tags = parseFeedbackTags(fb.tags)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{fb.guestName || 'Anonimen gost'}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={fb.overallRating} />
                <span className="text-xs text-muted-foreground">
                  {fb.createdAt ? format(new Date(fb.createdAt), 'd.M.yyyy HH:mm') : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* P1-14: status badge — barvna pariteta z ostalimi badge-i kartice */}
            <Badge className={`${statusCfg.className} text-[9px] h-5`} aria-label={`Status: ${statusCfg.label}`}>
              {statusCfg.label}
            </Badge>
            {fb.wouldReturn && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[9px] h-5">
                <ThumbsUp className="h-2.5 w-2.5 mr-0.5" /> Vrnil se bi
              </Badge>
            )}
            {fb.wouldRecommend && (
              <Badge className="bg-blue-100 text-blue-700 text-[9px] h-5">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Priporoca
              </Badge>
            )}
          </div>
        </div>
        {/* P1-14: kontekst — snapshot št. mize, št. naročila, vir (samo če obstajajo) */}
        {hasContext && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] text-muted-foreground">
            {fb.tableNumber && <span>Miza {fb.tableNumber}</span>}
            {fb.orderRef && <span>Naročilo #{fb.orderRef}</span>}
            {sourceLabel && <span>Vir: {sourceLabel}</span>}
          </div>
        )}
        {/* Kategorije ocen */}
        <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Hrana:</span>
            <StarRating rating={fb.foodRating} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Postrezba:</span>
            <StarRating rating={fb.serviceRating} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Atmosfera:</span>
            <StarRating rating={fb.atmosphereRating} />
          </div>
        </div>
        {/* Komentar */}
        {fb.comment && (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-2 mb-2 italic">
            &ldquo;{fb.comment}&rdquo;
          </p>
        )}
        {/* Oznake */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[9px] h-5">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {/* Odgovor restavracije */}
        {fb.responded && fb.response && (
          <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-2">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Odgovor restavracije:</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">{fb.response}</p>
          </div>
        )}
        {/* P1-14: forenzika rešitve (snapshot iz seje — R140-b) */}
        {status === 'resolved' && (fb.resolvedByName || fb.resolvedAt) && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Rešil: {fb.resolvedByName || '—'}
            {fb.resolvedAt ? ` · ${format(new Date(fb.resolvedAt), 'd.M.yyyy HH:mm')}` : ''}
          </p>
        )}
        {/* P1-14: akcije — V obdelavo (new) + Odgovori in reši (new/in_review) */}
        {showActions && (
          <div className="flex items-center gap-2 mt-3">
            {canStartReview && onStartReview && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                disabled={isBusy}
                onClick={() => onStartReview(fb.id)}
              >
                <Eye className="h-3 w-3" />
                V obdelavo
              </Button>
            )}
            {canResolve && onResolve && (
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                disabled={isBusy}
                onClick={() => onResolve(fb)}
              >
                <CheckCircle2 className="h-3 w-3" />
                Odgovori in reši
              </Button>
            )}
            {isBusy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
