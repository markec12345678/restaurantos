'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import type { CategoriesTabProps } from './constants'

// ============================================
// TAB KATEGIJ - organizirane po meniju
// ============================================
export const CategoriesTab = memo(function CategoriesTab({
  menus,
  categories,
  onAddCategory,
}: CategoriesTabProps) {
  // FIX TypeError: b?.filter is not a function — categories in menus sta lahko
  // objekti (API vrača {items:[...]}) ne array-i. Optional chaining ne pompri
  // ker objekti nimajo .filter metode.
  const menusArray = Array.isArray(menus) ? menus : []
  const categoriesArray = Array.isArray(categories) ? categories : []
  return (
    <>
      <Button onClick={onAddCategory}>
        <Plus className="h-4 w-4 mr-2" />
        Dodaj kategorijo
      </Button>
      {menusArray.map((menu) => {
        const menuCategories = categoriesArray.filter((c) =>
          (c.menu?.id || c.menuId) === menu.id
        )
        return (
          <div key={menu.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 rounded-full" style={{ backgroundColor: menu.color }} />
              <h3 className="text-lg font-semibold">{menu.icon} {menu.name}</h3>
              <Badge variant="outline">{menuCategories.length} kategorij</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {menuCategories.map((cat) => (
                <Card key={cat.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{Array.isArray(cat.menuItems) ? cat.menuItems.length : 0} artiklov</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
})
