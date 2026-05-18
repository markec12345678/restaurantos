'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Customer Feedback System
// Zbiranje povratnih informacij po obisku, ocene, komentarji
// Toast POS + OpenTable standard za feedback gostov
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Star, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp,
  Send, Filter, BarChart3, Users, Clock, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, Sparkles, Frown, Meh, Smile, Zap,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

// ─── Tipi ──────────────────────────────────────────────────────
interface FeedbackEntry {
  id: string
  guestId?: string
  guestName: string
  orderId?: string
  orderNumber?: number
  overallRating: number // 1-5
  foodRating: number
  serviceRating: number
  atmosphereRating: number
  comment: string
  wouldReturn: boolean
  wouldRecommend: boolean
  tags: string[]
  createdAt: string
  responded: boolean
  response?: string
}

// ─── Emotikon za oceno ──────────────────────────────────────────
function RatingEmoji({ rating }: { rating: number }) {
  if (rating >= 4) return <Smile className="h-5 w-5 text-emerald-500" />
  if (rating >= 3) return <Meh className="h-5 w-5 text-amber-500" />
  return <Frown className="h-5 w-5 text-red-500" />
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${sz} ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )
}

// ─── Povratne oznake ────────────────────────────────────────────
const FEEDBACK_TAGS = [
  'Odlična hrana', 'Hitra postrežba', 'Prijetna atmosfera',
  'Prijazno osebje', 'Čisto', 'Dobra vinska karta',
  'Predolgo čakanje', 'Hlada hrana', 'Glasno',
  'Drago', 'Majhne porcije', 'Nečisto',
]

const PIE_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981']

// ─── Glavna komponenta ──────────────────────────────────────────
export function CustomerFeedback() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'overview' | 'list' | 'new'>('overview')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [filterRating, setFilterRating] = useState('all')
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null)

  // Nov feedback form
  const [newFeedback, setNewFeedback] = useState<{
    guestName: string
    overallRating: number
    foodRating: number
    serviceRating: number
    atmosphereRating: number
    comment: string
    wouldReturn: boolean
    wouldRecommend: boolean
    tags: string[]
  }>({
    guestName: '',
    overallRating: 0,
    foodRating: 0,
    serviceRating: 0,
    atmosphereRating: 0,
    comment: '',
    wouldReturn: true,
    wouldRecommend: true,
    tags: [],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['feedback'],
    queryFn: async () => {
      const res = await authFetch('/api/guests/feedback')
      if (!res.ok) {
        // Če endpoint še ne obstaja, vrnemo prazne podatke
        return { feedbacks: [], stats: { avgRating: 0, total: 0, nps: 0 } }
      }
      return res.json()
    },
  })

  const feedbacks: FeedbackEntry[] = data?.feedbacks || []
  const stats = data?.stats || { avgRating: 0, total: 0, nps: 0 }

  // Filtirani feedbacki
  const filteredFeedbacks = useMemo(() => {
    if (filterRating === 'all') return feedbacks
    const rating = parseInt(filterRating)
    return feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating)
  }, [feedbacks, filterRating])

  // Povprečne ocene
  const avgRatings = useMemo(() => {
    if (feedbacks.length === 0) return { overall: 0, food: 0, service: 0, atmosphere: 0 }
    return {
      overall: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.overallRating, 0) / feedbacks.length,
      food: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.foodRating, 0) / feedbacks.length,
      service: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.serviceRating, 0) / feedbacks.length,
      atmosphere: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.atmosphereRating, 0) / feedbacks.length,
    }
  }, [feedbacks])

  // Distribucija ocen za graf
  const ratingDistribution = useMemo(() => {
    const dist = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating).length,
    }))
    return dist
  }, [feedbacks])

  // NPS izračun
  const nps = useMemo(() => {
    if (feedbacks.length === 0) return 0
    const promoters = feedbacks.filter((f: FeedbackEntry) => f.overallRating >= 4).length
    const detractors = feedbacks.filter((f: FeedbackEntry) => f.overallRating <= 2).length
    return Math.round(((promoters - detractors) / feedbacks.length) * 100)
  }, [feedbacks])

  // Shrani nov feedback
  const createFeedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/guests/feedback', {
        method: 'POST',
        body: JSON.stringify(newFeedback),
      })
      if (!res.ok) throw new Error('Failed to create feedback')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Povratna informacija shranjena!')
      setShowNewDialog(false)
      setNewFeedback({
        guestName: '', overallRating: 0, foodRating: 0, serviceRating: 0,
        atmosphereRating: 0, comment: '', wouldReturn: true, wouldRecommend: true, tags: [],
      })
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
    },
    onError: () => {
      toast.error('Napaka pri shranjevanju povratne informacije')
    },
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Mnenja gostov</h1>
          <Badge variant="outline" className="text-xs">{feedbacks.length} mnenj</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewDialog(true)}>
          <Send className="h-3.5 w-3.5" />
          Novo mnenje
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <MessageSquare className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium">Še ni mnenj gostov</p>
              <p className="text-sm">Dodaj prvo mnenje za sledenje kakovosti</p>
            </div>
            <Button onClick={() => setShowNewDialog(true)} className="gap-1.5">
              <Send className="h-4 w-4" />
              Dodaj mnenje
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <RatingEmoji rating={avgRatings.overall} />
                  <p className="text-2xl font-bold mt-1">{avgRatings.overall.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">Skupna ocena</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Star className="h-5 w-5 text-amber-400 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{avgRatings.food.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">Hrana</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Zap className="h-5 w-5 text-blue-400 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{avgRatings.service.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">Postrežba</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-5 w-5 text-emerald-400 mx-auto" />
                  <p className="text-2xl font-bold mt-1">{nps}</p>
                  <p className="text-[10px] text-muted-foreground">NPS</p>
                </CardContent>
              </Card>
            </div>

            {/* Rating Distribution Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribucija ocen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="rating" tick={{ fontSize: 11 }} label={{ value: 'Ocena', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Število" radius={[4, 4, 0, 0]}>
                        {ratingDistribution.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Filtriraj:</span>
              {['all', '5', '4', '3', '2', '1'].map(val => (
                <Button
                  key={val}
                  variant={filterRating === val ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setFilterRating(val)}
                >
                  {val === 'all' ? 'Vse' : `${val} ⭐`}
                </Button>
              ))}
            </div>

            {/* Feedback List */}
            <div className="space-y-3">
              {filteredFeedbacks.map((fb: FeedbackEntry) => (
                <Card key={fb.id} className="overflow-hidden">
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
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Priporoča
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Category ratings */}
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Hrana:</span>
                        <StarRating rating={fb.foodRating} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Postrežba:</span>
                        <StarRating rating={fb.serviceRating} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Atmosfera:</span>
                        <StarRating rating={fb.atmosphereRating} />
                      </div>
                    </div>

                    {/* Comment */}
                    {fb.comment && (
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-2 mb-2 italic">
                        "{fb.comment}"
                      </p>
                    )}

                    {/* Tags */}
                    {fb.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fb.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[9px] h-5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Response indicator */}
                    {fb.responded && fb.response && (
                      <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-2">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Odgovor restavracije:</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">{fb.response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New Feedback Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Novo mnenje gosta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ime gosta</label>
              <Input
                value={newFeedback.guestName}
                onChange={e => setNewFeedback(prev => ({ ...prev, guestName: e.target.value }))}
                placeholder="Ime in priimek"
                className="mt-1"
              />
            </div>

            {/* Ratings */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'overallRating', label: 'Skupna ocena' },
                { key: 'foodRating', label: 'Hrana' },
                { key: 'serviceRating', label: 'Postrežba' },
                { key: 'atmosphereRating', label: 'Atmosfera' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setNewFeedback(prev => ({ ...prev, [key]: n }))}
                        className="p-0.5"
                      >
                        <Star className={`h-6 w-6 transition-colors ${
                          n <= (newFeedback as any)[key]
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 hover:text-amber-300'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Would return / recommend */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setNewFeedback(prev => ({ ...prev, wouldReturn: !prev.wouldReturn }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  newFeedback.wouldReturn
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Vrnil se bi
              </button>
              <button
                onClick={() => setNewFeedback(prev => ({ ...prev, wouldRecommend: !prev.wouldRecommend }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  newFeedback.wouldRecommend
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Priporočam
              </button>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Oznake</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {FEEDBACK_TAGS.map(tag => {
                  const isSelected = newFeedback.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => setNewFeedback(prev => ({
                        ...prev,
                        tags: isSelected ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
                      }))}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Komentar</label>
              <Textarea
                value={newFeedback.comment}
                onChange={e => setNewFeedback(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Kaj je gost dejal..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Prekliči</Button>
            <Button
              onClick={() => createFeedbackMutation.mutate()}
              disabled={newFeedback.overallRating === 0}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Shrani mnenje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
