// ============================================
// status-transitions.ts — ENOTNA mapa prehodov statusov dostave
// ============================================
// FIX R112 (WEBHOOK-5, MED — last-writer-wins razred iz R100–R111):
// statusi dostave so pisali 3 nepovezana writerja brez skupnega pravila:
//   1. voznikova pot (POST /api/delivery-tracking → handleStatusUpdate) —
//      DeliveryTracking.status (assigned/picked_up/on_the_way/arriving/
//      delivered/failed) + preslikava na DeliveryInfo.status,
//   2. ročna UI pot (PUT /api/delivery/[id]) — DeliveryInfo.status
//      (pending/preparing/ready/picked_up/delivered/failed) z lastno
//      lokalno validTransitions mapo,
//   3. dodelitev voznika (handleAssignDriver) — tracking 'assigned'.
// Vsi trije so pisali NEPOGOJENO (update brez status guard-a) → regresija
// delivered → picked_up (dupleks sporočilo voznika ali zastarel UI klic).
//
// Ta modul je EDMINI vir pravila prehodov za OBE domeni (DeliveryInfo +
// DeliveryTracking imata različna besednjaka, a fizično sočasen življenjski
// cikel — zato združena mapa, ki dovoljuje vse doslej veljavne prehode iz
// obeh writerjev in blokira SAMO regresijo + prehode iz terminalnih statusov).
//
// Uporaba: tx-fresh branje statusa + CAS updateMany
// ({ where: { id, status: <freshStatus> }, data }) — count 0 → strukturirana
// 409 (STALE_DELIVERY_STATUS_MESSAGE). Neveljaven prehod → 400.
// ============================================

/**
 * Združena mapa dovoljenih prehodov (od → [do]).
 *
 * Viri statusov (grep R112, prazna `returned` veja je namenoma ohranjena kot
 * terminalna rezerva — noben writer je trenutno ne piše):
 *  - DeliveryInfo (PUT /api/delivery/[id], updateDeliverySchema):
 *      pending, preparing, ready, picked_up, delivered, failed
 *  - DeliveryTracking (POST /api/delivery-tracking, updateStatusSchema):
 *      assigned, picked_up, on_the_way, arriving, delivered, failed
 *  - deliveryStatusMap v tracking-actions (voznik → info preslikava):
 *      assigned→pending, picked_up/on_the_way/arriving→picked_up,
 *      delivered→delivered, failed→failed
 */
export const DELIVERY_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  // priprava (DeliveryInfo lifecycle) — skoki naprej čez faze so dovoljeni
  // (voznikova pot je prej smela kadarkoli prijeti 'picked_up' ALI POSLATI
  // 'delivered' — hitra dostava, kjer kuhinja ni žigala vmesnih faz;
  // R112-fix: brez tega bi bil voznik zataknjen na 409, kadar info ostane
  // 'pending'/'preparing'/'ready' do konca dostave)
  pending: ['preparing', 'ready', 'assigned', 'picked_up', 'delivered', 'failed'],
  preparing: ['ready', 'assigned', 'picked_up', 'delivered', 'failed'],
  ready: ['assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'],
  // voznikova domena (DeliveryTracking)
  assigned: ['picked_up', 'on_the_way', 'arriving', 'delivered', 'failed'],
  picked_up: ['on_the_way', 'arriving', 'delivered', 'failed'],
  on_the_way: ['arriving', 'delivered', 'failed'],
  arriving: ['delivered', 'failed'],
  // terminalna stanja — NIČ ne sme nazaj (regresija delivered → picked_up)
  delivered: [],
  failed: ['assigned'], // re-dispatch po neuspehu (nova dostavna poteza)
  returned: [], // rezervirano (ni v uporabi — grep R112)
}

/** Structured 409 sporočilo za izgubljeno CAS tekmo (zastarel pogled → osvežitev). */
export const STALE_DELIVERY_STATUS_MESSAGE =
  'Status dostave je v medčasom spremenjen — osvežite'

/**
 * Ali je prehod from → to dovoljen?
 * Isti status na isti status je vedno dovoljen (idempotenten popravljalni klic,
 * npr. dopolnitev naslova brez spremembe statusa) — enako kot prej
 * `existing.status !== data.status` guard v PUT /api/delivery/[id].
 */
export function canTransitionDeliveryStatus(from: string, to: string): boolean {
  if (from === to) return true
  return (DELIVERY_STATUS_TRANSITIONS[from] ?? []).includes(to)
}
