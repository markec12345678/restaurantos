'use client'

import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'
import type { WasteLogTabProps } from './constants'

// ============================================
// DNEVNIK ODPADKOV — realni ledger + razveljavitev (R119)
// ============================================
// Ledger vrstica se NIKOLI ne briše; razveljavitev = kompenzacijski 'return'
// na strežniku (zaloga se vrne, reversedAt označba ostane za revizijo).
export const WasteLogTab = memo(function WasteLogTab({
  entries,
  formatCurrency: fmtCurrency,
  onReversed,
}: WasteLogTabProps) {
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const reverse = async (id: string) => {
    setReversingId(id)
    try {
      const res = await authFetch(`/api/waste/${id}/reverse`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Odpad razveljavljen — zaloga je vrnjena')
        onReversed()
      } else {
        toast.error(data.error || 'Napaka pri razveljavitvi')
      }
    } catch {
      toast.error('Napaka pri razveljavitvi')
    } finally {
      setReversingId(null)
      setPendingId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Ni zabeleženih odpadkov v izbranem obdobju.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <Card key={entry.id} className={entry.reversedAt ? 'opacity-60' : ''}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{entry.itemName}</span>
                  <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                  <Badge variant="secondary" className="text-xs">{entry.reasonLabel}</Badge>
                  {entry.reversedAt && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Razveljavljeno</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{entry.quantity} {entry.unit}</span>
                  <span>·</span>
                  <span>{new Date(entry.date).toLocaleDateString('sl-SI')} {new Date(entry.date).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>
                  {entry.note && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-48" title={entry.note}>{entry.note}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <p className={`font-medium ${entry.reversedAt ? 'text-muted-foreground line-through' : 'text-red-600'}`}>
                    {fmtCurrency(entry.totalCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.costPerUnit}/{entry.unit || 'en.'}</p>
                </div>
                {!entry.reversedAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Razveljavi odpad: ${entry.itemName}`}
                    disabled={reversingId !== null}
                    onClick={() => setPendingId(entry.id)}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={pendingId !== null} onOpenChange={open => !open && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Razveljavim odpad?</AlertDialogTitle>
            <AlertDialogDescription>
              Količina se vrne v zalogo (kompenzacijski vnos). Zapis ostane v dnevniku z označbo »razveljavljeno«.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              disabled={reversingId !== null}
              onClick={e => {
                e.preventDefault()
                if (pendingId) void reverse(pendingId)
              }}
            >
              {reversingId ? 'Obdelujem…' : 'Razveljavi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
