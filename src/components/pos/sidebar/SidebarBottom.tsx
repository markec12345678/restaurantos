'use client'

import { ChefHat, Sun, Moon, Maximize, Minimize, Monitor, ExternalLink, HandMetal } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'

interface SidebarBottomProps {
  isFullscreen: boolean
  toggleFullscreen: () => void
  setKioskMode: (_mode: boolean) => void
  theme: string | undefined
  setTheme: (_theme: string) => void
  mounted: boolean
}

export const SidebarBottom = memo(function SidebarBottom({
  isFullscreen,
  toggleFullscreen,
  setKioskMode,
  theme,
  setTheme,
  mounted,
}: SidebarBottomProps) {
  return (
    <div className="px-2 py-2 border-t border-border space-y-0.5">
      <div className="grid grid-cols-2 gap-1 px-0.5 pb-1">
        <a href="/kds" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors touch-manipulation"
          title="KDS - Kitchen Display System">
          <ChefHat className="h-3 w-3" /> KDS <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a href="/waiter" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors touch-manipulation"
          title="Odpri natakarjevo tablico">
          <HandMetal className="h-3 w-3" /> {t('sidebar.waiter')} <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      <Button variant="ghost" className="w-full justify-start gap-2 text-xs h-8" onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
        {isFullscreen ? t('nav.exitFullscreen') : t('nav.fullscreen')}
      </Button>
      <Button variant="ghost" className="w-full justify-start gap-2 text-xs h-8 touch-manipulation" onClick={() => setKioskMode(true)}>
        <Monitor className="h-3.5 w-3.5" /> {t('nav.kiosk')}
      </Button>
      {mounted && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="flex-1 justify-start gap-2 text-xs h-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
          </Button>
          <LanguageSwitcher />
        </div>
      )}
    </div>
  )
})
