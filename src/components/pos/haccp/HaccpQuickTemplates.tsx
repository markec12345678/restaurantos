'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Activity } from 'lucide-react'
import { quickTemplates } from './constants'

interface HaccpQuickTemplatesProps {
  activeTab: string
  onCreate: (_category?: string, _title?: string, _value?: string) => void
}

export const HaccpQuickTemplates = memo(function HaccpQuickTemplates({
  activeTab,
  onCreate,
}: HaccpQuickTemplatesProps) {
  const templates = activeTab !== 'all' ? quickTemplates[activeTab] : null
  if (!templates) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Hitri vnos — predloge
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => onCreate(tpl.category, tpl.title, tpl.value)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {tpl.title}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
