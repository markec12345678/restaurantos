// ============================================
// SHARED SELECT WHITELIST — GiftCard (R144-b, epic #115 #31 Gift cards)
// ============================================
// EN vir resnice za GET /api/gift-cards (kanon: whitelist SAMO polj, ki jih
// UI potrebuje — pariteta _helpers/device-select.ts R142-b in
// _helpers/feedback-select.ts R140-b; PII/leak canon: whitelist je edina
// obramba, ker include vrača polne vrstice).
//
// Izpuščeno namerno (potrjeno z rg čez UI konsumente — GiftCardManager,
// gift-cards/*, payment dialog GiftCardSection, module-prefetch):
//   createdAt/updatedAt — notranja metastolpca; UI jih ne prebere (sortira po
//     purchasedAt, zgodovina po tx.createdAt), četudi jih tip GiftCard še
//     deklarira. Odstranitev je varna (consumerji berejo samo polja, ki jih
//     dejansko uporabljajo).
//   payments — relacija ni potrebljena (payment dialog bere samo card polja).
//
// `location` je omejen na { name, code } — display polji brez ostalih
// Location stolpcev (nastavitve/PII). locationId ostane (UI filtri/scope).
//
// transactions (GIFT_CARD_TRANSACTION_SELECT) = polni model — točno 9 stolpcev,
// ki jih UI TransactionHistoryDialog + CSV izvoz + summaryStats berejo
// (type/amount/balanceAfter/note/createdAt + identifierji). Compile-time pin
// prek Prisma.XSelect annotacije (neznan ključ = TS napaka).
import type { Prisma } from '@prisma/client'

export const GIFT_CARD_SELECT: Prisma.GiftCardSelect = {
  id: true,
  cardNumber: true,
  ownerName: true,
  balance: true,
  initialBalance: true,
  status: true,
  purchasedAt: true,
  expiresAt: true,
  locationId: true,
  location: { select: { name: true, code: true } },
}

export const GIFT_CARD_TRANSACTION_SELECT: Prisma.GiftCardTransactionSelect = {
  id: true,
  giftCardId: true,
  type: true,
  amount: true,
  balanceAfter: true,
  orderId: true,
  checkId: true,
  note: true,
  createdAt: true,
}
