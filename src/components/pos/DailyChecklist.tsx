'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Dnevni kontrolni seznam
// Jolt + HotSchedules + Toast standard
// Odpiralni in zapiralni checklist za osebje
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CheckCircle2, Circle, Clock, Sun, Moon, ChevronDown, ChevronUp, Save, RotateCcw, ClipboardCheck, Coffee, UtensilsCrossed, CreditCard, ShieldCheck, Building, Sparkles } from 'lucide-react'
import { useState, memo } from 'react'
import { toast } from 'sonner'

interface ChecklistItem {
  id: string
  task: string
  category: string
  completed: boolean
  completedBy?: string
  completedAt?: string
  notes?: string
}

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  sistemi: CreditCard,
  blagajna: CreditCard,
  kuhinja: UtensilsCrossed,
  bár: Coffee,
  čistost: Sparkles,
  jedilnica: Building,
  rezervacije: Clock,
  varnost: ShieldCheck,
}

const CATEGORY_LABELS: Record<string, string> = {
  sistemi: 'Sistemi',
  blagajna: 'Blagajna',
  kuhinja: 'Kuhinja',
  bár: 'Bar',
  čistost: 'Čistost',
  jedilnica: 'Jedilnica',
  rezervacije: 'Rezervacije',
  varnost: 'Varnost',
}

export const DailyChecklist = memo(function DailyChecklist() {
  const queryClient = useQueryClient()
  const [type, setType] = useState<'opening' | 'closing'>('opening')
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<ChecklistItem>>>({})
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isLoaded, setIsLoaded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.dailyChecklist.all, type],
    queryFn: async () => {
      const res = await authFetch(`/api/daily-checklist?type=${type}`)
      return res.json()
    },
  })

  // Derive checklist from query data merged with local edits
  const checklist: ChecklistItem[] = (data?.checklist ?? []).map((item: ChecklistItem) =>
    localEdits[item.id] ? { ...item, ...localEdits[item.id] } : item
  )

  // Initialize expanded categories once when data loads
  if (data?.checklist && !isLoaded && data.checklist.length > 0) {
    setExpandedCategories(new Set(data.checklist.map((i: ChecklistItem) => i.category)))
    setIsLoaded(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (items: ChecklistItem[]) => {
      const res = await authFetch('/api/daily-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date: new Date().toISOString().split('T')[0],
          checklist: items,
        }),
      })
      return res.json()
    },
    onSuccess: (result) => {
      toast.success(result.status === 'completed' ? 'Kontrolni seznam zaključen!' : 'Napredek shranjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyChecklist.all })
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  const toggleItem = (itemId: string) => {
    const current = checklist.find(i => i.id === itemId)
    if (!current) return
    const newCompleted = !current.completed
    setLocalEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        completed: newCompleted,
        completedBy: newCompleted ? 'current_user' : undefined,
        completedAt: newCompleted ? new Date().toISOString() : undefined,
      }
    }))
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const completedCount = checklist.filter(i => i.completed).length
  const totalCount = checklist.length
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Group by category (derived directly, no memo needed for small lists)
  const grouped: Record<string, ChecklistItem[]> = {}
  for (const item of checklist) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }

  const allCompleted = completedCount === totalCount && totalCount > 0

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Kontrolni seznam
          </h2>
          <p className="text-sm text-muted-foreground">
            {type === 'opening' ? 'Odpiralni' : 'Zapiralni'} seznam za {new Date().toLocaleDateString('sl-SI')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={type === 'opening' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setType('opening'); setIsLoaded(false); setLocalEdits({}) }}
            className="gap-1"
          >
            <Sun className="h-3 w-3" /> Odpiranje
          </Button>
          <Button
            variant={type === 'closing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setType('closing'); setIsLoaded(false); setLocalEdits({}) }}
            className="gap-1"
          >
            <Moon className="h-3 w-3" /> Zapiranje
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card className={allCompleted ? 'border-emerald-400 dark:border-emerald-700' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {allCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Clock className="h-5 w-5 text-amber-500" />
              )}
              <span className="font-bold">
                {allCompleted ? 'Zaključeno!' : `${completedCount}/${totalCount} opravljenih`}
              </span>
            </div>
            <Badge variant={allCompleted ? 'default' : 'secondary'}>
              {progressPct.toFixed(0)}%
            </Badge>
          </div>
          <Progress value={progressPct} className={`h-2 ${allCompleted ? '[&>div]:bg-emerald-500' : ''}`} aria-valuetext={allCompleted ? 'Zaključeno' : 'V teku'} />
        </CardContent>
      </Card>

      {/* Checklist by Category */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, items]) => {
          const isExpanded = expandedCategories.has(category)
          const catCompleted = items.filter(i => i.completed).length
          const catIcon = CATEGORY_ICONS[category] || CheckCircle2
          const CatIcon = catIcon
          const catAllDone = catCompleted === items.length

          return (
            <Card key={category} className={catAllDone ? 'border-emerald-200 dark:border-emerald-800' : ''}>
              <CardHeader className="p-3 pb-0 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedCategories.has(category)} onClick={() => toggleCategory(category)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(category) } }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CatIcon className={`h-4 w-4 ${catAllDone ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    <CardTitle className="text-sm font-semibold">
                      {CATEGORY_LABELS[category] || category}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {catCompleted}/{items.length}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-3 pt-2 space-y-1">
                  {items.map(item => (
                    <button
                      key={item.id}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                        item.completed
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 opacity-75'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.task}
                      </span>
                      {item.completedAt && (
                        <span className="text-[9px] text-muted-foreground ml-auto flex-shrink-0">
                          {new Date(item.completedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </button>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate(checklist)}
          disabled={saveMutation.isPending}
          className="gap-1 flex-1"
        >
          <Save className="h-4 w-4" />
          {allCompleted ? 'Zaključi seznam' : 'Shrani napredek'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setLocalEdits(Object.fromEntries(checklist.map(i => [i.id, { completed: false, completedBy: undefined, completedAt: undefined }])))
          }}
          className="gap-1"
        >
          <RotateCcw className="h-4 w-4" />
          Ponastavi
        </Button>
      </div>
    </div>
  )
})
