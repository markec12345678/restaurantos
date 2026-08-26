import { CategoryRef, ModifierRef, MenuItemSeed } from './types'

// =====================================================================
// PIJAČA - Topli napitki, mešane pijače, vode, sokovi, gazirane pijače
// =====================================================================

export function getDrinksHotSoft(
  cats: Record<string, CategoryRef>,
  mods: Record<string, ModifierRef>
): MenuItemSeed[] {
  return [
    // --- TOPLI NAPITKI ---
    { name: 'Kava Espresso', description: 'Espresso kava', price: 2.00, image: '/menu-images/topli-napitki/kava-espresso.png', categoryId: cats.topliNapitki.id, sortOrder: 0, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava Macchiato', description: 'Espresso s kapljico mleka', price: 2.10, image: '/menu-images/topli-napitki/kava-macchiato.png', categoryId: cats.topliNapitki.id, sortOrder: 1, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Cappuccino', description: 'Espresso s toplo mlečno peno', price: 2.30, image: '/menu-images/topli-napitki/cappuccino.png', categoryId: cats.topliNapitki.id, sortOrder: 2, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Mlekom', description: 'Kava z mlekom', price: 2.30, image: '/menu-images/topli-napitki/kava-z-mlekom.png', categoryId: cats.topliNapitki.id, sortOrder: 3, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava s Smetano', description: 'Kava s smetano', price: 2.50, image: '/menu-images/topli-napitki/kava-s-smetano.png', categoryId: cats.topliNapitki.id, sortOrder: 4, modifierGroupIds: [mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Bela Kava', description: 'Kava z veliko mlekom', price: 2.80, image: '/menu-images/topli-napitki/bela-kava.png', categoryId: cats.topliNapitki.id, sortOrder: 5, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id, mods.alcoholAdd.id] },
    { name: 'Kava Espresso Brez Kofeina', description: 'Dekofeinizirana espresso kava', price: 2.30, image: '/menu-images/topli-napitki/kava-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 6, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Mlekom Brez Kofeina', description: 'Dekofeinizirana kava z mlekom', price: 2.50, image: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 7, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Cappuccino Brez Kofeina', description: 'Dekofeinizirani cappuccino', price: 2.60, image: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 8, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava Macchiato Brez Kofeina', description: 'Dekofeinizirana kava macchiato', price: 2.20, image: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 9, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Bela Kava Brez Kofeina', description: 'Dekofeinizirana bela kava', price: 3.00, image: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', categoryId: cats.topliNapitki.id, sortOrder: 10, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kava z Riževim Mlekom', description: 'Kava z riževim mlekom', price: 3.00, image: '/menu-images/topli-napitki/kava-rizevo-mleko.png', categoryId: cats.topliNapitki.id, sortOrder: 11, modifierGroupIds: [mods.sweetenerChoice.id] },
    { name: 'Kakav', description: 'Topla čokoladna pijača', price: 3.00, image: '/menu-images/topli-napitki/kakav.png', categoryId: cats.topliNapitki.id, sortOrder: 12, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Kakav s Smetano', description: 'Kakav s smetano', price: 3.50, image: '/menu-images/topli-napitki/kakav-smetana.png', categoryId: cats.topliNapitki.id, sortOrder: 13, modifierGroupIds: [mods.sweetenerChoice.id] },
    { name: 'Babyccino', description: 'Otroška kava', price: 1.00, image: '/menu-images/topli-napitki/babyccino.png', categoryId: cats.topliNapitki.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Vroča Čokolada', description: 'Gosta čokolada s smetano', price: 4.50, image: '/menu-images/topli-napitki/vroca-cokolada.png', categoryId: cats.topliNapitki.id, sortOrder: 15, modifierGroupIds: [mods.milkChoice.id, mods.sweetenerChoice.id] },
    { name: 'Čaj z Limono in Medom', description: 'Topel čaj z limono in medom', price: 3.00, image: '/menu-images/topli-napitki/caj-skodelica.png', categoryId: cats.topliNapitki.id, sortOrder: 16, modifierGroupIds: [mods.sweetenerChoice.id, mods.milkChoice.id] },
    { name: 'Ledena Kava Olimia', description: 'Kava, sladoled, čokolada, smetana', price: 6.50, image: '/menu-images/topli-napitki/ledena-kava-olimia.png', categoryId: cats.topliNapitki.id, sortOrder: 17, modifierGroupIds: [mods.iceChoice.id] },

    // --- MEŠANE PIJAČE ---
    { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/aperol-spritz.png', categoryId: cats.mesanePijace.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Martini Spritz', description: 'Martini bianco, prosecco, soda, limeta', price: 8.00, image: '/menu-images/mesane-pijace/martini-spritz.png', categoryId: cats.mesanePijace.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Negroni', description: 'Gin, vermut, campari, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/negroni.png', categoryId: cats.mesanePijace.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cuba Libre', description: 'Rum Havana, Coca-Cola, limeta', price: 8.00, image: '/menu-images/mesane-pijace/cuba-libre.png', categoryId: cats.mesanePijace.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Mojito', description: 'Rum, soda, sladkor, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Mango Mojito', description: 'Rum, soda, mango Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mango-mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Strawberry Mojito', description: 'Rum, soda, jagoda Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/strawberry-mojito.png', categoryId: cats.mesanePijace.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'London Dry Gin Tonic', description: 'Gin Kristal London dry, Fever Tree tonic water, limeta', price: 8.00, image: '/menu-images/mesane-pijace/london-dry-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 7, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Monologue Gin Tonic', description: 'Slovenija | Tonic water, brinove jagode, limeta', price: 8.00, image: '/menu-images/mesane-pijace/monolog-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hendrick\'s Gin Tonic', description: 'Škotska | Tonic water, kumara', price: 8.50, image: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 9, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Gin Mare Tonic', description: 'Španija | Mediterranean tonik, limeta, rožmarin', price: 8.50, image: '/menu-images/mesane-pijace/gin-mare-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 10, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Monkey 47 Gin Tonic', description: 'Nemčija | Tonic water, brinove jagode, rožmarin, limona', price: 9.00, image: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 11, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Orange & Ginger Gin Tonic', description: 'Gin Kristal Orange&Ginger, Ginger Ale tonic, pomaranča', price: 8.00, image: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 12, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Raspberry Pink Gin Tonic', description: 'Gin Kristal Raspberry, Rhubarb&Raspberry tonic, meta', price: 8.00, image: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', categoryId: cats.mesanePijace.id, sortOrder: 13, modifierGroupIds: [mods.iceChoice.id] },

    // --- VODE ---
    { name: 'Mineralna Voda (0.25L)', description: 'Mineralna voda | 0.25L', price: 2.50, image: '/menu-images/vode/mineralna-voda-025.png', categoryId: cats.vode.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Mineralna Voda (0.50L)', description: 'Mineralna voda | 0.50L', price: 3.50, image: '/menu-images/vode/mineralna-voda-050.png', categoryId: cats.vode.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Mineralna Voda (1.00L)', description: 'Mineralna voda | 1.00L', price: 5.00, image: '/menu-images/vode/mineralna-voda-100.png', categoryId: cats.vode.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.25L)', description: 'Naravna voda | 0.25L', price: 2.50, image: '/menu-images/vode/naravna-voda-025.png', categoryId: cats.vode.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.50L)', description: 'Naravna voda | 0.50L', price: 3.50, image: '/menu-images/vode/naravna-voda-050.png', categoryId: cats.vode.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Naravna Voda (1.00L)', description: 'Naravna voda | 1.00L', price: 5.00, image: '/menu-images/vode/naravna-voda-100.png', categoryId: cats.vode.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Naravna Voda z Okusom (0.50L)', description: 'Okusna naravna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/voda-z-okusom.png', categoryId: cats.vode.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Voda Radenska FunctionALL (0.50L)', description: 'Funkcionalna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/radenska-functionall.png', categoryId: cats.vode.id, sortOrder: 7, modifierGroupIds: [] },

    // --- NARAVNI SOKOVI ---
    { name: 'Limonada (0.35L)', description: 'Klasična limonada | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/limonada.png', categoryId: cats.naravniSokovi.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Limonada z Okusom (0.35L)', description: 'Meta, bezeg, ingver | 0.35L', price: 4.50, image: '/menu-images/naravni-sokovi/limonada-okus.png', categoryId: cats.naravniSokovi.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hišni Sok Meta (0.35L)', description: 'Domač metin sok | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-sok-meta.png', categoryId: cats.naravniSokovi.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Hišni Ledeni Čaj (0.35L)', description: 'Domač ledeni čaj | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', categoryId: cats.naravniSokovi.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Naravni Pomarančni Sok (0.10L)', description: 'Sveže stisnjen pomarančni sok | 0.10L', price: 2.00, image: '/menu-images/naravni-sokovi/pomarancni-sok.png', categoryId: cats.naravniSokovi.id, sortOrder: 4, modifierGroupIds: [] },

    // --- SOKOVI ---
    { name: 'Marelični Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/marelicni-sok.png', categoryId: cats.sokovi.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Naravni Jabolčni Sok 100% (0.20L)', description: '100% naravni | 0.20L', price: 3.80, image: '/menu-images/sokovi/jabolcni-sok.png', categoryId: cats.sokovi.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Ribezov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ribezov-sok.png', categoryId: cats.sokovi.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Ananasov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ananasov-sok.png', categoryId: cats.sokovi.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pomarančni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/pomarancni-sok.png', categoryId: cats.sokovi.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Jagodni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/jagodni-sok.png', categoryId: cats.sokovi.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Ledeni Čaj (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/sokovi/ledeni-caj.png', categoryId: cats.sokovi.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cedevita (0.30L)', description: '0.30L', price: 3.50, image: '/menu-images/sokovi/cedevita.png', categoryId: cats.sokovi.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Bubble Tea (0.36L)', description: '0.36L', price: 6.50, image: '/menu-images/sokovi/bubble-tea.png', categoryId: cats.sokovi.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },

    // --- GAZIRANE PIJAČE ---
    { name: 'Coca Cola (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola.png', categoryId: cats.gaziranePijace.id, sortOrder: 0, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Coca Cola Zero (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola-zero.png', categoryId: cats.gaziranePijace.id, sortOrder: 1, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fanta (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/fanta.png', categoryId: cats.gaziranePijace.id, sortOrder: 2, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Cockta (0.275L)', description: 'Slovenska originalna | 0.275L', price: 3.50, image: '/menu-images/gazirane-pijace/cockta.png', categoryId: cats.gaziranePijace.id, sortOrder: 3, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Sprite (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/sprite.png', categoryId: cats.gaziranePijace.id, sortOrder: 4, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Schweppes Tonic Water (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-tonic.png', categoryId: cats.gaziranePijace.id, sortOrder: 5, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Schweppes Bitter Lemon (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-bitter.png', categoryId: cats.gaziranePijace.id, sortOrder: 6, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Tonic Water (0.20L)', description: 'Premium tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-tonic.png', categoryId: cats.gaziranePijace.id, sortOrder: 7, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Mediterranean Tonic (0.20L)', description: 'Premium mediteranski tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-med.png', categoryId: cats.gaziranePijace.id, sortOrder: 8, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Fever Tree Rhubarb & Raspberry Tonic (0.20L)', description: 'Premium rabarbara & malina tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', categoryId: cats.gaziranePijace.id, sortOrder: 9, modifierGroupIds: [mods.iceChoice.id] },
    { name: 'Red Bull (0.20L)', description: '0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/red-bull.png', categoryId: cats.gaziranePijace.id, sortOrder: 10, modifierGroupIds: [mods.iceChoice.id] },
  ]
}
