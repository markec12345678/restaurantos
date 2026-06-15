// Recepti za solate in pizze

import type { InvItem, RecipeEntry } from '../../types'

export function buildSalateAndPizzeRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  const {
    invSolata, invGauda, invTatarskaOmaka, invPiscancjiFile, invParmezan,
    invParadiznik, invFetaSir, invOlive, invRukola,
    invTunaKos, invTestoZaPica, invPelati, invMozzarella,
    invKuhanPrsut, invDomacaSunka, invSuhaSalama, invSlanina, invSampinjoni,
    invPrsut, invGorgonzola, invEdamec,
  } = inv

  return [
    // --- SOLATE ---
    { menuItemName: 'Solata Kraljica', ingredientId: invSolata.id, quantityPerServing: 0.3, unit: 'kg', notes: 'mešana solata' },
    { menuItemName: 'Solata Kraljica', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
    { menuItemName: 'Solata Kraljica', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
    { menuItemName: 'Cezarjeva solata', ingredientId: invSolata.id, quantityPerServing: 0.2, unit: 'kg', notes: 'solata' },
    { menuItemName: 'Cezarjeva solata', ingredientId: invPiscancjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'piščanec' },
    { menuItemName: 'Cezarjeva solata', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'parmezan' },
    { menuItemName: 'Grška solata', ingredientId: invSolata.id, quantityPerServing: 0.15, unit: 'kg', notes: 'solata' },
    { menuItemName: 'Grška solata', ingredientId: invParadiznik.id, quantityPerServing: 0.1, unit: 'kg', notes: 'paradižnik' },
    { menuItemName: 'Grška solata', ingredientId: invFetaSir.id, quantityPerServing: 0.1, unit: 'kg', notes: 'feta sir' },
    { menuItemName: 'Grška solata', ingredientId: invOlive.id, quantityPerServing: 0.03, unit: 'kg', notes: 'olive' },
    { menuItemName: 'Solata rukola s parmezanom', ingredientId: invRukola.id, quantityPerServing: 1, unit: 'kos', notes: 'rukola' },
    { menuItemName: 'Solata rukola s parmezanom', ingredientId: invParmezan.id, quantityPerServing: 0.03, unit: 'kg', notes: 'parmezan' },
    { menuItemName: 'Mešana solata s tuno', ingredientId: invSolata.id, quantityPerServing: 0.3, unit: 'kg', notes: 'mešana solata' },
    { menuItemName: 'Mešana solata s tuno', ingredientId: invTunaKos.id, quantityPerServing: 0.15, unit: 'kg', notes: 'tuna' },

    // --- PIZZE ---
    { menuItemName: 'Margerita', ingredientId: invTestoZaPica.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
    { menuItemName: 'Margerita', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
    { menuItemName: 'Margerita', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
    { menuItemName: 'Hišna pica', ingredientId: invTestoZaPica.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
    { menuItemName: 'Hišna pica', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
    { menuItemName: 'Hišna pica', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
    { menuItemName: 'Hišna pica', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'kuhan pršut' },
    { menuItemName: 'Hišna pica', ingredientId: invDomacaSunka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'domača šunka' },
    { menuItemName: 'Hišna pica', ingredientId: invSuhaSalama.id, quantityPerServing: 0.05, unit: 'kg', notes: 'salama' },
    { menuItemName: 'Hišna pica', ingredientId: invSlanina.id, quantityPerServing: 0.05, unit: 'kg', notes: 'slanina' },
    { menuItemName: 'Hišna pica', ingredientId: invSampinjoni.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gobe' },
    { menuItemName: 'Kraška', ingredientId: invTestoZaPica.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
    { menuItemName: 'Kraška', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
    { menuItemName: 'Kraška', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
    { menuItemName: 'Kraška', ingredientId: invPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },
    { menuItemName: 'Kraška', ingredientId: invSampinjoni.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gobe' },
    { menuItemName: 'S tuno', ingredientId: invTestoZaPica.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
    { menuItemName: 'S tuno', ingredientId: invPelati.id, quantityPerServing: 0.1, unit: 'kg', notes: 'pelati' },
    { menuItemName: 'S tuno', ingredientId: invMozzarella.id, quantityPerServing: 0.15, unit: 'kg', notes: 'mozzarella' },
    { menuItemName: 'S tuno', ingredientId: invTunaKos.id, quantityPerServing: 0.1, unit: 'kg', notes: 'tuna' },
    { menuItemName: 'Štirje siri', ingredientId: invTestoZaPica.id, quantityPerServing: 1, unit: 'kg', notes: '1 testo' },
    { menuItemName: 'Štirje siri', ingredientId: invMozzarella.id, quantityPerServing: 0.1, unit: 'kg', notes: 'mozzarella' },
    { menuItemName: 'Štirje siri', ingredientId: invGorgonzola.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gorgonzola' },
    { menuItemName: 'Štirje siri', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'gauda' },
    { menuItemName: 'Štirje siri', ingredientId: invEdamec.id, quantityPerServing: 0.05, unit: 'kg', notes: 'edamec' },
  ]
}
