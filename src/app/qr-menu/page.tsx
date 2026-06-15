'use client';
// =====================================================================
// RESTAURANTOS QR MENU - World-Class 2026 Edition
// Nadgradnje:
// 1. EAA 2026 Dostopnost (WCAG 2.1 AA, high contrast, aria-labels)
// 2. Alergeni 2.0 (EU 1169/2011 — vizualno poudarjeni 14 alergenov)
// 3. AI Personalizacija (Time-of-Day, Smart Pairing Upsell z Gemini)
// =====================================================================

import dynamic from 'next/dynamic';
import { useQRMenu } from './use-qr-menu';

// Lazy-loaded podkomponente
const LoadingScreen = dynamic(() => import('./components/loading-screen').then(m => ({ default: m.LoadingScreen })), { ssr: false });
const OrderConfirmedScreen = dynamic(() => import('./components/order-result-screen').then(m => ({ default: m.OrderConfirmedScreen })), { ssr: false });
const OrderErrorScreen = dynamic(() => import('./components/order-result-screen').then(m => ({ default: m.OrderErrorScreen })), { ssr: false });
const MainMenuView = dynamic(() => import('./components/main-menu-view').then(m => ({ default: m.MainMenuView })), { ssr: false });

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
  return <MainMenuView state={state} />;
}
