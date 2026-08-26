'use client'

// ─── Order Panel header z zavihki ──────────────────────────────
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShoppingBag, Clock, Keyboard } from 'lucide-react'

export interface OrderHeaderProps {
  mainTab: string
  onMainTabChange: (_tab: string) => void
  onShortcutsOpen: () => void
}

export const OrderHeader = memo(function OrderHeader({
  mainTab,
  onMainTabChange,
  onShortcutsOpen,
}: OrderHeaderProps) {
  return (
    <div className="flex items-center border-b border-border bg-card px-4 h-11 flex-shrink-0">
      <Tabs value={mainTab} onValueChange={onMainTabChange} className="w-full">
        <TabsList className="h-8 bg-transparent p-0 gap-4">
          <TabsTrigger value="new-order" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
            <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
            Novo naročilo
          </TabsTrigger>
          <TabsTrigger value="order-list" className="h-8 px-0 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Seznam naročil
          </TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" aria-label="Ključ" className="h-7 w-7 ml-auto" onClick={onShortcutsOpen} title="Tipkovne bližnjice">
          <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </Tabs>
    </div>
  )
})
