'use client'

import { useCallback, useEffect, useState } from 'react'

// =====================================================================
// RESTAURANTOS KIOSK — strankarski self-service tok (R135-c, epic #115 P1-11)
// ATTRACT → MENU (kategorije + artikli + modifierji) → CART → CHECKOUT
// (dine-in/takeout + kartica/gotovina) → CONFIRMATION (#N, 30s auto-reset)
// → ATTRACT. Idle reset (90 s → "Ste še tam?" 20 s) na MENU/CART/CHECKOUT.
//
// Kontekst: deep link /kiosk?loc=<locationId>&t=<orderingToken> (oba OBVEZNA;
// sessionStorage 'kiosk-context' ohrani kontekst pri refreshu — URL je vir
// resnice ob prvem nalaganju). Manjkajoč/neveljaven → config error zaslon.
//
// Referenčni stil: src/app/order (hooks pattern, i18n = hardcoded slovenski
// nizi — useI18n/useTranslations v src/app/order NE obstaja, grep potrjuje;
// formatEUR iz @/lib/safe-format; GROSS prikaz = NETO × (1 + DDV/100)).
// Košarica v pomnilniku — refresh namerno resetira (anonimna javna naprava).
// =====================================================================

import type { KioskFatalScreen, KioskFlowStep, KioskMenuItem, KioskOrderResult, SelectedModifier } from './types'
import { resolveKioskContext, getKioskDeviceId, type KioskContext } from './kiosk-context'
import { useKioskMenu } from './useKioskMenu'
import { useKioskCart } from './useKioskCart'
import { useKioskIdleReset, IdleResetModal } from './IdleReset'
import { AttractScreen } from './AttractScreen'
import { MenuScreen } from './MenuScreen'
import { ModifierDialog } from './ModifierDialog'
import { CartScreen } from './CartScreen'
import { CheckoutScreen } from './CheckoutScreen'
import { ConfirmationScreen } from './ConfirmationScreen'
import {
  KioskSplash, ConfigErrorScreen, MenuErrorScreen, ClosedScreen, RateLimitScreen,
} from './StatusScreens'

export default function KioskPage() {
  // --- Kontekst (URL → sessionStorage) ---
  const [ctx, setCtx] = useState<KioskContext | null>(null)
  const [ctxResolved, setCtxResolved] = useState(false)
  useEffect(() => {
    // Resolucija konteksta po mountu (URL/sessionStorage = zunanji vir) —
    // v setTimeout(0) callbacku, da ne sproži kaskadnega re-renderja
    // (react-hooks/set-state-in-effect kanon).
    const t = window.setTimeout(() => {
      setCtx(resolveKioskContext())
      setCtxResolved(true)
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  // --- Tok + celozaslonska stanja ---
  const [flowStep, setFlowStep] = useState<KioskFlowStep>('attract')
  const [fatal, setFatal] = useState<KioskFatalScreen>(null)
  const [orderResult, setOrderResult] = useState<KioskOrderResult | null>(null)
  const [unavailableNames, setUnavailableNames] = useState<string[]>([])
  const [submitError, setSubmitError] = useState('')
  const [dialogItem, setDialogItem] = useState<KioskMenuItem | null>(null)

  // --- Izbrani meni/kategorija ('' = izpeljan prvi; fallback v MenuScreen) ---
  const [activeMenuId, setActiveMenuId] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('')

  // --- Servisiranje / plačilo (privzeti = strežniški schema defaulti) ---
  const [diningOption, setDiningOption] = useState<'dine-in' | 'takeout'>('takeout')
  const [tableNumber, setTableNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card')

  const menu = useKioskMenu(ctx?.locationId ?? null, ctxResolved)
  const cart = useKioskCart()

  // --- Reset na ATTRACT (idle expiry / "Zaključi") — košarica počiščena ---
  const resetToAttract = useCallback(() => {
    cart.clearCart()
    setDialogItem(null)
    setOrderResult(null)
    setSubmitError('')
    setUnavailableNames([])
    setFlowStep('attract')
  }, [cart])

  // --- Idle reset: 90 s neaktivnosti na MENU/CART/CHECKOUT ---
  const idle = useKioskIdleReset({
    enabled: fatal === null && (flowStep === 'menu' || flowStep === 'cart' || flowStep === 'checkout'),
    onExpired: resetToAttract,
  })

  // --- Navigacija ---
  const startOrder = useCallback(() => {
    setSubmitError('')
    setUnavailableNames([])
    setFlowStep('menu')
  }, [])

  const goToCheckout = useCallback(() => {
    setSubmitError('')
    setUnavailableNames([])
    // NOV idempotencyKey za novo oddajo (retry istega submissiona ga re-uporabi)
    cart.beginCheckout()
    setFlowStep('checkout')
  }, [cart])

  // --- Izberi artikel: z modifierGroups → dialog; brez → direktno v košarico ---
  const selectItem = useCallback((item: KioskMenuItem) => {
    if (item.stockStatus === 'out') return
    if (item.modifierGroups.length > 0) {
      setDialogItem(item)
    } else {
      cart.add(item)
    }
  }, [cart])

  const confirmModifiers = useCallback((modifiers: SelectedModifier[]) => {
    // Pozor: add NE gre v setState updater (StrictMode bi ga poklical 2×)
    if (dialogItem) cart.add(dialogItem, modifiers)
    setDialogItem(null)
  }, [cart, dialogItem])

  // --- Oddaja naročila (POST /api/public/kiosk) ---
  const handleSubmit = useCallback(async () => {
    if (!ctx) return
    const outcome = await cart.submitOrder({
      locationId: ctx.locationId,
      token: ctx.token,
      deviceId: getKioskDeviceId(),
      diningOption,
      tableNumber,
      paymentMethod,
    })
    switch (outcome.kind) {
      case 'success': {
        // 201 ali 200 idempotentReplay — oba = uspeh
        setSubmitError('')
        setUnavailableNames([])
        setOrderResult({
          orderNumber: outcome.orderNumber,
          total: outcome.total,
          paymentMethod: outcome.paymentMethod,
          message: outcome.message,
        })
        setFlowStep('confirmation')
        cart.clearCart()
        break
      }
      case 'unavailable': {
        // Izprodani artikli: odstrani iz košarice, pokaži kateri, osveži meni.
        // Košarica se je spremenila → NOV idempotencyKey (nova oddaja).
        cart.removeByIds(outcome.unavailable.map(u => u.menuItemId))
        setUnavailableNames(outcome.unavailable.map(u => u.name))
        setSubmitError('')
        cart.beginCheckout()
        void menu.refreshMenu()
        const unavailableIds = outcome.unavailable.map(u => u.menuItemId)
        if (cart.cart.every(c => unavailableIds.includes(c.menuItemId))) {
          setFlowStep('menu')
        }
        break
      }
      case 'closed':
        setFatal('closed')
        break
      case 'config-error':
        setFatal('config')
        break
      case 'rate-limited':
        setFatal('rate-limited')
        break
      case 'error':
        // Banner v checkoutu — "Poskusi znova" re-uporabi ISTI idempotencyKey
        setSubmitError(outcome.error)
        break
    }
  }, [ctx, cart, diningOption, tableNumber, paymentMethod, menu])

  // 403 zaprto → "Poskusi znova" = re-fetch menija; uspeh → nazaj v tok
  const retryClosed = useCallback(async () => {
    const st = await menu.refreshMenu()
    if (st === 'ok') setFatal(null)
    else if (st === 'not-found') setFatal('config')
  }, [menu])

  // 429 → nazaj v checkout (ist idempotencyKey; uporabnik sproži retry)
  const retryRateLimit = useCallback(() => {
    setFatal(null)
    setSubmitError('Preveč poskusov, počakajte trenutek in poskusite znova.')
  }, [])

  // ==================== RENDER ====================
  if (!ctxResolved) return <KioskSplash />
  if (fatal === 'config') return <ConfigErrorScreen />
  if (menu.status === 'not-found') return <ConfigErrorScreen />
  if (fatal === 'closed') return <ClosedScreen onRetry={() => void retryClosed()} />
  if (fatal === 'rate-limited') return <RateLimitScreen onRetry={retryRateLimit} />
  if (menu.status === 'loading') return <KioskSplash />
  if (menu.status === 'error') return <MenuErrorScreen onRetry={() => void menu.refreshMenu()} />
  if (flowStep === 'confirmation' && orderResult) {
    return <ConfirmationScreen result={orderResult} onFinish={resetToAttract} />
  }
  if (flowStep === 'attract') {
    return <AttractScreen menuName={menu.menus[0]?.name} onStart={startOrder} />
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-50 via-white to-indigo-50 text-gray-900">
      {flowStep === 'menu' && (
        <MenuScreen
          menus={menu.menus}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          activeCategoryId={activeCategoryId}
          setActiveCategoryId={setActiveCategoryId}
          onSelectItem={selectItem}
          cartItemCount={cart.totals.itemCount}
          cartTotal={cart.totals.total}
          onOpenCart={() => setFlowStep('cart')}
          unavailableNames={unavailableNames}
        />
      )}
      {flowStep === 'cart' && (
        <CartScreen
          cart={cart.cart}
          subtotalNet={cart.totals.subtotalNet}
          vat={cart.totals.vat}
          total={cart.totals.total}
          unavailableNames={unavailableNames}
          onUpdateQuantity={cart.updateQuantity}
          onRemove={cart.remove}
          onSetNote={cart.setNote}
          onBackToMenu={() => setFlowStep('menu')}
          onCheckout={goToCheckout}
        />
      )}
      {flowStep === 'checkout' && (
        <CheckoutScreen
          cart={cart.cart}
          total={cart.totals.total}
          itemCount={cart.totals.itemCount}
          diningOption={diningOption}
          setDiningOption={setDiningOption}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          submitting={cart.submitting}
          submitError={submitError}
          unavailableNames={unavailableNames}
          onSubmit={() => void handleSubmit()}
          onBackToCart={() => setFlowStep('cart')}
        />
      )}

      {dialogItem && (
        <ModifierDialog
          item={dialogItem}
          onConfirm={confirmModifiers}
          onClose={() => setDialogItem(null)}
        />
      )}

      {idle.promptVisible && (
        <IdleResetModal
          secondsLeft={idle.secondsLeft}
          onContinue={idle.keepWorking}
          onEnd={idle.endNow}
        />
      )}
    </div>
  )
}
