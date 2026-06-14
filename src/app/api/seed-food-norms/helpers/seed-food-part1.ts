  // =====================================================================
// SEED HRANE - Predjedi, Juhe, Testenine, Rižote, Mesne jedi, Žar
  // =====================================================================

import { createFood } from './create-food-helper'
import type { InvMap, CatMap } from './types'

export async function seedFoodPart1(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invBBQOmaka,
    invBolonjskaOmaka,
    invBucke,
    invBurgerBun,
    invCamembert,
    invCebula,
    invCesen,
    invCevapci,
    invColeslaw,
    invDrobtine,
    invFeta,
    invFizol,
    invFuzi,
    invGamberi,
    invGobe,
    invGobovaJuhovina,
    invGorgonzola,
    invGovejaJuhovina,
    invGovejaPecjenka,
    invGovejiFile,
    invGranatnoJabolko,
    invHobotnica,
    invJagode,
    invJajca,
    invJurcki,
    invKajmak,
    invKalamari,
    invKislaSmetana,
    invKisloZelje,
    invKlobasa,
    invKoruznaMoka,
    invKrompir,
    invKruh,
    invLazanjaTesto,
    invLepinja,
    invLosos,
    invMascarpone,
    invMletoGoveje,
    invMletoSvinjsko,
    invMoka,
    invMorskiSadezi,
    invMozzarella,
    invNjoki,
    invOlivnoOlje,
    invOvcjaSkuta,
    invPanceta,
    invPaprika,
    invParadiznik,
    invParmezan,
    invPecenaZelenjava,
    invPelati,
    invPeresniki,
    invPestoGenovese,
    invPiscancjiFile,
    invPleskavica,
    invPolenta,
    invPrsut,
    invPstrv,
    invRiz,
    invRozbif,
    invRukola,
    invSalama,
    invSirokiRezanci,
    invSladkaSmetana,
    invSlanina,
    invSolata,
    invSpageti,
    invSparglji,
    invSunka,
    invSvinjskiKare,
    invSvinjskiVrat,
    invTartarskaOmaka,
    invTartufata,
    invTartufnoOlje,
    invTrzaskaOmaka,
    invZelenjavnaJuhovina,
    invZlikrofi
  } = inv
  const {
    catBurgerji,
    catJuhe,
    catMesneJedi,
    catPredjedi,
    catRibjeJedi,
    catRizote,
    catTestenine,
    catZar
  } = cat

  // =====================================================================
  // PREDJEDI (HLADNE + TOPLE)
  // =====================================================================
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

  // =====================================================================
// JUHE
  // =====================================================================
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

  // =====================================================================
// TESTENINE IN NJOKI
  // =====================================================================
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

  // =====================================================================
// RIŽOTE
  // =====================================================================
  await createFood('Rižota z jurčki', 10.00, catRizote.id, 'Kremna rižota z jurčki in parmezanom', '1', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/rizot-gobe-3.png')
  await createFood('Rižota z morskimi sadeži', 14.00, catRizote.id, 'Rižota z mešanimi morskimi sadeži', '1,4', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.12, unit: 'kg' }, { inv: invPelati, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
],
  '/menu-images/hrana/rizot-morski-sadezi-2.png')
  await createFood('Rižota s piščancem in zelenjavo', 11.00, catRizote.id, 'Rižota s piščančjim mesom in sezonsko zelenjavo', '1', 9.5, [
  { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.08, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
],
  '/menu-images/hrana/rizota-piscanec-zelenjava.png')

  // =====================================================================
// MESNE JEDI - ZREZKI
  // =====================================================================
  await createFood('Dunajski zrezek', 11.00, catMesneJedi.id, 'Klasik - paniran svinjski zrezek s pomfrijem in limono', '1,2,3', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/dunajski-zrezek.png')
  await createFood('Ljubljanski zrezek', 13.00, catMesneJedi.id, 'Paniran svinjski zrezek s šunko in sirom, pekovski krompirček', '1,2,3', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/ljubljanski-zrezek.png')
  await createFood('Piščančji zrezek s sirom', 11.00, catMesneJedi.id, 'Paniran piščančji file s sirom in pomfrijem', '1,2,3', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-sir.png')
  await createFood('Piščančji zrezek z gobami', 12.00, catMesneJedi.id, 'Piščančji file z gobovo omako in pire krompirjem', '1,2', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invGobe, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-gobe.png')
  await createFood('Rozbif z jurčki', 20.00, catMesneJedi.id, 'Goveji rozbif z jurčki in ocvrtim krompirjem', '1,2', 9.5, [
  { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/rozbif-jurcki.png')
  await createFood('Hišni zrezek', 17.00, catMesneJedi.id, 'Specialni hišni zrezek z žara s prilogo', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.25, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/ribeye-zrezek.png')
  await createFood('Svinjski medaljoni v jurčkovi omaki', 12.20, catMesneJedi.id, 'Svinjski medaljoni v kremni jurčkovi omaki z njoki', '1,2', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invNjoki, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/svinjski-kare-2.png')
  await createFood('File mignon na polenti', 26.00, catMesneJedi.id, 'Goveji file mignon na dimljeni polenti s kozjim sirom', '1,2', 9.5, [
  { inv: invGovejiFile, qty: 0.25, unit: 'kg' }, { inv: invPolenta, qty: 0.10, unit: 'kg' }, { inv: invOvcjaSkuta, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/file-mignon-polenta.png')
  await createFood('Rib-eye steak 300g', 26.00, catMesneJedi.id, 'Rib-eye z žara z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
  { inv: invGovejaPecjenka, qty: 0.30, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/ribeye-300g.png')
  await createFood('T-bone 1000g', 36.00, catMesneJedi.id, 'T-bone za dva z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
  { inv: invGovejaPecjenka, qty: 0.50, unit: 'kg' }, { inv: invSvinjskiKare, qty: 0.50, unit: 'kg' }, { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/tbone-1000g.png')

  // =====================================================================
// JEDI Z ŽARA
  // =====================================================================
  await createFood('Čevapčiči', 10.00, catZar.id, 'Domovi čevapčiči s pomfrijem in lepinjo', '1', 9.5, [
  { inv: invCevapci, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/cevapcici.png')
  await createFood('Pleskavica', 10.00, catZar.id, 'Domova pleskavica s pomfrijem in lepinjo', '1', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/pleskavica.png')
  await createFood('Pleskavica s kajmakom', 11.00, catZar.id, 'Pleskavica s kajmakom, pomfrij in lepinja', '1,2', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKajmak, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/pleskavica-kajmak.png')
  await createFood('Polnjena pleskavica', 12.00, catZar.id, 'Pleskavica polnjena sirom s pomfrijem', '1,2', 9.5, [
  { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/polnjena-pleskavica.png')
  await createFood('Vešalica - svinjski kare', 10.00, catZar.id, 'Svinjski kare z žara s pomfrijem', '1', 9.5, [
  { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/svinjski-vrat-zar.png')
  await createFood('Ražnjiči', 10.00, catZar.id, 'Svinjski ražnjiči s papriko in čebulo', '1', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/raznjici.png')
  await createFood('Mešano meso', 15.00, catZar.id, 'Mešano meso z žara s prilogo', '1', 9.5, [
  { inv: invCevapci, qty: 0.10, unit: 'kg' }, { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invSvinjskiKare, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/mesano-meso.png')
  await createFood('Rozbif na žaru', 20.00, catZar.id, 'Goveji rozbif z žara s prilogo', '1', 9.5, [
  { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/rozbif-zar.png')
  await createFood('Pikantna klobasa na žaru', 10.00, catZar.id, 'Pikantna klobasa z žara s pomfrijem', '1', 9.5, [
  { inv: invKlobasa, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/pikantna-klobasa-zar.png')
  await createFood('Piščančji zrezek na žaru', 10.00, catZar.id, 'Piščančji file z žara s prilogo', '1', 9.5, [
  { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/piscanji-zrezek-zar.png')
  await createFood('BBQ rebrca', 14.50, catZar.id, 'Svinjska rebra z BBQ omako in krompirčki', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.30, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.05, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/bbq-rebrca.png')

  // =====================================================================
// BURGERJI
  // =====================================================================
  await createFood('Black Angus burger', 9.50, catBurgerji.id, 'Black Angus burger z domačo omako in krompirčki', '1,2', 9.5, [
  { inv: invMletoGoveje, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/black-angus-burger.png')
  await createFood('Pulled pork burger', 9.00, catBurgerji.id, 'Pulled pork burger sirom, coleslaw in krompirčki', '1,2', 9.5, [
  { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invColeslaw, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/bacon-cheeseburger.png')
  await createFood('Burger z lososom', 11.50, catBurgerji.id, 'Burger z lososom, kaviarjem, rukolo in krompirčki', '1,2,4', 9.5, [
  { inv: invLosos, qty: 0.15, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/burger-losos.png')

  // =====================================================================
// RIBJE JEDI
  // =====================================================================
  await createFood('Postrv s tržaško omako', 16.00, catRibjeJedi.id, 'Celà postrv s tržaško omako in krompirjem', '1,2,4', 9.5, [
  { inv: invPstrv, qty: 1, unit: 'kos' }, { inv: invTrzaskaOmaka, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/pstrv-trzaska-3.png')
  await createFood('Lososov file na žaru', 17.00, catRibjeJedi.id, 'Lososov file z žara s šparglji in pire krompirjem', '1,2,4', 9.5, [
  { inv: invLosos, qty: 0.20, unit: 'kg' }, { inv: invSparglji, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/losos-zar-3.png')
}
