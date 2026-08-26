'use client'

// ============================================
// KARTICA POSAMEZNEGA MNENJA GOSTA
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, ThumbsUp, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { StarRating } from './StarRating'
import type { FeedbackCardProps } from './constants'

export const FeedbackCard = memo(function FeedbackCard({ fb }: FeedbackCardProps) {
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
        {fb.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fb.tags.map((tag: string) => (
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
      </CardContent>
    </Card>
  )
})
