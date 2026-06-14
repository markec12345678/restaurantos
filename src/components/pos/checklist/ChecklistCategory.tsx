'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_LABELS, DEFAULT_CATEGORY_ICON } from './constants'
import type { ChecklistItem } from './types'

// ============================================
// KATEGORIJA KONTROLNEGA SEZNAMA
// Prikazuje seznam opravil za eno kategorijo
// ============================================

interface ChecklistCategoryProps {
  category: string
  items: ChecklistItem[]
  isExpanded: boolean
  onToggleCategory: (_category: string) => void
  onToggleItem: (_itemId: string) => void
}

export const ChecklistCategory = memo(function ChecklistCategory({
  category,
  items,
  isExpanded,
  onToggleCategory,
  onToggleItem,
}: ChecklistCategoryProps) {
  const catCompleted = items.filter(i => i.completed).length
  const CatIcon = CATEGORY_ICONS[category] || DEFAULT_CATEGORY_ICON
  const catAllDone = catCompleted === items.length

  return (
    <Card className={catAllDone ? 'border-emerald-200 dark:border-emerald-800' : ''}>
      <CardHeader
        className="p-3 pb-0 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => onToggleCategory(category)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCategory(category) } }}
      >
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
              onClick={() => onToggleItem(item.id)}
              aria-label={`${item.completed ? 'Odznači' : 'Označi'}: ${item.task}`}
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
})
