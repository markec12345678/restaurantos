// DAILY CHECKLIST — Zod schemas, interface, templates

import { z } from 'zod'

export interface ChecklistItem {
  id: string
  task: string
  category: string
  completed: boolean
  completedBy?: string
  completedAt?: string
  notes?: string
}

// Zod validacijska shema za POST
export const checklistItemSchema = z.object({
  id: z.string().min(1, 'ID je obvezen').max(100, 'ID ne sme preseči 100 znakov'),
  task: z.string().min(1, 'Naloga je obvezna').max(200, 'Naloga ne sme preseči 200 znakov'),
  category: z.string().min(1, 'Kategorija je obvezna').max(50, 'Kategorija ne sme preseči 50 znakov'),
  completed: z.boolean(),
  completedBy: z.string().max(100, 'Ime ne sme preseči 100 znakov').optional(),
  completedAt: z.string().max(50, 'Čas ne sme preseči 50 znakov').optional(),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').optional(),
})

export const saveChecklistSchema = z.object({
  type: z.enum(['opening', 'closing'], { message: 'Tip mora biti "opening" ali "closing"' }),
  date: z.string().min(1, 'Datum je obvezen').max(20, 'Datum ne sme preseči 20 znakov').optional(),
  checklist: z.array(checklistItemSchema).min(1, 'Seznam mora vsebovati vsaj eno nalogo').max(50, 'Seznam ne sme preseči 50 nalog'),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
})

// Zod validacijska shema za GET parametre
export const getChecklistSchema = z.object({
  type: z.enum(['opening', 'closing']).default('opening'),
  date: z.string().max(20, 'Datum ne sme preseči 20 znakov').optional(),
})

// Default checklist templates
export const OPENING_CHECKLIST: Omit<ChecklistItem, 'id' | 'completed' | 'completedBy' | 'completedAt' | 'notes'>[] = [
  { task: 'Vklopi POS sistem in preveri povezavo', category: 'sistemi' },
  { task: 'Preveri zalogo gotovine v blagajni', category: 'blagajna' },
  { task: 'Vklopi kavo in preveri temperaturo', category: 'kuhinja' },
  { task: 'Preveri temperaturo hladilnika (< 4°C)', category: 'kuhinja' },
  { task: 'Preveri temperaturo zamrzovalnika (< -18°C)', category: 'kuhinja' },
  { task: 'Odpihi pipe in preveri zalogo pijač', category: 'bár' },
  { task: 'Preveri čistost jedilnice in stranišč', category: 'čistost' },
  { task: 'Napolni servisetke in začimbe na mizah', category: 'jedilnica' },
  { task: 'Preveri rezervacije za danes', category: 'rezervacije' },
  { task: 'Pregled dnevne ponudbe s kuharji', category: 'kuhinja' },
  { task: 'Vklopi zvočno ozadje in razsvetljavo', category: 'jedilnica' },
  { task: 'Preveri zunanjo površino (terasa/vhod)', category: 'čistost' },
  { task: 'Preveri FURS povezavo in certifikat', category: 'sistemi' },
  { task: 'Posodobi posebne ponudbe na tabli', category: 'jedilnica' },
]

export const CLOSING_CHECKLIST: Omit<ChecklistItem, 'id' | 'completed' | 'completedBy' | 'completedAt' | 'notes'>[] = [
  { task: 'Izpiši Z-poročilo in zaključi izmeno', category: 'blagajna' },
  { task: 'Prešteti gotovino in primerjaj z Z-poročilom', category: 'blagajna' },
  { task: 'Pripravi denar za naslednji dan', category: 'blagajna' },
  { task: 'Počisti kuhinjo in pulta', category: 'kuhinja' },
  { task: 'Shrani ostanke hrane (pravilno označi)', category: 'kuhinja' },
  { task: 'Izklopi kavo in kuhinjsko opremo', category: 'kuhinja' },
  { task: 'Počisti bar in shraní pijače', category: 'bár' },
  { task: 'Izklopi vse pipe', category: 'bár' },
  { task: 'Počisti jedilnico in mize', category: 'jedilnica' },
  { task: 'Izprazni smeti in loči odpadke', category: 'čistost' },
  { task: 'Počisti stranišča', category: 'čistost' },
  { task: 'Izklopi razsvetljavo in glasbo', category: 'jedilnica' },
  { task: 'Zakleni vhodna vrata', category: 'varnost' },
  { task: 'Vklopi alarm', category: 'varnost' },
  { task: 'Izklopi POS sistem (če je potrebno)', category: 'sistemi' },
]
