// Pomožne funkcije za online naročila — Ustvari/posodobi gosta

import { db } from '@/lib/db'

/**
 * R87-1 (per-location CRM): locationId je OBVEZEN parameter — guest zapis se
 * žiga na lokacijo naročila (Guest.locationId, R87 schema stolpec).
 *   - create: žig locationId (prej NULL → gost viden samo super-adminu,
 *     kljub temu da je naročilo plačal na konkretni lokaciji).
 *   - update obstoječega: če je žig NULL (legacy pred backfill-om), ga
 *     "povzame" lokacija naročila (monotono — obstoječega žiga NE prepiše,
 *     ker gost z žigom A sme naročiti še na B — naročilna povezava B ga
 *     vseeno usposablja za B scope, glej guestInScope v guests/[id]).
 */
export async function upsertGuest(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  total: number,
  locationId: string,
): Promise<void> {
  if (!customerEmail) return

  const existingGuest = await tx.guest.findFirst({ where: { email: customerEmail } })
  if (existingGuest) {
    await tx.guest.update({
      where: { id: existingGuest.id },
      data: {
        firstName: customerName.split(' ')[0] || customerName,
        lastName: customerName.split(' ').slice(1).join(' ') || customerName,
        phone: customerPhone, totalVisits: { increment: 1 },
        totalSpent: { increment: total }, lastVisitAt: new Date(),
        // R87: legacy NULL žig povzame lokacija naročila (ne prepiše obstoječega)
        ...(existingGuest.locationId ? {} : { locationId }),
      },
    })
  } else {
    await tx.guest.create({
      data: {
        firstName: customerName.split(' ')[0] || customerName,
        lastName: customerName.split(' ').slice(1).join(' ') || '-',
        email: customerEmail, phone: customerPhone,
        totalVisits: 1, totalSpent: total,
        lastVisitAt: new Date(), firstVisitAt: new Date(),
        locationId, // R87: per-location CRM žig
      },
    })
  }
}
