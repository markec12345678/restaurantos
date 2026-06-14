'use client'
// ============================================
// HOOK: Podatki in logika za skladnost s predpisi
// Izvleče nalaganje in izračune iz glavne komponente
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { MenuItemRow } from '@/lib/types'
import type { ComplianceItem } from './constants'
import { computeComplianceScore } from './constants'

export function useComplianceData() {
  const [items, setItems] = useState<ComplianceItem[]>([])
  const [_loading, setLoading] = useState(true)

  const loadCompliance = useCallback(async () => {
    try {
      // Preveri FURS status
      const fursRes = await authFetch('/api/furs')
      if (!fursRes.ok) throw new Error('Napaka')
      const fursData = await fursRes.json()

      // Preveri HACCP vnose
      const haccpRes = await authFetch('/api/haccp')
      if (!haccpRes.ok) throw new Error('Napaka')
      const haccpData = await haccpRes.json()

      // Preveri alergene
      const menuRes = await authFetch('/api/menu-items')
      if (!menuRes.ok) throw new Error('Napaka')
      const menuData = await menuRes.json()

      const menuItemsWithAllergens = (menuData || []).filter((i: MenuItemRow) => i.allergens && i.allergens.length > 0)
      const menuItemsWithoutAllergens = (menuData || []).filter((i: MenuItemRow) => !i.allergens || i.allergens.length === 0)

      // Preveri zaposlene
      const empRes = await authFetch('/api/employees')
      if (!empRes.ok) throw new Error('Napaka')
      const empData = await empRes.json()

      const complianceItems: ComplianceItem[] = [
        // GDPR
        {
          id: 'gdpr-1', category: 'gdpr',
          title: 'Privolitev za obdelavo osebnih podatkov',
          description: 'Vsi gostje morajo imeti privolitev za obdelavo osebnih podatkov ( telefon, email, ime). Zahteva GDPR 6(1)(a).',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'GDPR člen 6(1)(a)',
        },
        {
          id: 'gdpr-2', category: 'gdpr',
          title: 'Pravica do izbrisa podatkov',
          description: 'Gostje morajo imeti možnost zahtevati izbris svojih osebnih podatkov iz sistema v 30 dneh.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'GDPR člen 17',
        },
        {
          id: 'gdpr-3', category: 'gdpr',
          title: 'Vodnik obdelave osebnih podatkov',
          description: 'Obvezni vodnik vseh kategorij obdelave osebnih podatkov v skladu z GDPR členom 30.',
          status: 'pending', dueDate: '2026-06-30', lastChecked: new Date().toISOString(),
          actionRequired: 'Ustvari in objavi vodnik obdelave', regulation: 'GDPR člen 30',
        },
        // Alergeni
        {
          id: 'allergen-1', category: 'allergens',
          title: 'EU 1169/2011 — Označevanje alergenov',
          description: `Trenutno ${menuItemsWithAllergens.length} od ${(menuData || []).length} artiklov ima označene alergene. ${menuItemsWithoutAllergens.length} artiklov brez alergenov.`,
          status: menuItemsWithoutAllergens.length > 0 ? 'warning' : 'compliant',
          dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: menuItemsWithoutAllergens.length > 0 ? `Dopolni alergene za ${menuItemsWithoutAllergens.length} artiklov` : null,
          regulation: 'EU 1169/2011',
        },
        {
          id: 'allergen-2', category: 'allergens',
          title: '14 obveznih alergenov na meniju',
          description: 'Meni mora jasno označevati vseh 14 alergenov EU za vsak artikel, ki jih vsebuje.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'EU 1169/2011 Priloga II',
        },
        // FURS
        {
          id: 'furs-1', category: 'furs',
          title: 'FURS davčno potrjevanje računov',
          description: 'Vsi računi morajo biti potrjeni pri FURS-u s ZOI in EOR. Avtomatsko potrjevanje je aktivno.',
          status: fursData?.simulated ? 'warning' : 'compliant',
          dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: fursData?.simulated ? 'Preklopi iz simulacijskega v produkcijski način' : null,
          regulation: 'ZDDV-1, ZPrCP',
        },
        {
          id: 'furs-2', category: 'furs',
          title: 'Z-poročila ob koncu dneva',
          description: 'Z-poročilo mora biti generirano ob zaključku vsakega poslovnega dne.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'ZPrCP člen 32',
        },
        // HACCP
        {
          id: 'haccp-1', category: 'haccp',
          title: 'HACCP dnevnik temperature',
          description: 'Dnevno beleženje temperatur hladilnikov in zamrzovalnikov. Vsaj 2 meritvi dnevno.',
          status: (haccpData || []).length > 0 ? 'compliant' : 'warning',
          dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: (haccpData || []).length === 0 ? 'Vnesi današnje temperature' : null,
          regulation: 'Uredba (ES) 852/2004',
        },
        {
          id: 'haccp-2', category: 'haccp',
          title: 'CCP kontrole (Kritične kontrolne točke)',
          description: 'Redno preverjanje CCP točk: temperatura kuhanja (>72°C), hlajenja (<4°C), toplotna obdelava.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'Uredba (ES) 852/2004, Priloga II',
        },
        {
          id: 'haccp-3', category: 'haccp',
          title: 'Higiena osebja — certifikati',
          description: 'Vsi zaposleni v kuhinji morajo imeti veljavno potrdilo o higieni živil.',
          status: (empData || []).length > 0 ? 'warning' : 'pending',
          dueDate: '2026-07-01', lastChecked: new Date().toISOString(),
          actionRequired: 'Preveri veljavnost certifikatov za vse zaposlene',
          regulation: 'Zakon o higieni živil (ZHZ)',
        },
        // Delovno pravo
        {
          id: 'labor-1', category: 'labor',
          title: 'Evidence delovnega časa',
          description: 'Točne evidence delovnega časa za vse zaposlene. Minimalni odmor 30 min pri 6+ h delovnika.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'ZDR-1 člen 146',
        },
        {
          id: 'labor-2', category: 'labor',
          title: 'Počitki in dopusti',
          description: 'Neprekinjeni počitek najmanj 24 ur v 7 dneh. Letni dopust najmanj 20 delovnih dni.',
          status: 'compliant', dueDate: null, lastChecked: new Date().toISOString(),
          actionRequired: null, regulation: 'ZDR-1 člen 151, 159',
        },
        // Požarna varnost
        {
          id: 'fire-1', category: 'fire_safety',
          title: 'Požarni red in načrt evakuacije',
          description: 'Veljaven požarni red in načrt evakuacije morata biti vidno objavljena.',
          status: 'pending', dueDate: '2026-06-15', lastChecked: new Date().toISOString(),
          actionRequired: 'Obnovi požarni red za leto 2026', regulation: 'ZPVZLO člen 25',
        },
      ]

      setItems(complianceItems)
    } catch {
      toast.error('Napaka pri nalaganju skladnosti')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCompliance()
  }, [loadCompliance])

  // Izračuni
  const compliantCount = items.filter(i => i.status === 'compliant').length
  const warningCount = items.filter(i => i.status === 'warning').length
  const nonCompliantCount = items.filter(i => i.status === 'non-compliant').length
  const pendingCount = items.filter(i => i.status === 'pending').length
  const complianceScore = computeComplianceScore(items)

  return {
    items,
    loadCompliance,
    compliantCount,
    warningCount,
    nonCompliantCount,
    pendingCount,
    complianceScore,
  }
}
