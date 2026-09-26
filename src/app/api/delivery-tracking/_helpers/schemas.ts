// Delivery tracking — Zod schemas

import { z } from 'zod'

// R137-b (P1-13) SELF-CLAIM: driverName/driverPhone so sedaj IZBIRNI —
// manjkajoč/prazen driverName = voznik si dostavo prevzame SAM
// (Session.employeeId je edini vir identitete; driverEmployeeId se IZKLJUČNO
// izpelje iz seje na strežniku, NIKOLI od klienta). Max-length validacije
// ostanejo (abuse prevention). Legacy dispatcher pot (prosto besedilo) ostane.
export const assignDriverSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  driverName: z.string().max(200, 'Ime voznika ne sme preseči 200 znakov').optional(),
  driverPhone: z.string().max(50, 'Telefon ne sme preseči 50 znakov').optional(),
  vehicleInfo: z.string().max(200, 'Podatki o vozilu ne smejo preseči 200 znakov').optional(),
})

export const updateLocationSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  latitude: z.number().min(-90, 'Zemljepisna širina mora biti med -90 in 90').max(90, 'Zemljepisna širina mora biti med -90 in 90'),
  longitude: z.number().min(-180, 'Zemljepisna dolžina mora biti med -180 in 180').max(180, 'Zemljepisna dolžina mora biti med -180 in 180'),
})

export const updateStatusSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  status: z.enum(['assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered', 'failed'], { message: 'Neveljaven status dostave' }),
  customerRating: z.number().min(1, 'Ocena mora biti vsaj 1').max(5, 'Ocena ne sme preseči 5').optional(),
  customerFeedback: z.string().max(500, 'Povratna informacija ne sme preseči 500 znakov').optional(),
  // R137-b (P1-13) DELIVERED CLOSE-OUT: POD opomba voznika + gotovina pobrana
  // (COD zaprtje Check/Order po online-order kanonu — samo 'delivered' veja)
  podNotes: z.string().max(500, 'Opomba dostave ne sme preseči 500 znakov').optional(),
  cashCollected: z.boolean().optional(),
})

export const deliveryTrackingPostSchema = z.union([updateLocationSchema, updateStatusSchema, assignDriverSchema])
