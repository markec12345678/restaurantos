'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

// ============================================
// KEYBOARD SHORTCUTS DIALOG — Prikaz vseh bližnjic
// ============================================
// Trigger: ? (vprašaj) ali Cmd+/ (Mac) / Ctrl+/ (Windows)
//
// Prikaze vse razpoložljive keyboard shortcuts v sistemu.
// ============================================

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const SHORTCUTS: Shortcut[] = [
  // ─── Global ───
  { keys: ['Ctrl', 'K'], description: 'Odpri ukazno paleto (Command Palette)', category: 'Globalno' },
  { keys: ['Ctrl', '/'], description: 'Prikaži bližnjice (ta dialog)', category: 'Globalno' },
  { keys: ['Esc'], description: 'Zapri dialog / prekliči akcijo', category: 'Globalno' },
  { keys: ['Enter'], description: 'Potrdi akcijo', category: 'Globalno' },

  // ─── Navigacija ───
  { keys: ['Ctrl', '1'], description: 'Prodaja (POS)', category: 'Navigacija' },
  { keys: ['Ctrl', '2'], description: 'Kuhinja (KDS)', category: 'Navigacija' },
  { keys: ['Ctrl', '3'], description: 'Mize', category: 'Navigacija' },
  { keys: ['Ctrl', '4'], description: 'Blagajna', category: 'Navigacija' },
  { keys: ['Ctrl', '5'], description: 'Nadzorna plošča', category: 'Navigacija' },

  // ─── POS akcije ───
  { keys: ['Ctrl', 'N'], description: 'Novo naročilo', category: 'POS' },
  { keys: ['Ctrl', 'P'], description: 'Plačaj (odpri plačilni dialog)', category: 'POS' },
  { keys: ['Ctrl', 'B'], description: 'Bump naročilo (KDS)', category: 'POS' },
  { keys: ['Ctrl', 'D'], description: 'Dodaj artikle k naročilu', category: 'POS' },
  { keys: ['Ctrl', 'V'], description: 'Poniči (void) artikli', category: 'POS' },
  { keys: ['Ctrl', 'S'], description: 'Shrani / razdeli račun', category: 'POS' },

  // ─── Iskanje ───
  { keys: ['/'], description: 'Fokus na iskalno polje', category: 'Iskanje' },
  { keys: ['Ctrl', 'F'], description: 'Iskanje artiklov', category: 'Iskanje' },

  // ─── KDS ───
  { keys: ['Space'], description: 'Bump naslednje pripravljeno naročilo', category: 'KDS' },
  { keys: ['↑', '↓'], description: 'Navigacija med naročili', category: 'KDS' },
  { keys: ['Enter'], description: 'Odpri podrobnosti naročila', category: 'KDS' },
]

const CATEGORIES = ['Globalno', 'Navigacija', 'POS', 'Iskanje', 'KDS'] as const

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ? ali Ctrl+/ / Cmd+/
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setOpen(prev => !prev)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto smooth-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Bližnjice na tipkovnici
          </DialogTitle>
          <DialogDescription>
            Uporabljajte te bližnjice za hitrejše delo v RestaurantOS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {CATEGORIES.map(category => {
            const shortcuts = SHORTCUTS.filter(s => s.category === category)
            if (shortcuts.length === 0) return null
            return (
              <div key={category}>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && <span className="text-muted-foreground text-xs">+</span>}
                            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded-md shadow-sm min-w-[24px] text-center">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
          Pritisnite <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">?</kbd> kadarkoli za prikaz tega dialoga.
        </div>
      </DialogContent>
    </Dialog>
  )
}
