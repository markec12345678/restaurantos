'use client'

import { memo } from 'react'
import { MessageSquare } from 'lucide-react'
import { QUICK_FEEDBACK } from './constants'

interface QuickFeedbackSectionProps {
  selected: string[]
  onToggle: (_text: string) => void
}

export const QuickFeedbackSection = memo(function QuickFeedbackSection({
  selected,
  onToggle,
}: QuickFeedbackSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Hitri odziv</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_FEEDBACK.map(text => (
          <button
            key={text}
            onClick={() => onToggle(text)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selected.includes(text)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
})
