// ============================================
// SHARED SELECT WHITELIST — DeviceRegistry (P0-#29 Device center, R142-b)
// ============================================
// EN vir resnice za GET /api/devices IN PATCH /api/devices/[id]
// (kanon: whitelist SAMO polj, ki jih UI potrebuje — pariteta
// _helpers/feedback-select.ts R140-b; PII/leak canon: whitelist je edina
// obramba, ker include vrača polne vrstice).
//
// Izpuščeno namerno:
//   createdAt/updatedAt — notranja metastolpca, device UI ju ne uporablja
//     (svežina se prikazuje iz lastSeenAt, ne iz updatedAt)
//
// `location` je omejen na { name, code } — display polji brez ID-jev in
// brez morebitnih prihodnjih Location stolpcev (nastavitve/PII).
//
// Prisma.DeviceRegistrySelect annotacija = compile-time whitelist (neznan
// ključ = TS napaka, ne tihi uhaj podatkov).
import type { Prisma } from '@prisma/client'

export const DEVICE_SELECT: Prisma.DeviceRegistrySelect = {
  id: true,
  deviceId: true,
  name: true,
  type: true,
  status: true,
  lastSeenAt: true,
  appVersion: true,
  locationId: true,
  location: { select: { name: true, code: true } },
}
