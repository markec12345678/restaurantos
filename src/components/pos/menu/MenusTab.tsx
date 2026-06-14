'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import type { MenusTabProps } from './constants'

// ============================================
// TAB MENIJEV
// ============================================
export const MenusTab = memo(function MenusTab({
  menus,
  categories,
  onAddMenu,
}: MenusTabProps) {
  return (
    <>
      <Button onClick={onAddMenu}>
        <Plus className="h-4 w-4 mr-2" />
        Dodaj meni
      </Button>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {menus?.map((menu) => {
          const menuCategories = categories?.filter((c) =>
            (c.menu?.id || c.menuId) === menu.id
          ) || []
          return (
            <Card key={menu.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: `${menu.color}20` }}
                  >
                    {menu.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{menu.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{menuCategories.length} kategorij</Badge>
                      <Badge variant={menu.isActive ? 'default' : 'secondary'}>
                        {menu.isActive ? 'Aktiven' : 'Neaktiven'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {menuCategories.map((cat) => (
                    <Badge key={cat.id} variant="outline" className="text-xs">
                      {cat.icon} {cat.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
})
