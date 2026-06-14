'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Split Check Dialog
// Toast POS + Square standard: delitev računa po osebah, artiklih, enakih delih
// Napitnina, auto-gratuity za velike skupine, več načinov plačila
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Split, Equal, Receipt, Calculator, PartyPopper, AlertTriangle } from 'lucide-react'
import type { SplitCheckDialogProps, SplitMode } from './split-check/constants'
import { useSplitCheck } from './split-check/useSplitCheck'

// Lazy-loaded podkomponente
const EqualSplitTab = dynamic(() => import('./split-check/EqualSplitTab').then(m => ({ default: m.EqualSplitTab })), { ssr: false })
const ItemsSplitTab = dynamic(() => import('./split-check/ItemsSplitTab').then(m => ({ default: m.ItemsSplitTab })), { ssr: false })
const CustomSplitTab = dynamic(() => import('./split-check/CustomSplitTab').then(m => ({ default: m.CustomSplitTab })), { ssr: false })

export const SplitCheckDialog = memo(function SplitCheckDialog({
  open,
  onClose,
  orderTotal,
  subtotal,
  taxTotal,
  cartItems,
  onConfirmSplit,
  partySize = 1,
  autoGratuityPercent = 0,
  autoGratuityThreshold = 6,
}: SplitCheckDialogProps) {
  const {
    splitMode, setSplitMode,
    parties, setParties,
    autoGratuity,
    autoGratuityAmount,
    // Enakomerna delitev
    equalCount,
    equalSplitAmount,
    equalRemainder,
    handleEqualCountChange,
    handleConfirmEqual,
    // Delitev po artiklih
    unassignedItems,
    partyTotals,
    addParty,
    removeParty,
    assignItemToParty,
    unassignItem,
    setPartyTip,
    togglePartyPayment,
    handleConfirmItems,
    // Delitev po meri
    customAmounts,
    customTotal,
    customDifference,
    isCustomValid,
    handleCustomAmountChange,
    handleCustomAmountDelete,
    handleConfirmCustom,
  } = useSplitCheck({
    orderTotal,
    subtotal,
    taxTotal,
    cartItems,
    partySize,
    autoGratuityPercent,
    autoGratuityThreshold,
    onConfirmSplit,
    onClose,
  })

  // ─── Render ───────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Delitev računa
            {autoGratuity && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                <PartyPopper className="h-3 w-3 mr-1" />
                Auto-gratuiteta {autoGratuityPercent}% ({partySize}+ oseb)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {/* Auto-gratuity obvestilo */}
        {autoGratuity && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              Za skupino {partySize}+ oseb se samodejno doda gratuiteta {autoGratuityPercent}% (&euro;{autoGratuityAmount.toFixed(2)})
            </span>
          </div>
        )}
        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equal">
              <Equal className="h-3.5 w-3.5 mr-1.5" />
              Enakomerno
            </TabsTrigger>
            <TabsTrigger value="items">
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Po artiklih
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              Po meri
            </TabsTrigger>
          </TabsList>
          {/* ═══ ENAKOMERNA DELITEV ═══ */}
          <TabsContent value="equal" className="mt-4">
            <EqualSplitTab
              equalCount={equalCount}
              onEqualCountChange={handleEqualCountChange}
              orderTotal={orderTotal}
              autoGratuityAmount={autoGratuityAmount}
              equalSplitAmount={equalSplitAmount}
              equalRemainder={equalRemainder}
              onClose={onClose}
              onConfirmEqual={handleConfirmEqual}
            />
          </TabsContent>
          {/* ═══ DELITEV PO ARTIKLIH ═══ */}
          <TabsContent value="items" className="mt-4">
            <ItemsSplitTab
              partyTotals={partyTotals}
              parties={parties}
              onSetParties={setParties}
              cartItems={cartItems}
              unassignedItems={unassignedItems}
              onAddParty={addParty}
              onRemoveParty={removeParty}
              onAssignItemToParty={assignItemToParty}
              onUnassignItem={unassignItem}
              onSetPartyTip={setPartyTip}
              onTogglePartyPayment={togglePartyPayment}
              onClose={onClose}
              onConfirmItems={handleConfirmItems}
            />
          </TabsContent>
          {/* ═══ DELITEV PO MERI ═══ */}
          <TabsContent value="custom" className="mt-4">
            <CustomSplitTab
              parties={parties}
              customAmounts={customAmounts}
              onCustomAmountChange={handleCustomAmountChange}
              onCustomAmountDelete={handleCustomAmountDelete}
              orderTotal={orderTotal}
              autoGratuityAmount={autoGratuityAmount}
              customTotal={customTotal}
              customDifference={customDifference}
              isCustomValid={isCustomValid}
              onAddParty={addParty}
              onRemoveParty={removeParty}
              onClose={onClose}
              onConfirmCustom={handleConfirmCustom}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
