'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ModifiersTabProps, ModifierGroupData } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// TAB DODATKOV (modifier groups)
// ============================================
export const ModifiersTab = memo(function ModifiersTab({
  modifierGroups,
}: ModifiersTabProps) {
  // FIX TypeError: b?.filter is not a function — modifierGroups je lahko undefined
  const groups = Array.isArray(modifierGroups) ? modifierGroups : []
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map((mg: ModifierGroupData) => {
        // FIX: Array.isArray za mg.modifiers in mg.menuItems
        const modifiers = Array.isArray(mg.modifiers) ? mg.modifiers : []
        const menuItems = Array.isArray(mg.menuItems) ? mg.menuItems : []
        return (
        <Card key={mg.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{mg.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {mg.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                  {mg.maxSelect && <Badge variant="outline" className="text-[9px] h-4 px-1">Max {mg.maxSelect}</Badge>}
                  {!mg.required && mg.minSelect === 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">Izbirno</Badge>}
                </div>
              </div>
              <Badge variant="outline">{modifiers.length} opcij</Badge>
            </div>
            <div className="space-y-1">
              {modifiers.map((mod) => (
                <div key={mod.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
                  <span>{mod.name}</span>
                  {mod.price > 0 && <span className="text-primary font-medium">+€{safeToFixed(mod.price, 2)}</span>}
                </div>
              ))}
            </div>
            {menuItems.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Uporabljeno pri:</p>
                <div className="flex flex-wrap gap-0.5">
                  {menuItems.map((mi) => (
                    <Badge key={mi.menuItem.id} variant="outline" className="text-[9px] h-4 px-1">
                      {mi.menuItem.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
})
