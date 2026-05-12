/**
 * Seed script for Food Menu Expansion
 * Adds new food categories and items to the existing "Hrana" menu
 * Also adds new drink categories to the existing "Pijača" menu
 * 
 * IMPORTANT: Does NOT delete any existing items — only adds new ones
 * 
 * Usage: npx tsx scripts/seed-food-expansion.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🍽️ Seeding Food Menu Expansion...')
  console.log('='.repeat(50))

  // ============================================
  // FIND MENUS BY NAME
  // ============================================
  console.log('\n📂 Locating menus...')

  const hranaMenu = await db.menu.findFirst({ where: { name: 'Hrana' } })
  if (!hranaMenu) {
    console.error('❌ Hrana menu not found! Aborting.')
    process.exit(1)
  }
  console.log(`  ✅ Found Hrana menu (id: ${hranaMenu.id})`)

  const pijacaMenu = await db.menu.findFirst({ where: { name: 'Pijača' } })
  if (!pijacaMenu) {
    console.error('❌ Pijača menu not found! Aborting.')
    process.exit(1)
  }
  console.log(`  ✅ Found Pijača menu (id: ${pijacaMenu.id})`)

  // ============================================
  // FIND EXISTING CATEGORIES FOR APPENDING
  // ============================================
  console.log('\n📂 Locating existing categories for item additions...')

  const predjediCat = await db.category.findFirst({ where: { name: 'Predjedi', menuId: hranaMenu.id } })
  const juheCat = await db.category.findFirst({ where: { name: 'Juhe', menuId: hranaMenu.id } })
  const sladiceCat = await db.category.findFirst({ where: { name: 'Sladice', menuId: hranaMenu.id } })
  const prilogeCat = await db.category.findFirst({ where: { name: 'Priloge', menuId: hranaMenu.id } })

  if (!predjediCat || !juheCat || !sladiceCat || !prilogeCat) {
    console.error('❌ One or more existing categories not found!')
    console.error(`  Predjedi: ${predjediCat ? '✅' : '❌'}`)
    console.error(`  Juhe: ${juheCat ? '✅' : '❌'}`)
    console.error(`  Sladice: ${sladiceCat ? '✅' : '❌'}`)
    console.error(`  Priloge: ${prilogeCat ? '✅' : '❌'}`)
    process.exit(1)
  }
  console.log('  ✅ All existing categories found')

  // Get current max sortOrder for items in each existing category
  const predjediItems = await db.menuItem.findMany({ where: { categoryId: predjediCat.id }, orderBy: { sortOrder: 'desc' } })
  const juheItems = await db.menuItem.findMany({ where: { categoryId: juheCat.id }, orderBy: { sortOrder: 'desc' } })
  const sladiceItems = await db.menuItem.findMany({ where: { categoryId: sladiceCat.id }, orderBy: { sortOrder: 'desc' } })
  const prilogeItems = await db.menuItem.findMany({ where: { categoryId: prilogeCat.id }, orderBy: { sortOrder: 'desc' } })

  const predjediMaxSort = predjediItems.length > 0 ? predjediItems[0].sortOrder + 1 : 0
  const juheMaxSort = juheItems.length > 0 ? juheItems[0].sortOrder + 1 : 0
  const sladiceMaxSort = sladiceItems.length > 0 ? sladiceItems[0].sortOrder + 1 : 0
  const prilogeMaxSort = prilogeItems.length > 0 ? prilogeItems[0].sortOrder + 1 : 0

  // Get current max sortOrder for categories under each menu
  const hranaCategories = await db.category.findMany({ where: { menuId: hranaMenu.id }, orderBy: { sortOrder: 'desc' } })
  const pijacaCategories = await db.category.findMany({ where: { menuId: pijacaMenu.id }, orderBy: { sortOrder: 'desc' } })

  const hranaMaxSort = hranaCategories.length > 0 ? hranaCategories[0].sortOrder + 1 : 0
  const pijacaMaxSort = pijacaCategories.length > 0 ? pijacaCategories[0].sortOrder + 1 : 0

  console.log(`  Hrana next category sortOrder: ${hranaMaxSort}`)
  console.log(`  Pijača next category sortOrder: ${pijacaMaxSort}`)

  // ============================================
  // CREATE NEW FOOD CATEGORIES
  // ============================================
  console.log('\n📂 Creating new food categories under Hrana...')

  const newFoodCategories = await Promise.all([
    db.category.create({ data: { name: 'Solate', icon: '🥗', color: '#22c55e', sortOrder: hranaMaxSort + 0, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Sendviči in Tost', icon: '🥪', color: '#d97706', sortOrder: hranaMaxSort + 1, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Rižote', icon: '🍚', color: '#f59e0b', sortOrder: hranaMaxSort + 2, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Morski Sadeži', icon: '🦐', color: '#0ea5e9', sortOrder: hranaMaxSort + 3, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Žara in Grill', icon: '🔥', color: '#ef4444', sortOrder: hranaMaxSort + 4, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Slovenske Jedi', icon: '🇸🇮', color: '#2563eb', sortOrder: hranaMaxSort + 5, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Dječji Meni', icon: '👶', color: '#f472b6', sortOrder: hranaMaxSort + 6, menuId: hranaMenu.id } }),
    db.category.create({ data: { name: 'Zajtrk in Brunch', icon: '🍳', color: '#eab308', sortOrder: hranaMaxSort + 7, menuId: hranaMenu.id } }),
  ])

  const [solate, sendvici, rizote, morskiSadezi, zara, slovenske, djecji, zajtrk] = newFoodCategories

  console.log(`  ✅ Created ${newFoodCategories.length} new food categories`)

  // ============================================
  // CREATE NEW DRINK CATEGORIES
  // ============================================
  console.log('\n📂 Creating new drink categories under Pijača...')

  const newDrinkCategories = await Promise.all([
    db.category.create({ data: { name: 'Smoothie in Shake', icon: '🥤', color: '#a855f7', sortOrder: pijacaMaxSort + 0, menuId: pijacaMenu.id } }),
    db.category.create({ data: { name: 'Vroča Pijača z Alkoholom', icon: '🫖', color: '#92400e', sortOrder: pijacaMaxSort + 1, menuId: pijacaMenu.id } }),
  ])

  const [smoothie, vracaAlkohol] = newDrinkCategories

  console.log(`  ✅ Created ${newDrinkCategories.length} new drink categories`)

  // ============================================
  // DEFINE ALL NEW MENU ITEMS
  // ============================================
  console.log('\n📝 Preparing menu items...')

  // VAT rates:
  // 22.0 for food (as per instructions)
  // 9.5 for non-alcoholic drinks
  // 22.0 for alcoholic drinks

  type ItemData = {
    name: string
    description: string
    price: number
    image: string
    categoryId: string
    sortOrder: number
    vatRate: number
    allergens: string
  }

  const allNewItems: ItemData[] = [
    // ============================================
    // SOLATE 🥗 (Salads) — 5 items
    // ============================================
    {
      name: 'Mešana solata',
      description: 'Sveža mešana solata s paradižnikom, kumaro, papriko in olivnim oljem',
      price: 6.99,
      image: '/menu-images/solate/mesana-solata.png',
      categoryId: solate.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Solata s piščancem',
      description: 'Griliran piščančji file na postelji mešane solate s paradižnikom, koruzo in prelivom',
      price: 11.49,
      image: '/menu-images/solate/solata-s-piscancem.png',
      categoryId: solate.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Solata s tuno',
      description: 'Tuna na žaru z rukolo, paradižnikom, kaprami in limoninim prelivom',
      price: 12.49,
      image: '/menu-images/solate/solata-s-tuno.png',
      categoryId: solate.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '1,4,7',
    },
    {
      name: 'Grška solata',
      description: 'Klasična grška solata s feta sirom, olivami, kumaro, paradižnikom in rdečo čebulo',
      price: 9.49,
      image: '/menu-images/solate/grska-solata.png',
      categoryId: solate.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Caesar solata s piščancem',
      description: 'Rimski solata s piščancem, parmezanom, krutoni in Caesar prelivom',
      price: 12.99,
      image: '/menu-images/solate/caesar-solata.png',
      categoryId: solate.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '1,3,7',
    },

    // ============================================
    // SENDVIČI IN TOST 🥪 (Sandwiches & Toast) — 5 items
    // ============================================
    {
      name: 'Klasični club sendvič',
      description: 'Triple-decker sendvič s piščancem, slanino, solato, paradižnikom in majonezo',
      price: 10.99,
      image: '/menu-images/sendvici/club-sendvic.png',
      categoryId: sendvici.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '1,3,7,12',
    },
    {
      name: 'Toast s sirom in šunko',
      description: 'Zlati toast s topljenim sirom in pršut šunko, postrežen s kislimi kumaricami',
      price: 7.99,
      image: '/menu-images/sendvici/toast-sirom-sumko.png',
      categoryId: sendvici.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '1,3,7,12',
    },
    {
      name: 'Panini s piščancem',
      description: 'Ciabatta s grilranim piščancem, mozzarella, rukolo in pestom',
      price: 9.49,
      image: '/menu-images/sendvici/panini-piscancem.png',
      categoryId: sendvici.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Toast s šunko in sirom na žaru',
      description: 'Grilran toast s pršut šunko, gouda sirom in gorčico',
      price: 8.49,
      image: '/menu-images/sendvici/toast-zar.png',
      categoryId: sendvici.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '1,3,7,12',
    },
    {
      name: 'Bagel z lososom',
      description: 'Kremni bagel z dimljenim lososom, kremnim sirom, kaprami in rdečo čebulo',
      price: 11.99,
      image: '/menu-images/sendvici/bagel-losos.png',
      categoryId: sendvici.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '1,3,4,7',
    },

    // ============================================
    // RIŽOTE 🍚 (Risottos) — 5 items
    // ============================================
    {
      name: 'Rižota z gobami',
      description: 'Kremna rižota z mešanimi gozdnimi gobami, parmezanom in peteršiljem',
      price: 13.99,
      image: '/menu-images/rizote/rizota-gobami.png',
      categoryId: rizote.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Rižota z morskimi sadeži',
      description: 'Rižota s kozicami, lignji, školjkami in paradižnikovo osnovo',
      price: 18.99,
      image: '/menu-images/rizote/rizota-morskimi-sadezi.png',
      categoryId: rizote.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '1,4,7',
    },
    {
      name: 'Rižota s piščancem in špinačo',
      description: 'Kremna rižota s piščančjim filejem, svežo špinačo in parmezanom',
      price: 14.49,
      image: '/menu-images/rizote/rizota-piscancem-spinaco.png',
      categoryId: rizote.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Rižota s trgli',
      description: 'Premium rižota s črnimi trigli, parmezanom in maslom',
      price: 19.99,
      image: '/menu-images/rizote/rizota-trgli.png',
      categoryId: rizote.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Rižota z zelenjavo',
      description: 'Lahka rižota s sezonsko zelenjavo, baziliko in parmezanom',
      price: 12.99,
      image: '/menu-images/rizote/rizota-zelenjavo.png',
      categoryId: rizote.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '7',
    },

    // ============================================
    // MORSKI SADEŽI 🦐 (Seafood) — 5 items
    // ============================================
    {
      name: 'Ocvrti kozice',
      description: 'Hrustljavo ocvrte kozice s tartar omako in rezino limone',
      price: 14.99,
      image: '/menu-images/morski-sadezi/ocvrti-kozice.png',
      categoryId: morskiSadezi.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '1,3,4,7',
    },
    {
      name: 'Lignji na žaru',
      description: 'Na žaru pripravljeni lignji s česnovim maslom in peteršiljem',
      price: 15.49,
      image: '/menu-images/morski-sadezi/lignji-zaru.png',
      categoryId: morskiSadezi.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '4,7',
    },
    {
      name: 'Ribji file z zelenjavo',
      description: 'File bele ribe na žaru s pečeno zelenjavo in limoninim prelivom',
      price: 16.99,
      image: '/menu-images/morski-sadezi/ribji-file-zelenjavo.png',
      categoryId: morskiSadezi.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '4,7',
    },
    {
      name: 'Školjke v beli omaki',
      description: 'Sveže školjke v kremni beli omaki s česnom, belim vinom in peteršiljem',
      price: 17.99,
      image: '/menu-images/morski-sadezi/skoljke-beli-omaki.png',
      categoryId: morskiSadezi.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '4,7,12',
    },
    {
      name: 'Črni riž s kozicami',
      description: 'Riž s črnilom sipije s kozicami, česnom in parmezanom',
      price: 16.49,
      image: '/menu-images/morski-sadezi/crni-riz-kozicami.png',
      categoryId: morskiSadezi.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '1,4,7',
    },

    // ============================================
    // ŽARA IN GRILL 🔥 (Grill & BBQ) — 5 items
    // ============================================
    {
      name: 'Mešani žar',
      description: 'Izbor svinjine, piščanca in čevapčičev s pečeno zelenjavo in pomfrijem',
      price: 26.99,
      image: '/menu-images/zara/mesani-zar.png',
      categoryId: zara.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Svinjski vrat na žaru',
      description: 'Mariniran svinjski vrat na žaru s pečeno zelenjavo in domačim kruhom',
      price: 16.99,
      image: '/menu-images/zara/svinjski-vrat.png',
      categoryId: zara.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Ćevapčiči s pleskavico',
      description: 'Traditionalni ćevapčiči in pleskavica s svežo čebulo, kajmakom in lepinjo',
      price: 14.99,
      image: '/menu-images/zara/cevapcici-pleskavica.png',
      categoryId: zara.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Piščančji ražnjiči',
      description: 'Piščančji ražnjiči s papriko, čebulo in bučkami, postreženi s pomfrijem',
      price: 15.49,
      image: '/menu-images/zara/piscancji-raznjici.png',
      categoryId: zara.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Teletina na žaru',
      description: 'Premium telečji zrezek na žaru z rožmarinom, pečeno zelenjavo in krompirjem',
      price: 22.99,
      image: '/menu-images/zara/teletina-zaru.png',
      categoryId: zara.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '7',
    },

    // ============================================
    // SLOVENSKE JEDI 🇸🇮 (Slovenian Traditional) — 6 items
    // ============================================
    {
      name: 'Žganci s skuto in ocvirki',
      description: 'Tradicionalni ajdovi žganci s skuto in hrustljavimi ocvirki',
      price: 9.99,
      image: '/menu-images/slovenske/zganci-skuta-ocvirki.png',
      categoryId: slovenske.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '1,7',
    },
    {
      name: 'Kranjska klobasa s kislim zeljem',
      description: 'Kranjska klobasa s kislim zeljem in krompirjem — zaščiteni slovenski izdelek',
      price: 12.99,
      image: '/menu-images/slovenske/kranjska-klobasa.png',
      categoryId: slovenske.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Jota',
      description: 'Tradicionalna jota s kislim zeljem, fižolom in dimljenim rebrcem',
      price: 9.49,
      image: '/menu-images/slovenske/jota.png',
      categoryId: slovenske.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Ajdovi žganci z gobicami',
      description: 'Ajdovi žganci z gobicami in drobtinami — okus domače kuhinje',
      price: 10.49,
      image: '/menu-images/slovenske/ajdovi-zganci-gobicami.png',
      categoryId: slovenske.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '1',
    },
    {
      name: 'Štruklji v maslu',
      description: 'Mehki štruklji v maslu s skorjo — tradicionalna slovenska jed',
      price: 8.99,
      image: '/menu-images/slovenske/struklji-maslu.png',
      categoryId: slovenske.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Ocvrti sir s prilogo',
      description: 'Ocvrti sir v panadu s tartar omako in pomfrijem',
      price: 11.49,
      image: '/menu-images/slovenske/ocvrti-sir.png',
      categoryId: slovenske.id,
      sortOrder: 5,
      vatRate: 22.0,
      allergens: '1,3,7',
    },

    // ============================================
    // DJEČJI MENI 👶 (Kids Menu) — 4 items
    // ============================================
    {
      name: 'Piščančji nageljni',
      description: 'Hrustljavi piščančji nageljni s pomfrijem in kečapom',
      price: 7.99,
      image: '/menu-images/djecji/piscancji-nageljni.png',
      categoryId: djecji.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Mini pica',
      description: 'Mini pica s paradižnikovo omako, sirom in salamo',
      price: 6.99,
      image: '/menu-images/djecji/mini-pica.png',
      categoryId: djecji.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '1,3,7,12',
    },
    {
      name: 'Špageti s paradižnikovo omako',
      description: 'Špageti z nežno paradižnikovo omako in sirom',
      price: 6.49,
      image: '/menu-images/djecji/spageti-paradiznik.png',
      categoryId: djecji.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '1,7',
    },
    {
      name: 'Palačinke s sladkim nadevom',
      description: 'Palačinke z marmelado ali čokoladnim nadevom in sladkim smetano',
      price: 5.99,
      image: '/menu-images/djecji/palacinke-sladko.png',
      categoryId: djecji.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '1,3,7',
    },

    // ============================================
    // ZAJTRK IN BRUNCH 🍳 (Breakfast & Brunch) — 6 items
    // ============================================
    {
      name: 'Angleški zajtrk',
      description: 'Jajca, slanina, klobaska, pečen fižol, toast, paradižnik in gobe',
      price: 12.99,
      image: '/menu-images/zajtrk/angleski-zajtrk.png',
      categoryId: zajtrk.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '1,3,7,12',
    },
    {
      name: 'Jajca na oko s slanino',
      description: 'Dve jajci na oko s hrustljavo slanino in toastom',
      price: 9.49,
      image: '/menu-images/zajtrk/jajca-oko-slanino.png',
      categoryId: zajtrk.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Omleta s sirom in šunko',
      description: 'Puhasta omleta s sirom, šunko in svežim popekom',
      price: 9.99,
      image: '/menu-images/zajtrk/omleta-sirom-sumko.png',
      categoryId: zajtrk.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Ameriške palačinke',
      description: 'Mehke ameriške palačinke z javorovim sirupom, maslom in jagodami',
      price: 8.99,
      image: '/menu-images/zajtrk/ameriske-palacinke.png',
      categoryId: zajtrk.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Avokado toast',
      description: 'Kruh iz kisa z mešanim avokadom, jajcem po mehko in čilijem',
      price: 10.49,
      image: '/menu-images/zajtrk/avokado-toast.png',
      categoryId: zajtrk.id,
      sortOrder: 4,
      vatRate: 22.0,
      allergens: '1,7',
    },
    {
      name: 'Zdrav zajtrk',
      description: 'Ovsena kaša s sadjem, oreščki, medom in jogurtom',
      price: 9.99,
      image: '/menu-images/zajtrk/zdrav-zajtrk.png',
      categoryId: zajtrk.id,
      sortOrder: 5,
      vatRate: 22.0,
      allergens: '1,3,7,8',
    },

    // ============================================
    // ADDITIONS TO PREDJEDI — 3 new items
    // ============================================
    {
      name: 'Kozice v testeninskem listu',
      description: 'Hrustljavo ocvrte kozice v testeninskem listu s sladko-chili omako',
      price: 11.99,
      image: '/menu-images/predjedi/kozice-testeninski-list.png',
      categoryId: predjediCat.id,
      sortOrder: predjediMaxSort + 0,
      vatRate: 22.0,
      allergens: '1,3,4,7',
    },
    {
      name: 'Carpaccio iz govejega mesa',
      description: 'Tanko narezan goveji carpaccio z rukolo, parmezanom, kaprami in olivnim oljem',
      price: 13.49,
      image: '/menu-images/predjedi/carpaccio-govedo.png',
      categoryId: predjediCat.id,
      sortOrder: predjediMaxSort + 1,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Pršut z melono',
      description: 'Zrajen pršut z svežo melono in mladim sirom',
      price: 10.99,
      image: '/menu-images/predjedi/prsut-melona.png',
      categoryId: predjediCat.id,
      sortOrder: predjediMaxSort + 2,
      vatRate: 22.0,
      allergens: '7,12',
    },

    // ============================================
    // ADDITIONS TO JUHE — 2 new items
    // ============================================
    {
      name: 'Čebulna juha',
      description: 'Francoska čebulna juha s karamelizirano čebulo in zapečenim sirom na kruhu',
      price: 7.49,
      image: '/menu-images/juhe/cebulna-juha.png',
      categoryId: juheCat.id,
      sortOrder: juheMaxSort + 0,
      vatRate: 22.0,
      allergens: '1,7',
    },
    {
      name: 'Morska juha',
      description: 'Kremna morska juha z lignji, kozicami in zelišči',
      price: 9.99,
      image: '/menu-images/juhe/morska-juha.png',
      categoryId: juheCat.id,
      sortOrder: juheMaxSort + 1,
      vatRate: 22.0,
      allergens: '1,4,7',
    },

    // ============================================
    // ADDITIONS TO SLADICE — 3 new items
    // ============================================
    {
      name: 'Palačinka s čokolado',
      description: 'Palačinka z bogato čokoladno omako, oreščki in sladko smetano',
      price: 6.99,
      image: '/menu-images/sladice/palacinka-cokolada.png',
      categoryId: sladiceCat.id,
      sortOrder: sladiceMaxSort + 0,
      vatRate: 22.0,
      allergens: '1,3,7,8',
    },
    {
      name: 'Štrudel z jabolki',
      description: 'Topel jabolčni štrudel s cimetom, rozinami in vaniljevo omako',
      price: 7.49,
      image: '/menu-images/sladice/strudel-jabolka.png',
      categoryId: sladiceCat.id,
      sortOrder: sladiceMaxSort + 1,
      vatRate: 22.0,
      allergens: '1,3,7',
    },
    {
      name: 'Sorbet iz limone',
      description: 'Osvežilen limonin sorbet s pistacijami in meto',
      price: 4.99,
      image: '/menu-images/sladice/sorbet-limona.png',
      categoryId: sladiceCat.id,
      sortOrder: sladiceMaxSort + 2,
      vatRate: 22.0,
      allergens: '',
    },

    // ============================================
    // ADDITIONS TO PRILOGE — 4 new items
    // ============================================
    {
      name: 'Riž',
      description: 'Kuhani beli riž z maslom',
      price: 3.99,
      image: '/menu-images/priloge/riz.png',
      categoryId: prilogeCat.id,
      sortOrder: prilogeMaxSort + 0,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Pečen krompir',
      description: 'Pečen krompir z rožmarinom in česnom',
      price: 4.49,
      image: '/menu-images/priloge/pecen-krompir.png',
      categoryId: prilogeCat.id,
      sortOrder: prilogeMaxSort + 1,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Špinača',
      description: 'Kuhana špinača s česnom in maslom',
      price: 4.49,
      image: '/menu-images/priloge/spinaca.png',
      categoryId: prilogeCat.id,
      sortOrder: prilogeMaxSort + 2,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Mešana solata kot priloga',
      description: 'Manjša porcija mešane solate s prelivom',
      price: 3.49,
      image: '/menu-images/priloge/mesana-solata-priloga.png',
      categoryId: prilogeCat.id,
      sortOrder: prilogeMaxSort + 3,
      vatRate: 22.0,
      allergens: '',
    },

    // ============================================
    // SMOOTHIE IN SHAKE 🥤 (Smoothies & Shakes) — 5 items
    // Non-alcoholic drinks → vatRate: 9.5
    // ============================================
    {
      name: 'Smoothie jagoda-banana',
      description: 'Svež smoothie iz jagod in banane z jogurtom in medom',
      price: 5.50,
      image: '/menu-images/smoothie/smoothie-jagoda-banana.png',
      categoryId: smoothie.id,
      sortOrder: 0,
      vatRate: 9.5,
      allergens: '7',
    },
    {
      name: 'Smoothie mango-pasiona',
      description: 'Tropski smoothie iz manga in marakuje s pomarančnim sokom',
      price: 5.50,
      image: '/menu-images/smoothie/smoothie-mango-pasiona.png',
      categoryId: smoothie.id,
      sortOrder: 1,
      vatRate: 9.5,
      allergens: '',
    },
    {
      name: 'Zeleni smoothie',
      description: 'Zeleni smoothie s špinačo, jabolkom, ingverjem in limono',
      price: 5.50,
      image: '/menu-images/smoothie/zeleni-smoothie.png',
      categoryId: smoothie.id,
      sortOrder: 2,
      vatRate: 9.5,
      allergens: '',
    },
    {
      name: 'Čokoladni shake',
      description: 'Kremni čokoladni shake z mlekom in sladoledom',
      price: 5.90,
      image: '/menu-images/smoothie/cokoladni-shake.png',
      categoryId: smoothie.id,
      sortOrder: 3,
      vatRate: 9.5,
      allergens: '3,7',
    },
    {
      name: 'Vaniljev shake',
      description: 'Kremni vaniljev shake z mlekom in sladoledom',
      price: 5.90,
      image: '/menu-images/smoothie/vaniljev-shake.png',
      categoryId: smoothie.id,
      sortOrder: 4,
      vatRate: 9.5,
      allergens: '3,7',
    },

    // ============================================
    // VROČA PIJAČA Z ALKOHOLOM 🫖 (Hot Alcoholic Drinks) — 4 items
    // Alcoholic drinks → vatRate: 22.0
    // ============================================
    {
      name: 'Vroča medica',
      description: 'Topla medica s cimetom, klinčki in pomarančno lupino',
      price: 4.90,
      image: '/menu-images/vroca-alkohol/vroca-medica.png',
      categoryId: vracaAlkohol.id,
      sortOrder: 0,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Kava z žganjem',
      description: 'Kava z dodatkom sadnega žganja in sladkorjem',
      price: 4.50,
      image: '/menu-images/vroca-alkohol/kava-zganjem.png',
      categoryId: vracaAlkohol.id,
      sortOrder: 1,
      vatRate: 22.0,
      allergens: '7',
    },
    {
      name: 'Vroči rum',
      description: 'Topel rum z medom, limono in začimbami',
      price: 5.90,
      image: '/menu-images/vroca-alkohol/vroci-rum.png',
      categoryId: vracaAlkohol.id,
      sortOrder: 2,
      vatRate: 22.0,
      allergens: '',
    },
    {
      name: 'Vroča čokolada z rumom',
      description: 'Bogata vroča čokolada z rumom in sladko smetano',
      price: 6.50,
      image: '/menu-images/vroca-alkohol/vroca-cokolada-rum.png',
      categoryId: vracaAlkohol.id,
      sortOrder: 3,
      vatRate: 22.0,
      allergens: '3,7',
    },
  ]

  console.log(`  📋 Total items to create: ${allNewItems.length}`)

  // ============================================
  // INSERT ALL ITEMS
  // ============================================
  console.log('\n📝 Inserting menu items...')

  let itemCount = 0
  let errorCount = 0

  for (const itemData of allNewItems) {
    try {
      await db.menuItem.create({ data: itemData })
      itemCount++
      if (itemCount % 10 === 0) {
        console.log(`  ... ${itemCount}/${allNewItems.length} items created`)
      }
    } catch (error) {
      errorCount++
      console.error(`  ❌ Error creating "${itemData.name}": ${error}`)
    }
  }

  console.log(`✅ ${itemCount} menu items created successfully` + (errorCount > 0 ? ` (${errorCount} errors)` : ''))

  // ============================================
  // VERIFY AND PRINT SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50))
  console.log('📊 SEED SUMMARY')
  console.log('='.repeat(50))

  // Hrana menu summary
  const hranaCats = await db.category.findMany({
    where: { menuId: hranaMenu.id },
    orderBy: { sortOrder: 'asc' },
  })

  console.log(`\n🍽️ HRANA (Food Menu):`)
  let hranaTotal = 0
  for (const cat of hranaCats) {
    const items = await db.menuItem.findMany({ where: { categoryId: cat.id } })
    hranaTotal += items.length
    const isNew = newFoodCategories.some(c => c.id === cat.id)
    console.log(`  ${cat.icon} ${cat.name}: ${items.length} items${isNew ? ' ✨ NEW' : ''}`)
  }
  console.log(`  ── Total: ${hranaTotal} items`)

  // Pijača menu summary
  const pijacaCats = await db.category.findMany({
    where: { menuId: pijacaMenu.id },
    orderBy: { sortOrder: 'asc' },
  })

  console.log(`\n🥤 PIJAČA (Drinks Menu):`)
  let pijacaTotal = 0
  for (const cat of pijacaCats) {
    const items = await db.menuItem.findMany({ where: { categoryId: cat.id } })
    pijacaTotal += items.length
    const isNew = newDrinkCategories.some(c => c.id === cat.id)
    console.log(`  ${cat.icon} ${cat.name}: ${items.length} items${isNew ? ' ✨ NEW' : ''}`)
  }
  console.log(`  ── Total: ${pijacaTotal} items`)

  console.log(`\n🎉 Grand total: ${hranaTotal + pijacaTotal} items across all menus`)
  console.log(`   Added this run: ${itemCount} new items`)
  console.log(`   New food categories: ${newFoodCategories.length}`)
  console.log(`   New drink categories: ${newDrinkCategories.length}`)
  console.log('\n✅ Food menu expansion complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
