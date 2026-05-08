'use client'

import { usePOSStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  BarChartBig,
  UtensilsCrossed,
  Package,
  Users,
  BarChart3,
  Database,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'tables', label: 'Tables', icon: BarChartBig },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
]

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen } = usePOSStore()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Seed failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Demo data seeded successfully! Refresh to see updates.')
      setTimeout(() => window.location.reload(), 1000)
    },
    onError: () => {
      toast.error('Failed to seed demo data')
    },
  })

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex flex-col w-64 bg-card border-r border-border transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            R
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">RestaurantOS</h1>
            <p className="text-xs text-muted-foreground">Point of Sale</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeModule === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id)
                  setSidebarOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-border space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Database className="h-4 w-4" />
            {seedMutation.isPending ? 'Seeding...' : 'Seed Demo Data'}
          </Button>

          {mounted && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
