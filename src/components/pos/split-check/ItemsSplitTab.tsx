'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { DialogFooter } from '@/components/ui/dialog'
import { Receipt, Plus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle2 } from 'lucide-react'
import type { ItemsSplitTabProps } from './constants'

export const ItemsSplitTab = memo(function ItemsSplitTab({
  partyTotals,
  parties,
  onSetParties,
  cartItems,
  unassignedItems,
  onAddParty,
  onRemoveParty,
  onAssignItemToParty,
  onUnassignItem,
  onSetPartyTip,
  onTogglePartyPayment,
  onClose,
  onConfirmItems,
}: ItemsSplitTabProps) {
  return (
    <div className="space-y-4">
      {/* Stranke */}
      <div className="space-y-3">
        {partyTotals.map((party) => (
          <Card key={party.id} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Input
                  value={party.name}
                  onChange={(e) => onSetParties(prev => prev.map(p =>
                    p.id === party.id ? { ...p, name: e.target.value } : p
                  ))}
                  className="h-7 w-32 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                  aria-label="Ime stranke"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">€{party.total.toFixed(2)}</span>
                {parties.length > 1 && (
                  <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-6 w-6" onClick={() => onRemoveParty(party.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
            <CardContent className="p-3">
              {/* Dodeljeni artikli */}
              {party.items.length > 0 ? (
                <div className="space-y-1 mb-2">
                  {cartItems.filter(item => party.items.includes(item.id)).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                      <span>{item.quantity}x {item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                        <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-5 w-5" onClick={() => onUnassignItem(item.id)}>
                          <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Izberi artikle spodaj</p>
              )}
              {/* Napitnina za to stranko */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">Napitnina:</span>
                {[0, 5, 10, 15, 20].map(pct => (
                  <Button
                    key={pct}
                    variant={party.tipPercent === pct ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => onSetPartyTip(party.id, pct)}
                  >
                    {pct}%
                  </Button>
                ))}
              </div>
              {/* Način plačila */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">Plačilo:</span>
                {[
                  { method: 'card' as const, icon: <CreditCard className="h-3 w-3" />, label: 'Kartica' },
                  { method: 'cash' as const, icon: <Banknote className="h-3 w-3" />, label: 'Gotovina' },
                  { method: 'mobile' as const, icon: <Smartphone className="h-3 w-3" />, label: 'Mobilno' },
                ].map(({ method, icon, label }) => (
                  <Button
                    key={method}
                    variant={party.paymentMethod === method ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1"
                    onClick={() => onTogglePartyPayment(party.id, method)}
                  >
                    {icon} {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" onClick={onAddParty} className="w-full gap-1.5">
          <Plus className="h-4 w-4" />
          Dodaj osebo
        </Button>
      </div>
      {/* Nedodeljeni artikli */}
      {unassignedItems.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Nedodeljeni artikli ({unassignedItems.length})
          </h4>
          <div className="space-y-1">
            {unassignedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
                <span>{item.quantity}x {item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                  <div className="flex gap-1">
                    {parties.map(party => (
                      <Button
                        key={party.id}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => onAssignItemToParty(item.id, party.id)}
                      >
                        → {party.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Prekliči</Button>
        <Button onClick={onConfirmItems} className="gap-1.5" disabled={unassignedItems.length > 0}>
          <CheckCircle2 className="h-4 w-4" />
          Potrdi delitev ({parties.length} oseb)
        </Button>
      </DialogFooter>
    </div>
  )
})
