// ============================================
// SHARED SELECT WHITELIST — GuestFeedback (P1-14, R140-b)
// ============================================
// EEN vir resnice za GET /api/guests/feedback IN PATCH /api/guests/feedback/[id]
// (kanon: whitelist SAMO polj, ki jih UI potrebuje — r85/r137 assignments
// whitelist vzorec). GuestFeedback sam nima email/telefon polj gostov;
// izrecna whitelist pa zagotavlja, da tudi prihodnji shemski dodatki
// (npr. notranji worker refi) NE morete uhajati v odgovor po nesreči.
//
// Izpuščeno namerno:
//   resolvedById — notranji worker ref; UI prikazuje snapshot resolvedByName
//   updatedAt    — notranji metastolpec, UI ga ne uporablja
//
// Prisma.GuestFeedbackSelect annotacija = compile-time whitelist (neznan
// ključ = TS napaka, ne tihi uhaj podatkov).
import type { Prisma } from '@prisma/client'

export const FEEDBACK_SELECT: Prisma.GuestFeedbackSelect = {
  id: true,
  // gostov kontekst (staff sme videti; public pot teh polj ne vrača)
  guestId: true,
  guestName: true,
  orderId: true,
  // ocene
  overallRating: true,
  foodRating: true,
  serviceRating: true,
  atmosphereRating: true,
  // vsebina
  comment: true,
  tags: true,
  wouldReturn: true,
  wouldRecommend: true,
  // odgovor restavracije
  responded: true,
  response: true,
  respondedAt: true,
  // P1-14: resolution workflow + kontekst mize/naročila (snapshots)
  status: true,
  resolvedByName: true,
  resolvedAt: true,
  tableId: true,
  tableNumber: true,
  orderRef: true,
  // vir + scope + čas
  source: true,
  locationId: true,
  createdAt: true,
}
