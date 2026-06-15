'use client'
import dynamic from 'next/dynamic'
import { memo } from 'react'
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
    selectedOrder, paymentDialogOpen, detailOrder, setDetailOrder,
    receiptOrder, autoPayOrder, voidItem, setVoidItem, stornoOrder,
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
            {/* RIGHT: Cart Panel (35%) */}
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
              onSubmit={() => placeOrderMutation.mutate({ customerName, customerPhone, orderNotes })}
              isPending={placeOrderMutation.isPending}
              setClearCartConfirm={setClearCartConfirm}
            />
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
