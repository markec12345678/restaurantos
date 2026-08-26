'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Search, Settings2 } from 'lucide-react'
import React from 'react'

interface ConfigHeaderProps {
  onOpenCreate: () => void
}

export const ConfigHeader = memo(function ConfigHeader({ onOpenCreate }: ConfigHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" /> Konfiguracija
        </h2>
        <p className="text-muted-foreground">Upravljanje vseh nastavitev restavracije na enem mestu</p>
      </div>
      <Button onClick={onOpenCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
    </div>
  )
})

interface ConfigSearchBarProps {
  search: string
  onSearchChange: (_value: string) => void
  filteredCount: number
}

export const ConfigSearchBar = memo(function ConfigSearchBar({ search, onSearchChange, filteredCount }: ConfigSearchBarProps) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Išči..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
      </div>
      <Badge variant="outline" className="text-xs">
        {filteredCount} {filteredCount === 1 ? 'zapis' : filteredCount === 2 ? 'zapisa' : (filteredCount < 5 ? 'zapisi' : 'zapisov')}
      </Badge>
    </div>
  )
})

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  isEditing: boolean
  tabLabel: string
  isPending: boolean
  onSubmit: () => void
  children: React.ReactNode
}

export const ConfigDialog = memo(function ConfigDialog({
  open, onOpenChange, isEditing, tabLabel, isPending, onSubmit, children,
}: ConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Uredi: ${tabLabel}` : `Dodaj: ${tabLabel}`}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Shranjujem...' : isEditing ? 'Posodobi' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
