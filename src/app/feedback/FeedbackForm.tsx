'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, UtensilsCrossed } from 'lucide-react'
import { CATEGORIES } from './_components/constants'
import { ThankYouView } from './_components/ThankYouView'
import { CategoryRatingRow } from './_components/CategoryRatingRow'
import { QuickFeedbackSection } from './_components/QuickFeedbackSection'
import { CommentSection } from './_components/CommentSection'

function FeedbackForm() {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('table') || ''
  const locationId = searchParams.get('location') || ''

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [quickFeedback, setQuickFeedback] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const setRating = (category: string, value: number) => {
    setRatings(prev => ({ ...prev, [category]: value }))
  }

  const toggleQuickFeedback = (text: string) => {
    setQuickFeedback(prev =>
      prev.includes(text) ? prev.filter(f => f !== text) : [...prev, text]
    )
  }

  const avgRating = Object.values(ratings).length > 0
    ? Object.values(ratings).reduce((sum, r) => sum + r, 0) / Object.values(ratings).length
    : 0

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings,
          comment: [comment, ...quickFeedback].filter(Boolean).join('. '),
          tableId,
          locationId,
          avgRating,
          source: 'qr_kiosk',
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        // Show error but still show thank you to not frustrate the guest
        setSubmitted(true)
      }
    } catch {
      // Tudi ob napaki pokaži zahvalo
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return <ThankYouView avgRating={avgRating} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">RestaurantOS</span>
          <span className="text-xs text-muted-foreground ml-auto">Vaše mnenje šteje</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">Kako je bilo danes?</h1>
          <p className="text-sm text-muted-foreground">Ocenite svojo izkušnjo in nam pomagajte izboljšati storitev</p>
        </div>

        {/* Category Ratings */}
        <div className="space-y-4">
          {CATEGORIES.map(cat => (
            <CategoryRatingRow
              key={cat.id}
              category={cat}
              currentRating={ratings[cat.id] || 0}
              onSetRating={setRating}
            />
          ))}
        </div>

        {/* Quick Feedback */}
        <QuickFeedbackSection selected={quickFeedback} onToggle={toggleQuickFeedback} />

        {/* Comment */}
        <CommentSection value={comment} onChange={setComment} />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={Object.keys(ratings).length === 0 || loading}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Pošiljanje...' : 'Pošlji mnenje'}
        </button>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Mnenje je anonimno in se uporabi izključno za izboljšanje storitve
        </p>
      </div>
    </div>
  )
}

export { FeedbackForm }
