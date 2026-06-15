// =====================================================================
// JUHE
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedJuhe(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invGovejaJuhovina, invSpageti, invJajca,
    invKisloZelje, invFizol, invKrompir, invCesen, invSlanina,
    invGobovaJuhovina, invGobe, invKislaSmetana,
    invZelenjavnaJuhovina, invPecenaZelenjava
  } = inv
  const { catJuhe } = cat

  await createFood('Goveja juha z rezanci', 3.50, catJuhe.id, 'Tradicionalna goveja juha s tankimi rezanci', '1', 9.5, [
  { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }, { inv: invSpageti, qty: 0.03, unit: 'kg' }
], '/menu-images/hrana/goveja-juha-rezanci-3.png')
  await createFood('Goveja juha z jajcem', 3.50, catJuhe.id, 'Goveja juha s kuhanim jajcem', '1,3', 9.5, [
  { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }, { inv: invJajca, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/goveja-juha-jajce-2.png')
  await createFood('Jota', 4.50, catJuhe.id, 'Tradicionalna jota s kislim zeljem, fižolom in krompirjem', '1', 9.5, [
  { inv: invKisloZelje, qty: 0.15, unit: 'kg' }, { inv: invFizol, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.10, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invSlanina, qty: 0.03, unit: 'kg' }
], '/menu-images/hrana/jota.png')
  await createFood('Gobova juha', 4.50, catJuhe.id, 'Kremna gobova juha s šampinjoni in jurčki', '1', 9.5, [
  { inv: invGobovaJuhovina, qty: 0.33, unit: 'L' }, { inv: invGobe, qty: 0.05, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
], '/menu-images/hrana/gobova-juha-3.png')
  await createFood('Zelenjavna juha', 3.50, catJuhe.id, 'Sveža zelenjavna juha s sezono zelenjave', '1', 9.5, [
  { inv: invZelenjavnaJuhovina, qty: 0.33, unit: 'L' }, { inv: invPecenaZelenjava, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/zelenjavna-juha-3.png')
  await createFood('Dnevna juha', 4.00, catJuhe.id, 'Dnevna ponudba domače juhe', '1', 9.5, [
  { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }
],
  '/menu-images/hrana/dnevna-juha.png')
}
