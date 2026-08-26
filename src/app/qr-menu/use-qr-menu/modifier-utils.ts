// =====================================================================
// QR Menu - Pure modifier helper functions
// =====================================================================

import type { MenuItem, Modifier, ModifierGroup, TimeOfDay, Category } from '../types';

/**
 * Toggle a modifier within a ModifierGroup, respecting required/minSelect/maxSelect.
 * Returns the new selectedMods array.
 */
export function toggleModifierLogic(
  prevMods: Modifier[],
  mod: Modifier,
  mg: ModifierGroup,
): Modifier[] {
  const exists = prevMods.find(m => m.id === mod.id);
  if (exists) {
    // Deselektiranje — preveri minSelect
    const currentGroupCount = prevMods.filter(m => mg.modifiers.some(gm => gm.id === m.id)).length;
    if (mg.required && currentGroupCount <= 1) return prevMods; // Ne dovoli deselection če je required
    if (mg.minSelect > 0 && currentGroupCount <= mg.minSelect) return prevMods; // Ne dovoli pod minSelect
    return prevMods.filter(m => m.id !== mod.id);
  }
  // Selektiranje — preveri maxSelect
  const currentGroupCount = prevMods.filter(m => mg.modifiers.some(gm => gm.id === m.id)).length;
  if (mg.maxSelect !== null && currentGroupCount >= mg.maxSelect) {
    // Zamenjaj zadnjega iz te skupine z novim
    const groupModsInSelection = prevMods.filter(m => mg.modifiers.some(gm => gm.id === m.id));
    return [...prevMods.filter(m => !groupModsInSelection.slice(0, -1).some(gm => gm.id === m.id) || !mg.modifiers.some(gm => gm.id === m.id)), mod];
  }
  return [...prevMods, mod];
}

/**
 * Validate that all modifier group constraints are met.
 * Returns an error message string or null if valid.
 */
export function validateModifierGroupsLogic(
  selectedMods: Modifier[],
  showItemDetail: MenuItem | null,
): string | null {
  if (!showItemDetail) return null;
  for (const { modifierGroup: mg } of showItemDetail.modifierGroups || []) {
    const selectedInGroup = selectedMods.filter(m => mg.modifiers.some(gm => gm.id === m.id));
    if (mg.required && selectedInGroup.length === 0) {
      return `"${mg.name}" je obvezno — izberite vsaj eno možnost`;
    }
    if (mg.minSelect > 0 && selectedInGroup.length < mg.minSelect) {
      return `"${mg.name}" — izberite vsaj ${mg.minSelect} možnosti`;
    }
  }
  return null;
}

/** Filter menu items by search query */
export function filterItemsBySearch(
  items: MenuItem[] | undefined,
  searchQuery: string,
): MenuItem[] {
  if (!items) return [];
  if (!searchQuery) return items;
  return items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );
}

/** Reorder categories based on time-of-day promoted prefixes */
export function reorderCategoriesByTimeOfDay(
  categories: Category[] | undefined,
  timeOfDay: TimeOfDay,
): Category[] {
  if (!categories) return [];
  return [...categories].sort((a, b) => {
    const aMatches = timeOfDay.promotedPrefix.some(p => a.name.startsWith(p)) ? 0 : 1;
    const bMatches = timeOfDay.promotedPrefix.some(p => b.name.startsWith(p)) ? 0 : 1;
    return aMatches - bMatches;
  });
}
