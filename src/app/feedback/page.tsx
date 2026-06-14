'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Javna stran za mnenja gostov
// Toast POS + SevenRooms + OpenTable standard
// QR kiosk za ocenjevanje, brez avtentikacije
// ═══════════════════════════════════════════════════════════════

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Star, Send, CheckCircle2, UtensilsCrossed,
  MessageSquare, ThumbsUp, ThumbsDown, Coffee, Loader2,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'food', label: 'Hrana', icon: Coffee },
  { id: 'service', label: 'Storitev', icon: ThumbsUp },
  { id: 'ambience', label: 'Ambient', icon: UtensilsCrossed },
  { id: 'cleanliness', label: 'Čistost', icon: Star },
  { id: 'value', label: 'Vrednost', icon: ThumbsDown },
]

const QUICK_FEEDBACK = [
  'Odlična hrana!',
  'Zelo prijazno osebje',
  'Predolgo čakanje',
  'Hrana je bila hladna',
  'Čista in prijetna',
  'Previsoka cena',
  'Priporočam prijateljem',
  'Vrnem se znova',
]

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Hvala za vaše mnenje!</h1>
          <p className="text-muted-foreground">Vaše povratne informacije nam pomagajo izboljšati storitev. Veseli bomo vašega naslednjega obiska!</p>
          <div className="flex items-center justify-center gap-1 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-6 w-6 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
            ))}
          </div>
        </div>
      </div>
    )
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
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon
            const currentRating = ratings[cat.id] || 0
            return (
              <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(cat.id, star)}
                      className="p-1 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star className={`h-8 w-8 transition-colors ${
                        star <= currentRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'
                      }`} />
                    </button>
                  ))}
                  {currentRating > 0 && (
                    <span className="text-sm font-medium ml-2 text-amber-600">
                      {currentRating === 1 ? 'Slabo' : currentRating === 2 ? 'Slabše' : currentRating === 3 ? 'V redu' : currentRating === 4 ? 'Dobro' : 'Odlično'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Feedback */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Hitri odziv</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_FEEDBACK.map(text => (
              <button
                key={text}
                onClick={() => toggleQuickFeedback(text)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  quickFeedback.includes(text)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Vaše sporočilo</span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Povejte nam več o vaši izkušnji..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <FeedbackForm />
    </Suspense>
  )
}
