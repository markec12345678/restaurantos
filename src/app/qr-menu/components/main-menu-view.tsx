'use client';

import dynamic from 'next/dynamic';
import { memo } from 'react';
import type { FontSize, QRMenuState } from '../use-qr-menu';
import type { Category, Menu } from '../types';

// Lazy-loaded podkomponente
const MenuHeader = dynamic(() => import('./menu-header').then(m => ({ default: m.MenuHeader })), { ssr: false });
const AllergenPanel = dynamic(() => import('./allergen-panel').then(m => ({ default: m.AllergenPanel })), { ssr: false });
const MenuTabs = dynamic(() => import('./menu-tabs').then(m => ({ default: m.MenuTabs })), { ssr: false });
const CategoryTabs = dynamic(() => import('./menu-tabs').then(m => ({ default: m.CategoryTabs })), { ssr: false });
const MenuItemList = dynamic(() => import('./menu-item-list').then(m => ({ default: m.MenuItemList })), { ssr: false });
const ItemDetailModal = dynamic(() => import('./item-detail-modal').then(m => ({ default: m.ItemDetailModal })), { ssr: false });
const CartDrawer = dynamic(() => import('./cart-drawer').then(m => ({ default: m.CartDrawer })), { ssr: false });
const FloatingCartBar = dynamic(() => import('./FloatingCartBar').then(m => ({ default: m.FloatingCartBar })), { ssr: false });
const UpsellSuggestions = dynamic(() => import('./upsell-suggestions').then(m => ({ default: m.UpsellSuggestions })), { ssr: false });

export const MainMenuView = memo(function MainMenuView({ state }: { state: QRMenuState }) {
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
});
