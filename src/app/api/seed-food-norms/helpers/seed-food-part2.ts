  // =====================================================================
// SEED HRANE - Burgerji, Ribje jedi, Pice, Solate, Priloge, Sladice, Otroški, Vegetarijanske
  // =====================================================================

import { db } from '@/lib/db'
import { createFood } from './create-food-helper'
import type { InvMap, CatMap } from './types'

export async function seedFoodPart2(inv: InvMap, cat: CatMap): Promise<void> {
  const {
    invAjdovaKasa,
    invArtičoke,
    invBBQOmaka,
    invBrie,
    invBucke,
    invCebula,
    invCesen,
    invCevapci,
    invDivjaci,
    invDrobtine,
    invFeferoni,
    invFeta,
    invGobe,
    invGorgonzola,
    invGovejaPecjenka,
    invHobotnica,
    invJabolka,
    invJagode,
    invJajca,
    invJurcki,
    invKalamari,
    invKislaSmetana,
    invKoruznaMoka,
    invKrompir,
    invKruh,
    invKuhanaZelenjava,
    invLepinja,
    invLignji,
    invLosos,
    invMascarpone,
    invMladiSir,
    invMoka,
    invMorskiSadezi,
    invMozzarella,
    invNjoki,
    invOlive,
    invOlivnoOlje,
    invPanceta,
    invPaprika,
    invParadiznik,
    invParmezan,
    invPecenaZelenjava,
    invPelati,
    invPicaTesto,
    invPiscancjiFile,
    invPolenta,
    invPrsut,
    invRiz,
    invRozbif,
    invRukola,
    invSalama,
    invSladkaSmetana,
    invSlanina,
    invSolata,
    invSunka,
    invTartarskaOmaka,
    invTartufata,
    invTartufnoOlje,
    invTrzaskaOmaka,
    invTuna,
    invTunaKonzerva,
    invZlikrofi,
  } = inv
  const {
    catMesneJedi,
    catOtroški,
    catPice,
    catPriloge,
    catRibjeJedi,
    catSladice,
    catSolate
  } = cat

  await createFood('Lignji ocvrti', 12.00, catRibjeJedi.id, 'Hrustljavi ocvrti lignji s tartarsko omako', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/lignji-ocvrti-2.png')
  await createFood('Lignji na žaru', 12.00, catRibjeJedi.id, 'Lignji na žaru s česnom in peteršiljem', '1,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/lignji-zar-2.png')
  await createFood('Lignji polnjeni', 13.50, catRibjeJedi.id, 'Polnjeni lignji s sirom in šunko', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/lignji-polnjeni.png')
  await createFood('Hobotnica na žaru', 15.00, catRibjeJedi.id, 'Hobotnica na žaru s pečeno zelenjavo', '1,4', 9.5, [
  { inv: invHobotnica, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/hobotnica-zar-3.png')
  await createFood('Tunin steak', 22.50, catRibjeJedi.id, 'Tunin steak z mediteransko zelenjavo in baziličnim oljem', '1,4', 9.5, [
  { inv: invTuna, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/tunin-steak.png')
  await createFood('File bele ribe z blitva', 14.80, catRibjeJedi.id, 'File bele ribe z blitva krompirjem', '1,2,4', 9.5, [
  { inv: invKalamari, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invKuhanaZelenjava, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/file-bele-ribe.png')

  // =====================================================================
// PICE
  // =====================================================================
const picaBase = () => [
  { inv: invPicaTesto, qty: 0.33, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }, { inv: invMozzarella, qty: 0.08, unit: 'kg' }
]
  await createFood('Margerita', 9.50, catPice.id, 'Pelati, mozzarella', '1,2', 9.5, picaBase())
  await createFood('Česnova', 10.00, catPice.id, 'Pelati, mozzarella, česen', '1,2', 9.5, [...picaBase(), { inv: invCesen, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/cesnova-pica.png')
  await createFood('Siciliana', 10.50, catPice.id, 'Pelati, mozzarella, šunka, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.05, unit: 'kg' }, { inv: invGobe, qty: 0.04, unit: 'kg' }],
  '/menu-images/hrana/siciliana-pica.png')
  await createFood('Capricioza', 11.00, catPice.id, 'Pelati, mozzarella, šunka, gobe, artičoke, olive', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }, { inv: invArtičoke, qty: 0.03, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/capricioza-pica.png')
  await createFood('Mafiozo', 11.00, catPice.id, 'Pelati, mozzarella, pikantna salama, feferoni', '1,2', 9.5, [...picaBase(), { inv: invSalama, qty: 0.05, unit: 'kg' }, { inv: invFeferoni, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/mafiozo-pica.png')
  await createFood('Kraška', 13.00, catPice.id, 'Pelati, mozzarella, olive, pršut', '1,2', 9.5, [...picaBase(), { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/kraska-pica.png')
  await createFood('4 siri', 11.00, catPice.id, 'Pelati, mozzarella, gorgonzola, brie, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGorgonzola, qty: 0.04, unit: 'kg' }, { inv: invBrie, qty: 0.04, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/4-siri-pica.png')
  await createFood('Morska', 13.40, catPice.id, 'Pelati, mozzarella, morske dobrote, tržaška omaka', '1,2,4', 9.5, [...picaBase(), { inv: invMorskiSadezi, qty: 0.08, unit: 'kg' }, { inv: invTrzaskaOmaka, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/morska-pica.png')
  await createFood('Tuna', 11.50, catPice.id, 'Pelati, mozzarella, tuna, čebula', '1,2,4', 9.5, [...picaBase(), { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invCebula, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/tuna-zrezek.png')
  await createFood('Zelenjavna', 12.20, catPice.id, 'Pelati, mozzarella, bučke, paprika, gobe', '1,2', 9.5, [...picaBase(), { inv: invBucke, qty: 0.04, unit: 'kg' }, { inv: invPaprika, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/zelenjavna-pica.png')
  await createFood('Tartuf', 15.90, catPice.id, 'Tartufno olje, tartufata, mozzarella, rukola, bufala', '1,2', 9.5, [...picaBase(), { inv: invTartufata, qty: 0.02, unit: 'kg' }, { inv: invTartufnoOlje, qty: 0.005, unit: 'L' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/rizot-gobe-tartufi.png')
  await createFood('BBQ pizza', 11.90, catPice.id, 'Pelati, sir, slanina, piščančji trakci, rdeča čebula, BBQ omaka', '1,2', 9.5, [...picaBase(), { inv: invSlanina, qty: 0.04, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.03, unit: 'L' }],
  '/menu-images/hrana/bbq-pica.png')
  await createFood('Rustika', 12.90, catPice.id, 'Pelati, mozzarella, feta, pršut, rukola, bazilično olje', '1,2', 9.5, [...picaBase(), { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
  '/menu-images/hrana/rustika-pica.png')
  await createFood('Carpaccio', 15.00, catPice.id, 'Pelati, mozzarella, goveji carpaccio, rukola, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGovejaPecjenka, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/carpaccio-pica.png')
  await createFood('Domača', 12.50, catPice.id, 'Pelati, sir, domača šunka, suha salama, panceta, hren, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invSalama, qty: 0.03, unit: 'kg' }, { inv: invPanceta, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
  '/menu-images/hrana/domaca-pica.png')

  // =====================================================================
// SOLATE
  // =====================================================================
  await createFood('Mešana solata', 3.50, catSolate.id, 'Zelena solata, zelje, korenje, paradižnik', '1', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.005, unit: 'L' }
],
  '/menu-images/hrana/mesana-solata.png')
  await createFood('Šopska solata', 4.00, catSolate.id, 'Paradižnik, paprika, kumarice, čebula, feta sir', '1,2', 9.5, [
  { inv: invParadiznik, qty: 0.08, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/sopska-solata.png')
  await createFood('Grška solata', 4.50, catSolate.id, 'Paprika, paradižnik, kumarice, olive, čebula, feta sir', '1,2', 9.5, [
  { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/grska-solata.png')
  await createFood('Italijanska solata', 8.00, catSolate.id, 'Rukola, paradižnik, mozzarella, olive, bazilika, olivno olje', '1,2', 9.5, [
  { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.06, unit: 'kg' }, { inv: invMozzarella, qty: 0.06, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
],
  '/menu-images/hrana/italijanska-solata.png')
  await createFood('Solata s tuno', 10.00, catSolate.id, 'Mešana solata s tuno, sončnična semena, gorčični preliv', '1,2,4', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/solata-s-tuno-2.png')
  await createFood('Piščančja solata', 10.00, catSolate.id, 'Mešana solata z orehi, piščancem, gorčični preliv', '1,2', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/piscancja-solata.png')
  await createFood('Solata z ocvrtim piščancem', 11.00, catSolate.id, 'Solata s hrustljavim ocvrtim piščancem in jogurtovim prelivom', '1,2,3', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/solata-ocvrti-piscanec.png')
  await createFood('Solata z dimljenim lososom', 12.00, catSolate.id, 'Rukola, paradižnik, feta, dimljen losos, jogurtov preliv', '1,2,4', 9.5, [
  { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/solata-losos.png')
  await createFood('Roastbeef solata', 13.50, catSolate.id, 'Listnata solata, paradižnik, roastbeef, jajce, grana padano', '1,2,3', 9.5, [
  { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invRozbif, qty: 0.10, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/roastbeef-solata.png')
  await createFood('Cezar solata', 12.00, catSolate.id, 'Rukola, piščanec, parmezan, krutoni, cezar preliv', '1,2,3', 9.5, [
  { inv: invRukola, qty: 0.05, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invKruh, qty: 0.15, unit: 'kos' }
],
  '/menu-images/hrana/cezar-solata-2.png')

  // =====================================================================
// PRILOGE
  // =====================================================================
  await createFood('Pomfrit', 3.50, catPriloge.id, 'Hrustljav ocvrt krompir', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/pomfri-2.png')
  await createFood('Kuhan krompir', 3.50, catPriloge.id, 'Kuhan krompir z maslom in drobnjakom', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/kuhan-krompir.png')
  await createFood('Pražen krompir', 3.50, catPriloge.id, 'Pražen krompir s čebulo', '1', 9.5, [
  { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/prazen-krompir.png')
  await createFood('Pečena zelenjava', 4.00, catPriloge.id, 'Pečena sezonska zelenjava', '1', 9.5, [
  { inv: invPecenaZelenjava, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/pecena-zelenjava-2.png')
  await createFood('Kuhana zelenjava', 4.00, catPriloge.id, 'Kuhana zelenjava z maslom', '1', 9.5, [
  { inv: invKuhanaZelenjava, qty: 0.20, unit: 'kg' }
],
  '/menu-images/hrana/kuhana-zelenjava-3.png')
  await createFood('Njoki', 3.20, catPriloge.id, 'Krompirjevi njoki kot priloga', '1', 9.5, [
  { inv: invNjoki, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/njoki-preprosti.png')
  await createFood('Žlikrofi', 5.00, catPriloge.id, 'Žlikrofi kot priloga', '1', 9.5, [
  { inv: invZlikrofi, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/zlikrofi-2.png')
  await createFood('Polenta', 3.50, catPriloge.id, 'Kremna polenta', '1', 9.5, [
  { inv: invPolenta, qty: 0.15, unit: 'kg' }
],
  '/menu-images/hrana/zlikrofi.png')
  await createFood('Đuveč riž', 4.00, catPriloge.id, 'Đuveč riž z zelenjavo', '1', 9.5, [
  { inv: invRiz, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/duvec-riz.png')
  await createFood('Lepinja', 2.00, catPriloge.id, 'Sveža lepinja', '1', 9.5, [
  { inv: invLepinja, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/lepinja-2.png')

  // =====================================================================
// SLADICE
  // =====================================================================
  await createFood('Jabolčni zavitek', 4.00, catSladice.id, 'Hrustljav jabolčni zavitek s cimetom', '1,2', 9.5, [
  { inv: invJabolka, qty: 0.15, unit: 'kg' }, { inv: invMoka, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/cesnov-kruh.png')
  await createFood('Panna cotta', 4.00, catSladice.id, 'Kremna panna cotta z jagodnim prelivom', '1,2', 9.5, [
  { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJagode, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/cokoladna-torta.png')
  await createFood('Tiramisu', 4.50, catSladice.id, 'Klasik tiramisu z mascarpone kremo in kavo', '1,2', 9.5, [
  { inv: invMascarpone, qty: 0.08, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }
],
  '/menu-images/hrana/panna-cotta.png')
  await createFood('Lava cake', 5.00, catSladice.id, 'Topla čokoladna tortica s tekočim sredinskim delom', '1,2', 9.5, [
  { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
],
  '/menu-images/hrana/tiramisu.png')
  await createFood('Limonin creme brulee', 5.90, catSladice.id, 'Kremast limonin creme brulee s hrustljavo skorjico', '1,2', 9.5, [
  { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJajca, qty: 2, unit: 'kos' }
],
  '/menu-images/hrana/cokoladni-lava-cake.png')
  await createFood('Bovški krafi', 6.00, catSladice.id, 'Bovški krafi - sladki štruklji s tepkami', '1,2', 9.5, [
  { inv: invZlikrofi, qty: 0.15, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/creme-brulee.png')
  await createFood('Ocvrti sir s steak krompirčki', 10.00, catSladice.id, 'Ocvrti sir s steak krompirčki in domačo tatarsko omako', '1,2,3', 9.5, [
  { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/ocvrti-sir-krompircki.png')

  // =====================================================================
// OTROŠKI MENI
  // =====================================================================
  await createFood('Scooby Doo', 8.00, catOtroški.id, 'Piščančji dunajski in pomfrit', '1,2,3', 9.5, [
  { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/scooby-doo.png')
  await createFood('Duffy Duck', 8.00, catOtroški.id, 'Ocvrti lignji in pomfrit', '1,2,4', 9.5, [
  { inv: invLignji, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/duffy-duck-burger.png')
  await createFood('Aladin', 8.00, catOtroški.id, 'Čevapčiči in pomfrit', '1', 9.5, [
  { inv: invCevapci, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
],
  '/menu-images/hrana/aladin-mesano.png')

  // =====================================================================
// VEGETARIJANSKE JEDI
  // =====================================================================
  await createFood('Vegetarijanski krožnik', 11.00, catMesneJedi.id, 'Sezonska zelenjava, riž, solata', '1', 9.5, [
  { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }, { inv: invRiz, qty: 0.10, unit: 'kg' }, { inv: invSolata, qty: 0.05, unit: 'kg' }
],
  '/menu-images/hrana/vegetarijanski-kroznik.png')
  await createFood('Ocvrti sir', 10.00, catMesneJedi.id, 'Ocvrti sir s pomfrijem in tatarsko omako', '1,2,3', 9.5, [
  { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
],
  '/menu-images/hrana/ocvrti-sir-3.png')
  await createFood('Divjačinski golaž', 12.00, catMesneJedi.id, 'Divjačinski golaž s kruhom ali prilogo', '1', 9.5, [
  { inv: invDivjaci, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.10, unit: 'kg' }
],
  '/menu-images/hrana/golaz-polenta.png')
  await createFood('Ajdrova kaša z jurčki', 11.90, catMesneJedi.id, 'Ajdrova kaša z jurčki, pečenimi bučkami in parmezanom', '1', 9.5, [
  { inv: invAjdovaKasa, qty: 0.15, unit: 'kg' }, { inv: invJurcki, qty: 0.04, unit: 'kg' }, { inv: invBucke, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
],
  '/menu-images/hrana/ajdova-kasa-jurcki.png')
  await createFood('Falafel wrap', 11.20, catMesneJedi.id, 'Hrustljavi falafel v lepinji z zelenjavo in tahini omako', '1,2', 9.5, [
  { inv: invLepinja, qty: 1, unit: 'kos' }, { inv: invSolata, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.04, unit: 'kg' }
],
  '/menu-images/hrana/falafel-wrap.png')

// Get references to items created by beverage seed (if they exist)
const existingKavnaZrna = await db.inventoryItem.findFirst({ where: { name: { contains: 'Kavna zrna' } } })
const existingCokolada = await db.inventoryItem.findFirst({ where: { name: { contains: 'Čokolada za vročo' } } })
const existingSladkor = await db.inventoryItem.findFirst({ where: { name: { contains: 'Sladkor' } } })
const existingMed = await db.inventoryItem.findFirst({ where: { name: { contains: 'Med' } } })
}
