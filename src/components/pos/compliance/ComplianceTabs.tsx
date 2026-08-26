'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Calendar } from 'lucide-react'
import { statusConfig, categoryConfig } from './constants'
import type { ComplianceTabsProps, ComplianceItem } from './constants'

// Ena kartica postavke skladnosti
function ComplianceItemCard({ item }: { item: ComplianceItem }) {
  const statusConf = statusConfig[item.status]
  const StatusIcon = statusConf.icon
  const catConf = categoryConfig[item.category]
  const CatIcon = catConf.icon

  return (
    <Card className={`transition-all ${item.status === 'non-compliant' ? 'border-red-300 dark:border-red-800' : item.status === 'warning' ? 'border-amber-300 dark:border-amber-800' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <CatIcon className={`h-5 w-5 mt-0.5 ${catConf.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{item.title}</span>
              <Badge className={statusConf.color}>
                <StatusIcon className="h-3 w-3 mr-1" /> {statusConf.label}
              </Badge>
              <Badge variant="outline" className="text-xs">{item.regulation}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Zadnje preverjanje: {new Date(item.lastChecked).toLocaleDateString('sl-SI')}
              </span>
              {item.dueDate && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Rok: {new Date(item.dueDate).toLocaleDateString('sl-SI')}
                </span>
              )}
            </div>

            {item.actionRequired && (
              <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Potrebno dejanje: {item.actionRequired}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Zavihki s postavkami skladnosti po kategorijah
export const ComplianceTabs = memo(function ComplianceTabs({
  items,
}: ComplianceTabsProps) {
  return (
    <Tabs defaultValue="all" className="space-y-3">
      <TabsList>
        <TabsTrigger value="all">Vse ({items.length})</TabsTrigger>
        {Object.entries(categoryConfig).map(([key, conf]) => (
          <TabsTrigger key={key} value={key}>
            {conf.label} ({items.filter(i => i.category === key).length})
          </TabsTrigger>
        ))}
      </TabsList>

      {['all', ...Object.keys(categoryConfig)].map(tabKey => (
        <TabsContent key={tabKey} value={tabKey} className="space-y-2">
          {items
            .filter(i => tabKey === 'all' || i.category === tabKey)
            .map(item => (
              <ComplianceItemCard key={item.id} item={item} />
            ))}
        </TabsContent>
      ))}
    </Tabs>
  )
})
