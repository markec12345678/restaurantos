// =====================================================================
// PREDJEDI (HLADNE + TOPLE)
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedPredjedi(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invRozbif, invRukola, invParmezan, invOlivnoOlje,
    invOvcjaSkuta, invKrompir,
    invHobotnica, invSolata,
    invJurcki, invCesen,
    invGovejaPecjenka, invGranatnoJabolko,
    invMletoSvinjsko, invKruh, invTartufata,
    invCamembert, invJagode,
    invMozzarella, invParadiznik,
    invPrsut, invSalama, invSunka, invFeta,
    invKalamari, invMorskiSadezi, invKoruznaMoka, invTartarskaOmaka
  } = inv
  const { catPredjedi } = cat

  await createFood('Hladni rozbif na rukoli', 10.00, catPredjedi.id, 'Tanko rezan goveji rozbif na posteljici rukole z olivnim oljem', '1,2', 9.5, [
  { inv: invRozbif, qty: 0.10, unit: 'kg' }, { inv: invRukola, qty: 0.03, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/rozbif-rukola.png')
  await createFood('Ovčja skuta s krompirjem', 8.00, catPredjedi.id, 'Kremasta ovčja skuta s kuhanim krompirjem in zelišči', '1,2', 9.5, [
  { inv: invOvcjaSkuta, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/ovcja-skuta-3.png')
  await createFood('Hobotnica v solati', 10.00, catPredjedi.id, 'Mehka hobotnica na listnati solati z limoninim prelivom', '1,2,4', 9.5, [
  { inv: invHobotnica, qty: 0.10, unit: 'kg' }, { inv: invSolata, qty: 0.05, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/hobotnica-solata-3.png')
  await createFood('Jurčki na žaru', 10.00, catPredjedi.id, 'Sveži jurčki na žaru s česnom in peteršiljem', '1', 9.5, [
  { inv: invJurcki, qty: 0.15, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
], '/menu-images/hrana/jurcki-zar.png')
  await createFood('Goveji carpaccio', 14.00, catPredjedi.id, 'Goveji carpaccio na rukoli s parmezanom in prelivi granatnega jabolka', '1,2', 9.5, [
  { inv: invGovejaPecjenka, qty: 0.08, unit: 'kg' }, { inv: invRukola, qty: 0.03, unit: 'kg' }, { inv: invParmezan, qty: 0.04, unit: 'kg' }, { inv: invGranatnoJabolko, qty: 0.25, unit: 'kos' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
], '/menu-images/hrana/goveji-carpaccio.png')
  await createFood('Hišna pašteta z medom in tartufi', 10.90, catPredjedi.id, 'Domača paštetka z medom, tartufi in popečenimi kruhki', '1', 9.5, [
  { inv: invMletoSvinjsko, qty: 0.10, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }, { inv: invTartufata, qty: 0.01, unit: 'kg' }
],
  '/menu-images/hrana/bruschetta.png')
  await createFood('Zapečen camembert z jagodičevjem', 14.00, catPredjedi.id, 'Zapečen francoski sir Camembert z jagodičevjem in toastom', '1,2', 9.5, [
  { inv: invCamembert, qty: 1, unit: 'kos' }, { inv: invJagode, qty: 0.05, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }
], '/menu-images/hrana/camembert-zapecen.png')
  await createFood('Burrata s paradižnikom', 12.00, catPredjedi.id, 'Kremasta burrata s sesekljanim paradižnikom volovskega srca in baziliko', '1,2', 9.5, [
  { inv: invMozzarella, qty: 0.12, unit: 'kg' }, { inv: invParadiznik, qty: 0.10, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
], '/menu-images/hrana/burrata-paradiznik.png')
  await createFood('Hladna dila - mesnine in siri', 9.50, catPredjedi.id, 'Mešane suhe mesnine in siri s kruhom', '1,2', 9.5, [
  { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invSalama, qty: 0.05, unit: 'kg' }, { inv: invSunka, qty: 0.05, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }
], '/menu-images/hrana/hladna-dila.png')
  await createFood('Frito misto', 12.00, catPredjedi.id, 'Ocvrte morske dobrote s tartarsko omako', '1,2,4', 9.5, [
  { inv: invKalamari, qty: 0.10, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.10, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/frito-misto-2.png')
}
