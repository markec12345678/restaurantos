// Pomožne funkcije za online naročila — Ustvari/posodobi gosta

import { db } from '@/lib/db'

export async function upsertGuest(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  total: number,
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
      },
    })
  }
}
