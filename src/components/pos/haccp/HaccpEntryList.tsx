'use client'

import { memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { tabItems } from './constants'
import type { HaccpEntry } from './types'
import { HaccpQuickTemplates } from './HaccpQuickTemplates'
import { HaccpEntryCard } from './HaccpEntryCard'
import { HaccpEmptyState } from './HaccpEmptyState'

interface HaccpEntryListProps {
  activeTab: string
  onTabChange: (_tab: string) => void
  filteredEntries: HaccpEntry[]
  allEntriesCount: number
  expandedEntry: string | null
  onToggleExpand: (_id: string) => void
  onEdit: (_entry: HaccpEntry) => void
  onDelete: (_entry: HaccpEntry) => void
  onCreate: (_presetCategory?: string, _presetTitle?: string, _presetValue?: string) => void
  dateFrom: string
  dateTo: string
}

export const HaccpEntryList = memo(function HaccpEntryList({
  activeTab,
  onTabChange,
  filteredEntries,
  allEntriesCount,
  expandedEntry,
  onToggleExpand,
  onEdit,
  onDelete,
  onCreate,
  dateFrom,
  dateTo,
}: HaccpEntryListProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
        {tabItems.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs">
              <Icon className="h-3.5 w-3.5 hidden sm:block" />
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {tabItems.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-4 mt-4">
          {/* Hitre predloge */}
          <HaccpQuickTemplates
            activeTab={activeTab}
            onCreate={onCreate}
          />

          {/* Seznam vnosov */}
          {filteredEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEntries.map((entry) => (
                <HaccpEntryCard
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntry === entry.id}
                  onToggle={() => onToggleExpand(entry.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ) : (
            <HaccpEmptyState
              activeTab={activeTab}
              onCreate={onCreate}
            />
          )}

          {/* Število vnosov */}
          {filteredEntries.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>Prikazanih {filteredEntries.length} od {allEntriesCount} vnosov</span>
              {(dateFrom || dateTo) && (
                <span>Filter: {dateFrom && `od ${dateFrom}`} {dateTo && `do ${dateTo}`}</span>
              )}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
})
