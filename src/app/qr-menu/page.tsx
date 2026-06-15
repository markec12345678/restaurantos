'use client';
// =====================================================================
// RESTAURANTOS QR MENU - World-Class 2026 Edition
// Nadgradnje:
// 1. EAA 2026 Dostopnost (WCAG 2.1 AA, high contrast, aria-labels)
// 2. Alergeni 2.0 (EU 1169/2011 — vizualno poudarjeni 14 alergenov)
// 3. AI Personalizacija (Time-of-Day, Smart Pairing Upsell z Gemini)
// =====================================================================

import dynamic from 'next/dynamic';
import { useQRMenu, type FontSize } from './use-qr-menu';
import type { Category, Menu } from './types';

// Lazy-loaded podkomponente
const LoadingScreen = dynamic(() => import('./components/loading-screen').then(m => ({ default: m.LoadingScreen })), { ssr: false });
const OrderConfirmedScreen = dynamic(() => import('./components/order-result-screen').then(m => ({ default: m.OrderConfirmedScreen })), { ssr: false });
const OrderErrorScreen = dynamic(() => import('./components/order-result-screen').then(m => ({ default: m.OrderErrorScreen })), { ssr: false });
const MenuHeader = dynamic(() => import('./components/menu-header').then(m => ({ default: m.MenuHeader })), { ssr: false });
const AllergenPanel = dynamic(() => import('./components/allergen-panel').then(m => ({ default: m.AllergenPanel })), { ssr: false });
const MenuTabs = dynamic(() => import('./components/menu-tabs').then(m => ({ default: m.MenuTabs })), { ssr: false });
const CategoryTabs = dynamic(() => import('./components/menu-tabs').then(m => ({ default: m.CategoryTabs })), { ssr: false });
const MenuItemList = dynamic(() => import('./components/menu-item-list').then(m => ({ default: m.MenuItemList })), { ssr: false });
const ItemDetailModal = dynamic(() => import('./components/item-detail-modal').then(m => ({ default: m.ItemDetailModal })), { ssr: false });
const CartDrawer = dynamic(() => import('./components/cart-drawer').then(m => ({ default: m.CartDrawer })), { ssr: false });
const FloatingCartBar = dynamic(() => import('./components/FloatingCartBar').then(m => ({ default: m.FloatingCartBar })), { ssr: false });
const UpsellSuggestions = dynamic(() => import('./components/upsell-suggestions').then(m => ({ default: m.UpsellSuggestions })), { ssr: false });

export default function QRMenuPage() {
  const state = useQRMenu();

  // ==================== LOADING SCREEN ====================
  if (state.loading) {
    return <LoadingScreen isDark={state.isDark} />;
  }

  // ==================== ORDER CONFIRMED SCREEN ====================
  if (state.orderPlaced && state.orderResult?.success) {
    return (
      <OrderConfirmedScreen
        isDark={state.isDark}
        orderResult={state.orderResult}
        onContinue={() => { state.setOrderPlaced(false); state.setOrderResult(null); }}
      />
    );
  }

  // ==================== ORDER ERROR SCREEN ====================
  if (state.orderPlaced && state.orderResult && !state.orderResult.success) {
    return (
      <OrderErrorScreen
        isDark={state.isDark}
        orderResult={state.orderResult}
        onRetry={() => { state.setOrderPlaced(false); state.setOrderResult(null); }}
      />
    );
  }

  // ==================== MAIN QR MENU ====================
  return (
    <div className={`min-h-screen ${state.isDark ? 'bg-gray-950 text-gray-100' : state.isHighContrast ? 'bg-white text-black' : 'bg-gradient-to-b from-amber-50 via-orange-50/50 to-amber-100/80 text-gray-900'} ${state.fontSize === 'xl' ? 'text-lg' : state.fontSize === 'large' ? 'text-base' : ''}`}>
      {state.error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
          <button onClick={() => state.setError('')} className="text-red-500 hover:text-red-700 text-lg font-bold ml-2">&times;</button>
        </div>
      )}
      <MenuHeader
        isDark={state.isDark}
        isHighContrast={state.isHighContrast}
        fontSize={state.fontSize}
        settings={state.settings}
        tableNumber={state.tableNumber}
        timeOfDay={state.timeOfDay}
        cartItemCount={state.cartItemCount}
        searchQuery={state.searchQuery}
        searchRef={state.searchRef}
        cartBtnRef={state.cartBtnRef}
        onFontSizeToggle={() => {
          const sizes: Array<FontSize> = ['normal', 'large', 'xl'];
          const idx = sizes.indexOf(state.fontSize);
          const next = sizes[(idx + 1) % sizes.length];
          state.setFontSize(next);
          localStorage.setItem('qr-font-size', next);
        }}
        onHighContrastToggle={() => state.setIsHighContrast(!state.isHighContrast)}
        onDarkToggle={() => state.setIsDark(!state.isDark)}
        onAllergenInfoToggle={() => state.setShowAllergenInfo(!state.showAllergenInfo)}
        onCartToggle={() => state.setShowCart(!state.showCart)}
        onSearchChange={state.setSearchQuery}
        onSkipToMain={state.skipToMain}
      />
      <AllergenPanel
        isDark={state.isDark}
        isHighContrast={state.isHighContrast}
        showAllergenInfo={state.showAllergenInfo}
        allergenPanelRef={state.allergenPanelRef}
        onClose={() => state.setShowAllergenInfo(false)}
      />
      <MenuTabs
        menus={state.menus}
        activeMenu={state.activeMenu}
        isDark={state.isDark}
        onMenuSelect={(menuId: string, menu: Menu) => {
          state.setActiveMenu(menuId);
          const matchingCat = menu.categories?.find((c: Category) =>
            state.timeOfDay.promotedPrefix.some(p => c.name.startsWith(p))
          );
          state.setActiveCategory(matchingCat?.id || menu.categories?.[0]?.id || '');
        }}
      />
      <CategoryTabs
        categories={state.reorderedCategories}
        activeCategory={state.activeCategory}
        isDark={state.isDark}
        isHighContrast={state.isHighContrast}
        timeOfDay={state.timeOfDay}
        onCategorySelect={state.setActiveCategory}
      />
      <MenuItemList
        items={state.filteredItems}
        cart={state.cart}
        isDark={state.isDark}
        isHighContrast={state.isHighContrast}
        fontSize={state.fontSize}
        searchQuery={state.searchQuery}
        mainRef={state.mainRef}
        categoryName={state.currentCategory?.name || ''}
        onOpenItemDetail={state.openItemDetail}
        onAddToCart={(item) => state.addToCart(item)}
      />
      <UpsellSuggestions
        suggestions={state.upsellSuggestions}
        isDark={state.isDark}
        upsellLoading={state.upsellLoading}
        showCart={state.showCart}
        cartItemCount={state.cartItemCount}
        currentMenu={state.currentMenu}
        onAddToCart={state.addToCart}
      />
      {state.showItemDetail && (
        <ItemDetailModal
          item={state.showItemDetail}
          isDark={state.isDark}
          isHighContrast={state.isHighContrast}
          fontSize={state.fontSize}
          selectedMods={state.selectedMods}
          itemNotes={state.itemNotes}
          itemDetailRef={state.itemDetailRef}
          onClose={() => state.setShowItemDetail(null)}
          onToggleModifier={state.toggleModifier}
          onNotesChange={state.setItemNotes}
          onAddToCart={() => {
            const validationError = state.validateModifierGroups();
            if (validationError) {
              alert(validationError);
              return;
            }
            state.addToCart(state.showItemDetail!, state.selectedMods, state.itemNotes);
          }}
        />
      )}
      <CartDrawer
        cart={state.cart}
        isDark={state.isDark}
        isHighContrast={state.isHighContrast}
        showCart={state.showCart}
        cartItemCount={state.cartItemCount}
        totalWithoutVat={state.getTotal()}
        totalWithVat={state.getTotalWithVat()}
        orderSending={state.orderSending}
        upsellSuggestions={state.upsellSuggestions}
        currentMenu={state.currentMenu}
        cartDrawerRef={state.cartDrawerRef}
        onClose={() => state.setShowCart(false)}
        onUpdateQuantity={state.updateQuantity}
        onRemoveFromCart={state.removeFromCart}
        onPlaceOrder={state.placeOrder}
        onAddToCart={state.addToCart}
      />
      {!state.showCart && state.cartItemCount > 0 && (
        <FloatingCartBar
          cartItemCount={state.cartItemCount}
          totalWithVat={state.getTotalWithVat()}
          onClick={() => state.setShowCart(true)}
        />
      )}
    </div>
  );
}
