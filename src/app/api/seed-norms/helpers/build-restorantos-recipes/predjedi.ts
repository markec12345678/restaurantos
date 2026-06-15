// =====================================================================
// RECEPTI ZA HRANO - RestorantOS - Predjedi (hladne + tople)
// =====================================================================

import type { InvItem, RecipeEntry } from '../types'

export function buildPredjediRecipes(inv: Record<string, InvItem>): RecipeEntry[] {
  const {
    invGorgonzola,
    invGauda,
    invEdamec,
    invSampinjoni,
    invMoka,
    invOlivnoOlje,
    invSladkaSmetana,
    invTatarskaOmaka,
    invSiroviStrukelj,
    invSlanina,
    invRukola,
    invGovedinaZaGolaz,
    invMešanaZelenjava,
    invMesnineIzbira,
    invParmezan,
    invPrsut,
    invOlive,
  } = inv

  return [
    // --- HLAĐNE PREDJEDI ---
    { menuItemName: 'Domači narezek', ingredientId: invMesnineIzbira.id, quantityPerServing: 0.3, unit: 'kg', notes: '300g mesnin' },
    { menuItemName: 'Domači narezek', ingredientId: invParmezan.id, quantityPerServing: 0.05, unit: 'kg', notes: 'sir' },
    { menuItemName: 'Pršut z olivami', ingredientId: invPrsut.id, quantityPerServing: 0.25, unit: 'kg', notes: 'kraški pršut' },
    { menuItemName: 'Pršut z olivami', ingredientId: invOlive.id, quantityPerServing: 0.05, unit: 'kg', notes: 'olive' },
    { menuItemName: 'Sirova plošča', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
    { menuItemName: 'Sirova plošča', ingredientId: invGauda.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gauda' },
    { menuItemName: 'Sirova plošča', ingredientId: invEdamec.id, quantityPerServing: 0.1, unit: 'kg', notes: 'edamec' },

    // --- TOPLE PREDJEDI ---
    { menuItemName: 'Ocvrti šampinjoni', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
    { menuItemName: 'Ocvrti šampinjoni', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
    { menuItemName: 'Ocvrti šampinjoni', ingredientId: invOlivnoOlje.id, quantityPerServing: 0.05, unit: 'L', notes: 'za cvrenje' },
    { menuItemName: 'Šampinjoni na žaru z gorgonzolo', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
    { menuItemName: 'Šampinjoni na žaru z gorgonzolo', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
    { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invSampinjoni.id, quantityPerServing: 0.3, unit: 'kg', notes: 'šampinjoni' },
    { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invGorgonzola.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gorgonzola' },
    { menuItemName: 'Šampinjoni v gorgonzolni omaki', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
    { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invGauda.id, quantityPerServing: 0.2, unit: 'kg', notes: 'sir za cvrenje' },
    { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invMoka.id, quantityPerServing: 0.05, unit: 'kg', notes: 'za paniranje' },
    { menuItemName: 'Ocvrti sir s tatarsko omako', ingredientId: invTatarskaOmaka.id, quantityPerServing: 1, unit: 'kos', notes: 'tatarska omaka' },
    { menuItemName: 'Sirovi štruklji', ingredientId: invSiroviStrukelj.id, quantityPerServing: 3, unit: 'kos', notes: '3 kosi' },
    { menuItemName: 'Popečena slanina na rukoli', ingredientId: invSlanina.id, quantityPerServing: 0.15, unit: 'kg', notes: 'slanina' },
    { menuItemName: 'Popečena slanina na rukoli', ingredientId: invRukola.id, quantityPerServing: 1, unit: 'kos', notes: 'rukola' },
    { menuItemName: 'Dnevna kremna gobova juha', ingredientId: invSampinjoni.id, quantityPerServing: 0.1, unit: 'kg', notes: 'gobe' },
    { menuItemName: 'Dnevna kremna gobova juha', ingredientId: invSladkaSmetana.id, quantityPerServing: 1, unit: 'kos', notes: 'smetana' },
    { menuItemName: 'Goveja juha', ingredientId: invGovedinaZaGolaz.id, quantityPerServing: 0.05, unit: 'kg', notes: 'govedina' },
    { menuItemName: 'Goveja juha', ingredientId: invMešanaZelenjava.id, quantityPerServing: 0.1, unit: 'kg', notes: 'zelenjava' },
  ]
}
