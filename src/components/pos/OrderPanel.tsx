'use client'
import dynamic from 'next/dynamic'
import { memo, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { useOrderPanel } from './order/useOrderPanel'

// ─── Lazy-loaded podkomponente ──────────────────────────────────
const MenuBrowser = dynamic(() => import('./order/MenuBrowser').then(m => ({ default: m.MenuBrowser })), { ssr: false })
const OrderItemList = dynamic(() => import('./order/OrderItemList').then(m => ({ default: m.OrderItemList })), { ssr: false })
const OrderCart = dynamic(() => import('./order/OrderCart').then(m => ({ default: m.OrderCart })), { ssr: false })
const ClearCartDialog = dynamic(() => import('./order/ClearCartDialog').then(m => ({ default: m.ClearCartDialog })), { ssr: false })
const ShortcutsDialog = dynamic(() => import('./order/ShortcutsDialog').then(m => ({ default: m.ShortcutsDialog })), { ssr: false })
const OrderHeader = dynamic(() => import('./order/OrderHeader').then(m => ({ default: m.OrderHeader })), { ssr: false })
const OrderDialogs = dynamic(() => import('./order/OrderDialogs').then(m => ({ default: m.OrderDialogs })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const OrderPanel = memo(function OrderPanel() {
  const {
    cart, addToCart, removeFromCart, updateCartQuantity, clearCart: _clearCart,
    orderType, setOrderType, selectedTable, setSelectedTable,
    discount, setDiscount, activeMenuId, setActiveMenuId,
    editingOrderId, editingOrderNumber,
    appliedDiscountId, setAppliedDiscountId, diningOptionId, setDiningOptionId,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    orderNotes, setOrderNotes, mainTab, setMainTab,
    orderListTab, setOrderListTab,
    selectedOrder, paymentDialogOpen, setPaymentDialogOpen, detailOrder, setDetailOrder,
    receiptOrder, autoPayOrder, setAutoPayOrder, voidItem, setVoidItem, stornoOrder,
    clearCartConfirm, setClearCartConfirm, lastAddedId, setLastAddedId,
    shortcutsOpen, setShortcutsOpen,
    menus, menusLoading, menuItems, menuLoading,
    tables, orders, ordersLoading, discounts, diningOptions, menuStockMap,
    subtotal, vatBreakdown, totalTax, total,
    placeOrderMutation, updateOrderStatusMutation,
    handlePaymentClose, handlePaymentSuccess, handleReceiptClose,
    handleVoidClose, handleVoided, handleStornoClose, handleStornoComplete,
    handleOrderClick, handlePayOrder, handlePrintReceipt, handleStornoOrder,
    handleAddToOrder, handleExitEditing, handleClearCartConfirm,
  } = useOrderPanel()

  // ISSUE #113 §3 (telefon): košarica (280 px min) je na 390 px telefonu
  // stisnila mrežo artiklov na ~110 px — neuporabno. Zdaj je košarica na
  // mobilnem OVERLAY DRAWER (kot Toast/Square), mreža pa polna širina.
  // Desktop (md+) ostane nespremenjen sidebar.
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  // (Auto-open ob prvem artiklu je odstranjen — react-hooks/set-state-in-effect;
  //  plavajoči gumb s števcem je jasen, predvidljiv vstop v košarico.)

  return (
    <div className="h-full flex flex-col">
      {/* TOP TAB BAR */}
      <OrderHeader
        mainTab={mainTab}
        onMainTabChange={setMainTab}
        onShortcutsOpen={() => setShortcutsOpen(true)}
      />
      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'new-order' ? (
          /* NOVO NAROČILO - Toast POS Layout */
          <div className="h-full flex">
            {/* LEFT: Menu Area (65%) */}
            <MenuBrowser
              menus={menus}
              menuItems={menuItems}
              tables={tables}
              diningOptions={diningOptions}
              discounts={discounts}
              menuStockMap={menuStockMap}
              orderType={orderType}
              setOrderType={setOrderType}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              diningOptionId={diningOptionId}
              setDiningOptionId={setDiningOptionId}
              discount={discount}
              setDiscount={setDiscount}
              appliedDiscountId={appliedDiscountId}
              setAppliedDiscountId={setAppliedDiscountId}
              subtotal={subtotal}
              cart={cart}
              editingOrderId={editingOrderId}
              editingOrderNumber={editingOrderNumber}
              menusLoading={menusLoading}
              menuLoading={menuLoading}
              onAddToCart={addToCart}
              onSetLastAddedId={setLastAddedId}
              lastAddedId={lastAddedId}
            />
            {/* RIGHT: Cart Panel — desktop sidebar / mobile overlay drawer
                (issue #113 §3: na telefonu košarica NE sme zasenčiti mreže) */}
            <div
              className={
                mobileCartOpen
                  ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:shrink-0'
                  : 'hidden md:flex md:shrink-0'
              }
            >
              {mobileCartOpen && (
                <div
                  className="absolute inset-0 bg-black/50 md:hidden"
                  onClick={() => setMobileCartOpen(false)}
                  aria-hidden="true"
                />
              )}
              <div
                className={`absolute md:relative right-0 top-0 h-full flex flex-col transition-transform duration-200 md:translate-x-0 ${
                  mobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
                }`}
              >
                <OrderCart
                  cart={cart}
                  removeFromCart={removeFromCart}
                  updateCartQuantity={updateCartQuantity}
                  subtotal={subtotal}
                  vatBreakdown={vatBreakdown}
                  totalTax={totalTax}
                  discount={discount}
                  total={total}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  customerPhone={customerPhone}
                  setCustomerPhone={setCustomerPhone}
                  orderNotes={orderNotes}
                  setOrderNotes={setOrderNotes}
                  setDiscount={setDiscount}
                  appliedDiscountId={appliedDiscountId}
                  setAppliedDiscountId={setAppliedDiscountId}
                  discounts={discounts}
                  editingOrderId={editingOrderId}
                  editingOrderNumber={editingOrderNumber}
                  onExitEditing={handleExitEditing}
                  /* BUG FIX (runda 5): "Oddaj in plačaj" je oddal naročilo, ampak
                     plačilni dialog se NI nikoli odprl — onSuccess je vračal podatke
                     "za samodejno plačilo", a jih nihče ni obdelal (komentar v
                     useOrderPanelMutations.ts). Zdaj: uspešna oddaja takoj odpre
                     PaymentDialog z novim naročilom. Offline naročila in urejanje
                     obstoječega plačila preskočita auto-pay. */
                  onSubmit={() =>
                    placeOrderMutation
                      .mutateAsync({ customerName, customerPhone, orderNotes })
                      .then(data => {
                        if (
                          data && typeof data === 'object' &&
                          !('offline' in data && data.offline) &&
                          !editingOrderId && 'id' in data && data.id
                        ) {
                          setAutoPayOrder(data as Record<string, unknown>)
                          setPaymentDialogOpen(true)
                        }
                      })
                      .catch(() => {/* onError toast že prikazan v mutaciji */})
                  }
                  isPending={placeOrderMutation.isPending}
                  setClearCartConfirm={setClearCartConfirm}
                  /* UI-REFACTOR: miza vedno vidna v glavi košarice (uporabnik takoj
                     ve, na kateri mizi je — ne glede na drsenje po meniju) */
                  tableNumber={tables?.find(t => t.id === selectedTable)?.number ?? null}
                  onCloseMobile={() => setMobileCartOpen(false)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* SEZNAM NAROČIL */
          <OrderItemList
            orders={orders}
            ordersLoading={ordersLoading}
            orderListTab={orderListTab}
            setOrderListTab={setOrderListTab}
            onUpdateOrderStatus={(params) => updateOrderStatusMutation.mutate(params)}
            isStatusUpdatePending={updateOrderStatusMutation.isPending}
            onOrderClick={handleOrderClick}
            onPayOrder={handlePayOrder}
            onPrintReceipt={handlePrintReceipt}
            onStornoOrder={handleStornoOrder}
            onAddToOrder={handleAddToOrder}
            onVoidItem={setVoidItem}
            detailOrder={detailOrder}
            setDetailOrder={setDetailOrder}
          />
        )}
      </div>
      {/* Floating mobile cart toggle (issue #113 §3) — vedno dosegljiv,
          pokaže števec + znesek; desktop ga ne prikaže (sidebar stalno viden) */}
      {mainTab === 'new-order' && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg active:scale-95 transition-transform"
          aria-label={`Odpri naročilo: ${cartCount} ${cartCount === 1 ? 'artikel' : 'artiklov'}, ${formatEUR(total)}`}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {cartCount > 0 ? `${cartCount} · ${formatEUR(total)}` : 'Naročilo'}
        </button>
      )}
      {/* Dialogi */}
      <OrderDialogs
        paymentDialogOpen={paymentDialogOpen}
        onPaymentClose={handlePaymentClose}
        onPaymentSuccess={handlePaymentSuccess}
        autoPayOrder={autoPayOrder}
        selectedOrder={selectedOrder}
        receiptOrderId={receiptOrder?.id as string || null}
        onReceiptClose={handleReceiptClose}
        voidItem={voidItem}
        onVoidClose={handleVoidClose}
        onVoided={handleVoided}
        stornoOrder={stornoOrder}
        onStornoClose={handleStornoClose}
        onStornoComplete={handleStornoComplete}
      />
      {/* Clear Cart Confirmation Dialog */}
      <ClearCartDialog
        open={clearCartConfirm}
        onOpenChange={setClearCartConfirm}
        onConfirm={handleClearCartConfirm}
      />
      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
})
