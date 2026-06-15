// Rižote, kalamari, ribje jedi

import type { InvItem, RecipeEntry } from '../../types'

export function buildRizoteKalamariRibe(inv: Record<string, InvItem>): RecipeEntry[] {
  const {
    invRiz, invKalamari, invGamberi, invSampinjoni,
    invPuramjiFile, invPaprika, invMešanaZelenjava,
    invMoka, invTatarskaOmaka, invKrompir, invBlitva,
    invGauda, invKuhanPrsut,
    invLosos, invOslic, invPommesFrites,
    invFilePostrvi, invFileOrade, invFileBrancina,
  } = inv

  return [
    // --- RIŽOTE ---
    { menuItemName: 'Morska rižota', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
    { menuItemName: 'Morska rižota', ingredientId: invKalamari.id, quantityPerServing: 0.1, unit: 'kg', notes: 'kalamari' },
    { menuItemName: 'Morska rižota', ingredientId: invGamberi.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gamberi' },
    { menuItemName: 'Rižota z gobami', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
    { menuItemName: 'Rižota z gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.15, unit: 'kg', notes: 'gobe' },
    { menuItemName: 'Rižota s puranom in papriko', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
    { menuItemName: 'Rižota s puranom in papriko', ingredientId: invPuramjiFile.id, quantityPerServing: 0.15, unit: 'kg', notes: 'puran' },
    { menuItemName: 'Rižota s puranom in papriko', ingredientId: invPaprika.id, quantityPerServing: 0.1, unit: 'kg', notes: 'paprika' },
    { menuItemName: 'Zelenjavna rižota', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
    { menuItemName: 'Zelenjavna rižota', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.2, unit: 'kg', notes: 'zelenjava' },
    { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invRiz.id, quantityPerServing: 0.2, unit: 'kg', notes: 'riž' },
    { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invGamberi.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gamberi' },
    { menuItemName: 'Rižota z gamberi in mešanimi gobami', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gobe' },

    // --- KALAMARI ---
    { menuItemName: 'Ocvrti kalamari', ingredientId: invKalamari.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g kalamari' },
    { menuItemName: 'Ocvrti kalamari', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
    { menuItemName: 'Ocvrti kalamari', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
    { menuItemName: 'Kalamari na žaru', ingredientId: invKalamari.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g kalamari' },
    { menuItemName: 'Kalamari na žaru', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'slan krompir' },
    { menuItemName: 'Kalamari na žaru', ingredientId: invBlitva.id, quantityPerServing: 0.1, unit: 'kg', notes: 'blitva' },
    { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invKalamari.id, quantityPerServing: 0.25, unit: 'kg', notes: '250g kalamari' },
    { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invGauda.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
    { menuItemName: 'Polnjeni kalamari po dunajsko', ingredientId: invKuhanPrsut.id, quantityPerServing: 0.05, unit: 'kg', notes: 'pršut' },

    // --- RIBJE JEDI ---
    { menuItemName: 'Losos', ingredientId: invLosos.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g losos' },
    { menuItemName: 'Losos', ingredientId: invKrompir.id, quantityPerServing: 0.2, unit: 'kg', notes: 'slan krompir' },
    { menuItemName: 'Losos', ingredientId: invBlitva.id, quantityPerServing: 0.1, unit: 'kg', notes: 'blitva' },
    { menuItemName: 'Gamberi po pariško', ingredientId: invGamberi.id, quantityPerServing: 0.2, unit: 'kg', notes: '200g gamberi' },
    { menuItemName: 'Ocvrt oslič s prilogo', ingredientId: invOslic.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g oslič' },
    { menuItemName: 'Ocvrt oslič s prilogo', ingredientId: invPommesFrites.id, quantityPerServing: 0.2, unit: 'kg', notes: 'pomfri' },
    { menuItemName: 'File postrvi', ingredientId: invFilePostrvi.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g postrv' },
    { menuItemName: 'File orade', ingredientId: invFileOrade.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g orada' },
    { menuItemName: 'File brancina na žaru', ingredientId: invFileBrancina.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g brancin' },
  ]
}
