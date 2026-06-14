'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreditCard, Split, Users } from 'lucide-react'
import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { PaymentDialogProps } from './payment/types'
import { usePaymentDialog } from './payment/usePaymentDialog'

// Lazy-loaded podkomponente
const PaymentSuccessAnimation = dynamic(() => import('./payment/PaymentSuccessAnimation').then(m => ({ default: m.PaymentSuccessAnimation })), { ssr: false })
const OrderSummarySection = dynamic(() => import('./payment/OrderSummarySection').then(m => ({ default: m.OrderSummarySection })), { ssr: false })
const TipSection = dynamic(() => import('./payment/TipSection').then(m => ({ default: m.TipSection })), { ssr: false })
const SinglePaymentTab = dynamic(() => import('./payment/SinglePaymentTab').then(m => ({ default: m.SinglePaymentTab })), { ssr: false })
const SplitPaymentTab = dynamic(() => import('./payment/SplitPaymentTab').then(m => ({ default: m.SplitPaymentTab })), { ssr: false })
const ByItemsTab = dynamic(() => import('./payment/ByItemsTab').then(m => ({ default: m.ByItemsTab })), { ssr: false })

// ============================================
// KOMPONENTA: Plačilni dialog
// ============================================
export const PaymentDialog = memo(function PaymentDialog(props: PaymentDialogProps) {
  const { order, open } = props
  const {
    paymentSuccess, resetAndClose, totalWithTip, orderTotal,
    tipAmount, tipPercent, splitAmount,
    paymentMethod, setPaymentMethod,
    splitCount, setSplitCount,
    activeTab, setActiveTab,
    guestAssignments, setGuestAssignments,
    cashReceived, setCashReceived,
    setTipAmount, setTipPercent,
    giftCardNumber, setGiftCardNumber,
    selectedGiftCardId, setSelectedGiftCardId,
    loyaltySearch, setLoyaltySearch,
    selectedLoyaltyId, setSelectedLoyaltyId,
    selectedAltPayment, setSelectedAltPayment,
    altPayments, giftCards, loyaltyResults,
    handleTipPercent, handleCustomTip,
    processPaymentIsPending,
    handleSinglePayment, handleSplitPayment, handlePayByItems,
    isProcessing,
  } = usePaymentDialog(props)

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={() => { if (!paymentSuccess) resetAndClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {paymentSuccess ? (
            <PaymentSuccessAnimation totalWithTip={totalWithTip} />
          ) : (
            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Plačilo #{order.orderNumber}</span>
                  <Badge variant="outline" className="text-sm font-bold">
                    €{orderTotal.toFixed(2)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Povzetek naročila */}
                <OrderSummarySection
                  subtotal={order.subtotal}
                  tax={order.tax}
                  discount={order.discount}
                  total={orderTotal}
                  orderItems={order.orderItems}
                />
                {/* Napitnina */}
                <TipSection
                  tipAmount={tipAmount}
                  tipPercent={tipPercent}
                  orderTotal={orderTotal}
                  totalWithTip={totalWithTip}
                  onTipPercent={handleTipPercent}
                  onCustomTip={handleCustomTip}
                />
                {/* Plačilni zavihki */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="single" className="flex-1 text-xs">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Eno plačilo
                    </TabsTrigger>
                    <TabsTrigger value="split" className="flex-1 text-xs">
                      <Split className="h-3 w-3 mr-1" />
                      Deljeno
                    </TabsTrigger>
                    <TabsTrigger value="byitems" className="flex-1 text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Po artiklih
                    </TabsTrigger>
                  </TabsList>
                  {/* Eno plačilo */}
                  <TabsContent value="single">
                    <SinglePaymentTab
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                      totalWithTip={totalWithTip}
                      isPending={processPaymentIsPending}
                      onPay={handleSinglePayment}
                      cashReceived={cashReceived}
                      setCashReceived={setCashReceived}
                      setTipAmount={setTipAmount}
                      setTipPercent={setTipPercent}
                      giftCards={giftCards}
                      giftCardNumber={giftCardNumber}
                      setGiftCardNumber={setGiftCardNumber}
                      selectedGiftCardId={selectedGiftCardId}
                      setSelectedGiftCardId={setSelectedGiftCardId}
                      loyaltyResults={loyaltyResults}
                      loyaltySearch={loyaltySearch}
                      setLoyaltySearch={setLoyaltySearch}
                      selectedLoyaltyId={selectedLoyaltyId}
                      setSelectedLoyaltyId={setSelectedLoyaltyId}
                      altPayments={altPayments}
                      selectedAltPayment={selectedAltPayment}
                      setSelectedAltPayment={setSelectedAltPayment}
                    />
                  </TabsContent>
                  {/* Deljeno plačilo */}
                  <TabsContent value="split">
                    <SplitPaymentTab
                      splitCount={splitCount}
                      setSplitCount={setSplitCount}
                      totalWithTip={totalWithTip}
                      tipAmount={tipAmount}
                      splitAmount={splitAmount}
                      isProcessing={isProcessing}
                      processPaymentIsPending={processPaymentIsPending}
                      onPaySplit={handleSplitPayment}
                    />
                  </TabsContent>
                  {/* Deli po artiklih */}
                  <TabsContent value="byitems">
                    <ByItemsTab
                      order={order}
                      splitCount={splitCount}
                      guestAssignments={guestAssignments}
                      setGuestAssignments={setGuestAssignments}
                      isProcessing={isProcessing}
                      processPaymentIsPending={processPaymentIsPending}
                      onPayByItems={handlePayByItems}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
})
