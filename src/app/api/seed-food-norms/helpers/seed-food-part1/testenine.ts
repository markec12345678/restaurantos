// =====================================================================
// TESTENINE IN NJOKI
// =====================================================================

import { createFood } from '../create-food-helper'
import type { InvMap, CatMap } from '../types'

export async function seedTestenine(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invSpageti, invPelati, invCesen, invOlivnoOlje, invParmezan,
    invBolonjskaOmaka, invPanceta, invJajca, invMorskiSadezi,
    invPeresniki, invPestoGenovese, invParadiznik,
    invPiscancjiFile, invJurcki, invSladkaSmetana,
    invSirokiRezanci, invGovejiFile, invPaprika,
    invLosos, invFuzi, invTartufata, invTartufnoOlje,
    invGamberi, invSparglji, invMascarpone,
    invNjoki, invBucke, invZlikrofi, invGorgonzola,
    invKislaSmetana, invLazanjaTesto, invMozzarella, invPecenaZelenjava
  } = inv
  const { catTestenine } = cat

  await createFood('Špageti s paradižnikom', 9.00, catTestenine.id, 'Špageti s svežim paradižnikom in baziliko', '1', 9.5, [
  { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invPelati, qty: 0.15, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/spageti-paradiznik.png')
  await createFood('Špageti bolonjske', 10.00, catTestenine.id, 'Špageti z bogato bolonjsko omako', '1,3', 9.5, [
  { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invBolonjskaOmaka, qty: 0.20, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
], '/menu-images/hrana/spageti-bolonjske-3.png')
  await createFood('Špageti carbonara', 11.80, catTestenine.id, 'Klasika s panceto, jajci in parmezanom', '1,2,3', 9.5, [
  { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invPanceta, qty: 0.05, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/spageti-carbonara.png')
  await createFood('Špageti z morskimi sadeži', 14.50, catTestenine.id, 'Špageti z mešanimi morskimi sadeži v omaki iz paradižnika', '1,4', 9.5, [
  { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.15, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/spageti-morski.png')
  await createFood('Peresniki s paradižnikom in pestom', 9.80, catTestenine.id, 'Peresniki s svežim paradižnikom in bazilikinim pestom', '1,3', 9.5, [
  { inv: invPeresniki, qty: 0.20, unit: 'kg' }, { inv: invPestoGenovese, qty: 0.03, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/peresniki-pesto.png')
  await createFood('Peresniki s piščancem in jurčki', 12.50, catTestenine.id, 'Peresniki s piščančjim filejem in jurčki v smetanovi omaki', '1,2', 9.5, [
  { inv: invPeresniki, qty: 0.20, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
],
  '/menu-images/hrana/peresniki-piscanec-jurcki.png')
  await createFood('Široki rezanci z govejim filejem', 14.20, catTestenine.id, 'Široki rezanci s trakci govejega fileja in pečeno papriko', '1', 9.5, [
  { inv: invSirokiRezanci, qty: 0.20, unit: 'kg' }, { inv: invGovejiFile, qty: 0.08, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/fettuccine-alfredo.png')
  await createFood('Široki rezanci z lososom', 13.70, catTestenine.id, 'Široki rezanci z dimljenim lososom in drobnjakom', '1,4', 9.5, [
  { inv: invSirokiRezanci, qty: 0.20, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
],
  '/menu-images/hrana/rezanci-losos.png')
  await createFood('Fuži s tartufi', 13.50, catTestenine.id, 'Fuži s tartufato, tartufnim oljem in parmezanom', '1', 9.5, [
  { inv: invFuzi, qty: 0.20, unit: 'kg' }, { inv: invTartufata, qty: 0.02, unit: 'kg' }, { inv: invTartufnoOlje, qty: 0.005, unit: 'L' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/fuzi-tartufi.png')
  await createFood('Fuži z gamberi', 13.90, catTestenine.id, 'Fuži z gamberi, beluši in panceto v mascarpone omaki', '1,2,4', 9.5, [
  { inv: invFuzi, qty: 0.20, unit: 'kg' }, { inv: invGamberi, qty: 0.06, unit: 'kg' }, { inv: invSparglji, qty: 0.03, unit: 'kg' }, { inv: invPanceta, qty: 0.03, unit: 'kg' }, { inv: invMascarpone, qty: 0.06, unit: 'kg' }
],
  '/menu-images/hrana/fuzi-gamberi.png')
  await createFood('Njoki z jurčki', 12.90, catTestenine.id, 'Mehki njoki z jurčki in smetanovo omako', '1', 9.5, [
  { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/njoki-gorgonzola-2.png')
  await createFood('Njoki z bučkami in panceto', 11.90, catTestenine.id, 'Njoki z bučkami, dimljeno panceto in sušenim paradižnikom', '1', 9.5, [
  { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invBucke, qty: 0.06, unit: 'kg' }, { inv: invPanceta, qty: 0.04, unit: 'kg' }, { inv: invPelati, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/njoki-bucke-panceta.png')
  await createFood('Žlikrofi z gorgonzolo', 12.00, catTestenine.id, 'Klasiki žlikrofi s kremno gorgonzolo', '1,2', 9.5, [
  { inv: invZlikrofi, qty: 0.25, unit: 'kg' }, { inv: invGorgonzola, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
],
  '/menu-images/hrana/njoki-gorgonzola.png')
  await createFood('Žlikrofi s tepkami', 6.00, catTestenine.id, 'Bovški krafi - štruklji s tepkami', '1,2', 9.5, [
  { inv: invZlikrofi, qty: 0.20, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/zlikrofi-tepke.png')
  await createFood('Njoki z lososom', 12.00, catTestenine.id, 'Njoki z lososom v smetanovi omaki', '1,2,4', 9.5, [
  { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
],
  '/menu-images/hrana/njoki-losos.png')
  await createFood('Mesna lazanja', 12.00, catTestenine.id, 'Tradicionalna mesna lazanja z bešamelom in parmezanom', '1,2,3,8', 9.5, [
  { inv: invLazanjaTesto, qty: 0.15, unit: 'kg' }, { inv: invBolonjskaOmaka, qty: 0.20, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/lasanja-2.png')
  await createFood('Zelenjavna lazanja', 12.00, catTestenine.id, 'Lazanja s pečeno zelenjavo in sirom', '1,2', 9.5, [
  { inv: invLazanjaTesto, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }, { inv: invMozzarella, qty: 0.08, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/lasanja.png')
}
