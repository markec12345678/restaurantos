// ─── Utility: preveri alergene ──────────────────────────────────
import type { MenuItemRow } from '@/lib/types'
import type { ModifierGroupForAllergens } from './constants'

export function checkAllergenConflict(itemAllergens: string, guestAllergens: string[]): string[] {
  if (!itemAllergens || guestAllergens.length === 0) return []
  const itemCodes = itemAllergens.split(',').map(s => s.trim()).filter(Boolean)
  return itemCodes.filter(code => guestAllergens.includes(code))
}

// FIX A3 MEDIUM: Preveri tudi alergene modifierjev — AllergenWarningDialog jih prej ni upošteval
export function checkAllergenConflictWithModifiers(
  itemAllergens: string,
  guestAllergens: string[],
  modifierGroups?: Array<ModifierGroupForAllergens>
): string[] {
  if (guestAllergens.length === 0) return []
  const conflicting: string[] = []

  // Check item's own allergens
  if (itemAllergens) {
    const itemCodes = itemAllergens.split(',').map(s => s.trim()).filter(Boolean)
    for (const code of itemCodes) {
      if (guestAllergens.includes(code) && !conflicting.includes(code)) {
        conflicting.push(code)
      }
    }
  }

  // Check modifier allergens
  if (modifierGroups && Array.isArray(modifierGroups)) {
    for (const mg of modifierGroups) {
      const modifiers = mg.modifierGroup?.modifiers
      if (modifiers && Array.isArray(modifiers)) {
        for (const mod of modifiers) {
          if (mod.allergens) {
            const modCodes = mod.allergens.split(',').map(s => s.trim()).filter(Boolean)
            for (const code of modCodes) {
              if (guestAllergens.includes(code) && !conflicting.includes(code)) {
                conflicting.push(code)
              }
            }
          }
        }
      }
    }
  }

  return conflicting
}

export function filterItemsByAllergens(
  items: MenuItemRow[],
  excludedAllergens: string[],
  allergensField: string = 'allergens'
): MenuItemRow[] {
  if (excludedAllergens.length === 0) return items
  return items.filter(item => {
    if (!item[allergensField]) return true
    const codes = (item[allergensField] as string).split(',').map((s: string) => s.trim()).filter(Boolean)
    // Check item's own allergens
    if (codes.some(code => excludedAllergens.includes(code))) return false

    // FIX A2 HIGH: Preveri tudi alergene modifierjev — "sir" (mleko/alergen 7) kot dodatek
    // EU 1169/2011 zahteva, da so alergeni modifierjev upoštevani pri filtriranju
    // Brez tega gost z alergijo na mleko ne bi videl opozorila za sir kot dodatek
    const modifierGroups = (item as Record<string, unknown>).modifierGroups as Array<ModifierGroupForAllergens> | undefined
    if (modifierGroups && Array.isArray(modifierGroups)) {
      for (const mg of modifierGroups) {
        const modifiers = mg.modifierGroup?.modifiers
        if (modifiers && Array.isArray(modifiers)) {
          for (const mod of modifiers) {
            if (mod.allergens) {
              const modCodes = mod.allergens.split(',').map((s: string) => s.trim()).filter(Boolean)
              if (modCodes.some(code => excludedAllergens.includes(code))) return false
            }
          }
        }
      }
    }

    return true
  })
}
