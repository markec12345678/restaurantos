import { CategoryRef, MenuItemSeed } from './types'

// =====================================================================
// PIJAČA - Pivo (točeno, steklenično, craft, brezalkoholno)
// =====================================================================

export function getDrinksBeer(
  cats: Record<string, CategoryRef>
): MenuItemSeed[] {
  return [
    // --- TOČENO PIVO ---
    { name: 'Pivo Haler Lager Nefiltriran (0.30L)', description: 'Pivovarna Haler | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/haler-nefiltriran-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Pivo Haler Lager Nefiltriran (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/haler-nefiltriran-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.30L)', description: 'Pivovarna Laško | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/lasko-lager-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.50L)', description: 'Pivovarna Laško | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/lasko-lager-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.30L)', description: 'Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/union-lager-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.50L)', description: 'Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/union-lager-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.30L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.30L', price: 4.50, image: '/menu-images/toceno-pivo/pelicon-ipa-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.50L', price: 5.90, image: '/menu-images/toceno-pivo/pelicon-ipa-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.30L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/radler-03.png', categoryId: cats.tocenoPivo.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.50L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/radler-05.png', categoryId: cats.tocenoPivo.id, sortOrder: 9, modifierGroupIds: [] },

    // --- PIVO ---
    { name: 'Reset Lagerish Cream Ale (0.50L)', description: 'Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-lagerish.png', categoryId: cats.pivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Reset Froggy IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-froggy.png', categoryId: cats.pivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Reset Irish Extra Stout (0.50L)', description: 'Temno | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-stout.png', categoryId: cats.pivo.id, sortOrder: 2, modifierGroupIds: [] },

    // --- CRAFT PIVA ---
    { name: 'Pelicon Winter (0.75L)', description: 'Temno | Pivovarna Pelicon | 0.75L', price: 15.00, image: '/menu-images/craft-piva/pelicon-winter.png', categoryId: cats.craftPiva.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Zeleni Haler Lager s Konopljo (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 5.90, image: '/menu-images/craft-piva/zeleni-haler.png', categoryId: cats.craftPiva.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Bevog Tak Pale Ale (0.33L)', description: 'Pivovarna Bevog | 0.33L', price: 5.00, image: '/menu-images/craft-piva/bevog-tak.png', categoryId: cats.craftPiva.id, sortOrder: 2, modifierGroupIds: [] },

    // --- BREZALKOHOLNO PIVO ---
    { name: 'Heineken 0.0 (0.33L)', description: 'Brezalkoholno | Pivovarna Heineken | 0.33L', price: 4.20, image: '/menu-images/brezalk-pivo/heineken-00.png', categoryId: cats.brezalkPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Daura Lager (0.33L)', description: 'Brezglutensko | Estrella Damm, Španija | 0.33L', price: 4.90, image: '/menu-images/brezalk-pivo/daura.png', categoryId: cats.brezalkPivo.id, sortOrder: 1, modifierGroupIds: [] },
  ]
}
