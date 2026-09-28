// ============================================
// PRODAJNI NAČIN (salesMode) — R153
// ============================================
// Prodajni način = "prodaja za sankom": na zaslonu je viden SAMO
// blagajniški nabor (meni, košarica, plačilo, seznam naročil za
// račun/storno). Cel sidebar, admin navigacija, CommandPalette
// modulski skoki, admin bližnjice, AI pomočnik in low-stock admin
// skok so skriti/zaklenjeni. Izhod samo prek PIN (admin/manager) —
// isti vzorec kot KioskBar.
//
// Način je persistiran (za razliko od kioskMode, ki ostane session-only):
// sank tablica MORA preživeti refresh — prej bi prižgan način po
// osvežitvi tiho odpeljal cel sidebar in uporabnika ujel.

/** Moduli, dovoljeni v prodajnem načinu — cilj je SAMO blagajna (orders) */
export const SALES_MODE_ALLOWED_MODULES = ['orders'] as const

/**
 * Razreši seznam dovoljenih modulov za KioskBar ModuleTabs:
 * prodajni način → samo 'orders', sicer obstoječi kiosk seznam.
 */
export function resolveAllowedModules(
  salesMode: boolean,
  kioskAllowed: readonly string[]
): readonly string[] {
  return salesMode ? SALES_MODE_ALLOWED_MODULES : kioskAllowed
}

/** Je modul dovoljen v trenutnem (omejenem) naboru? */
export function isModuleAllowed(moduleId: string, allowed: readonly string[]): boolean {
  return allowed.includes(moduleId)
}
