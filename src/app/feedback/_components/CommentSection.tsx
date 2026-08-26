'use client'

import { memo } from 'react'
import { MessageSquare } from 'lucide-react'

interface CommentSectionProps {
  value: string
  onChange: (_value: string) => void
}

export const CommentSection = memo(function CommentSection({
  value,
  onChange,
}: CommentSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Vaše sporočilo</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Povejte nam več o vaši izkušnji..."
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
})
