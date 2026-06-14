import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUTPUT_BASE = '/home/z/my-project/public/menu-images';

// All items that need unique images (duplicates identified by md5 analysis)
const ITEMS = [
  // BELA VINA (White Wines) - 20 items sharing same image
  { file: 'bela-vina/cuvee-emino.png', prompt: 'Professional food photography of a glass of white wine Cuvee Emino, elegant wine glass with golden white wine, dark moody restaurant background, soft warm lighting, shallow depth of field' },
  { file: 'bela-vina/chardonnay-verus.png', prompt: 'Professional food photography of a glass of Chardonnay Verus white wine, pale golden color in crystal wine glass, green bottle beside, dark restaurant table, ambient lighting' },
  { file: 'bela-vina/sauvignon-blanc-cru.png', prompt: 'Professional food photography of Sauvignon Blanc Cru white wine in elegant glass, pale straw yellow color, fresh aromatic look, restaurant setting, warm soft light' },
  { file: 'bela-vina/laski-rizling.png', prompt: 'Professional food photography of Laski Rizling white wine, golden yellow wine in crystal glass, Slovenian wine tradition, rustic elegant setting, soft warm lighting' },
  { file: 'bela-vina/traminec.png', prompt: 'Professional food photography of Traminec white wine, distinctive amber-gold color in crystal wine glass, aromatic wine, floral notes, elegant restaurant table, moody lighting' },
  { file: 'bela-vina/rebula.png', prompt: 'Professional food photography of Rebula white wine, bright golden yellow in elegant wine glass, Brda region Slovenian wine, dark table, warm ambient light' },
  { file: 'bela-vina/chardonnay-dular.png', prompt: 'Professional food photography of Chardonnay Dular white wine, rich golden color in crystal glass, premium Slovenian chardonnay, barrel-aged look, elegant dark background' },
  { file: 'bela-vina/chardonnay-vicomte.png', prompt: 'Professional food photography of Chardonnay Vicomte white wine, pale gold wine in elegant crystal glass, French-style Slovenian wine, sophisticated dark background, soft lighting' },
  { file: 'bela-vina/sipon-verus.png', prompt: 'Professional food photography of Sipon Verus white wine, light golden wine in crystal glass, unique Slovenian grape variety, fresh vibrant look, dark restaurant table' },
  { file: 'bela-vina/sivi-pinot-jamertal.png', prompt: 'Professional food photography of Sivi Pinot Jamertal white wine, Pinot Gris golden copper tint in crystal glass, elegant Slovenian wine, dark background' },
  { file: 'bela-vina/renski-rizling-stare.png', prompt: 'Professional food photography of Renski Rizling Stare white wine, bright pale gold in crystal glass, Riesling wine, Slovenian premium, elegant dark table' },
  { file: 'bela-vina/renski-rizling-keltis.png', prompt: 'Professional food photography of Renski Rizling Keltis white wine, golden yellow Riesling in crystal glass, premium Slovenian wine, dark moody background' },
  { file: 'bela-vina/alter.png', prompt: 'Professional food photography of Alter white wine blend, pale golden in modern crystal glass, innovative Slovenian wine, contemporary dark background' },
  { file: 'bela-vina/malvazija-movia.png', prompt: 'Professional food photography of Malvazija Movia white wine, amber golden in elegant glass, natural wine aesthetic, Movia winery prestige, dark table' },
  { file: 'bela-vina/rebula-cru.png', prompt: 'Professional food photography of Rebula Cru white wine, deep golden in crystal glass, premium Brda region wine, sophisticated dark background' },
  { file: 'bela-vina/burja-bela.png', prompt: 'Professional food photography of Burja Bela white wine, bright pale gold in modern glass, natural biodynamic Slovenian wine, minimalist dark background' },
  { file: 'bela-vina/angel-belo-2021.png', prompt: 'Professional food photography of Angel Belo 2021 white wine, light golden in crystal glass, elegant modern Slovenian wine, dark background' },
  { file: 'bela-vina/angel-belo-2019.png', prompt: 'Professional food photography of Angel Belo 2019 white wine, deeper golden aged tone in crystal glass, mature vintage Slovenian wine, dark table' },
  { file: 'bela-vina/rumeni-muskat.png', prompt: 'Professional food photography of Rumeni Muskat white wine, bright golden aromatic wine in crystal glass, Muscat grape variety, floral elegant, dark background' },
  { file: 'bela-vina/rumeni-muskat-pozna.png', prompt: 'Professional food photography of Rumeni Muskat Pozna white wine, deep amber golden late harvest in crystal glass, dessert wine style, dark background' },
  { file: 'bela-vina/bela-frankinja.png', prompt: 'Professional food photography of Bela Frankinja white wine, pale golden Blaufrankisch white in crystal glass, unique Slovenian variety, elegant dark table' },

  // RDECA VINA (Red Wines) - 14 items
  { file: 'rdeca-vina/modra-frankinja-dular.png', prompt: 'Professional food photography of Modra Frankinja Dular red wine, deep ruby red in crystal wine glass, Slovenian Blaufrankisch, dark elegant background' },
  { file: 'rdeca-vina/modra-frankinja-luna.png', prompt: 'Professional food photography of Modra Frankinja Luna red wine, vibrant ruby red in crystal glass, premium Slovenian red wine, dark table' },
  { file: 'rdeca-vina/modri-pinot-verus.png', prompt: 'Professional food photography of Modri Pinot Verus red wine, translucent ruby Pinot Noir in crystal glass, elegant Slovenian wine, dark background' },
  { file: 'rdeca-vina/modri-pinot-opoka.png', prompt: 'Professional food photography of Modri Pinot Opoka red wine, deep ruby Pinot Noir in crystal glass, mineral terroir expression, premium Slovenian wine, dark moody background' },
  { file: 'rdeca-vina/merlot-keltis.png', prompt: 'Professional food photography of Merlot Keltis red wine, deep garnet red in crystal glass, full-bodied Slovenian Merlot, dark elegant table' },
  { file: 'rdeca-vina/merlot-opoka.png', prompt: 'Professional food photography of Merlot Opoka red wine, dark plum red in crystal glass, mineral-rich terroir Merlot, sophisticated dark background' },
  { file: 'rdeca-vina/cabernet-keltis.png', prompt: 'Professional food photography of Cabernet Keltis red wine, deep dark ruby in crystal glass, structured Slovenian Cabernet, elegant dark table' },
  { file: 'rdeca-vina/cabernet-pavo.png', prompt: 'Professional food photography of Cabernet Pavo red wine, intense dark red in crystal glass, bold Slovenian Cabernet Sauvignon, dark background' },
  { file: 'rdeca-vina/guerila-retro.png', prompt: 'Professional food photography of Guerila Retro red wine, deep purple-red in modern glass, rebellious natural Slovenian wine, contemporary dark setting' },
  { file: 'rdeca-vina/duet-edi-simcic.png', prompt: 'Professional food photography of Duet Edi Simcic red wine, deep garnet in crystal glass, iconic Slovenian premium blend, luxurious dark background' },
  { file: 'rdeca-vina/duet-lex-2018.png', prompt: 'Professional food photography of Duet Lex 2018 red wine, deep ruby in crystal glass, premium vintage Slovenian blend, sophisticated dark table' },
  { file: 'rdeca-vina/duet-lex-2020.png', prompt: 'Professional food photography of Duet Lex 2020 red wine, vibrant ruby in crystal glass, young premium Slovenian blend, dark elegant background' },
  { file: 'rdeca-vina/carolina-rdeca.png', prompt: 'Professional food photography of Carolina Rdeca red wine, deep crimson in crystal glass, elegant Slovenian red blend, dark table' },
  { file: 'rdeca-vina/veliko-rdece-movia.png', prompt: 'Professional food photography of Veliko Rdece Movia red wine, deep dark ruby in elegant glass, legendary Movia red, premium dark background' },

  // PENINE (Sparkling) - 11 items
  { file: 'penine/no1-brut.png', prompt: 'Professional food photography of No1 Brut sparkling wine in tall champagne flute, fine bubbles rising, pale golden color, elegant celebration setting, dark background' },
  { file: 'penine/slapsak-brut-reserve.png', prompt: 'Professional food photography of Domaine Slapsak Brut Reserve sparkling wine in champagne flute, persistent bubbles, golden hue, premium Slovenian, dark background' },
  { file: 'penine/slapsak-brut-rose.png', prompt: 'Professional food photography of Domaine Slapsak Brut Rose sparkling wine in champagne flute, delicate pink color, fine bubbles, romantic dark background' },
  { file: 'penine/gourmet-rose.png', prompt: 'Professional food photography of Penina Gourmet Rose sparkling wine in elegant flute, salmon pink color, fine effervescence, premium Slovenian, dark table' },
  { file: 'penine/zlata-radgonska.png', prompt: 'Professional food photography of Zlata Radgonska sparkling wine in champagne flute, golden bubbles, classic Slovenian tradition, elegant dark background' },
  { file: 'penine/maria-brut.png', prompt: 'Professional food photography of Maria Brut 2020 sparkling wine in tall flute, pale gold with fine mousse, elegant Slovenian, dark background' },
  { file: 'penine/boemme-rumeni-muskat.png', prompt: 'Professional food photography of Boemme Rumeni Muskat sparkling wine in flute, golden aromatic Muscat bubbles, unique Slovenian, dark background' },
  { file: 'penine/bjana-brut.png', prompt: 'Professional food photography of Bjana Brut sparkling wine in champagne flute, bright golden with fine bubbles, premium Slovenian, dark elegant setting' },
  { file: 'penine/mufi-pet-nat.png', prompt: 'Professional food photography of Mufi Pet Nat natural sparkling wine in glass, cloudy pale with natural sediment, fun artisan Slovenian, dark background' },
  { file: 'penine/louis-roederer.png', prompt: 'Professional food photography of Louis Roederer champagne in crystal flute, ultra-fine bubbles, golden prestige champagne, luxury dark background' },
  { file: 'penine/pol-roger.png', prompt: 'Professional food photography of Pol Roger champagne in elegant flute, fine persistent bubbles, golden classic champagne, dark premium background' },
  { file: 'penine/dom-perignon.png', prompt: 'Professional food photography of Dom Perignon champagne in crystal flute, ultra-fine mousse, deep golden prestige cuvee, ultra-luxury dark setting' },

  // TOPLI NAPITKI (Hot Drinks) - 16 items
  { file: 'topli-napitki/kava-macchiato.png', prompt: 'Professional food photography of espresso macchiato, small cup with espresso and dot of milk foam, Italian coffee culture, dark moody background' },
  { file: 'topli-napitki/bela-kava.png', prompt: 'Professional food photography of bela kava white coffee, large cup with light milky coffee, Slovenian tradition, saucer with spoon, dark table' },
  { file: 'topli-napitki/kava-z-mlekom.png', prompt: 'Professional food photography of coffee with milk, medium cup with creamy coffee steaming, saucer, dark elegant background, warm lighting' },
  { file: 'topli-napitki/kava-s-smethano.png', prompt: 'Professional food photography of coffee with cream, elegant cup topped with whipped cream, rich coffee aroma, dark table, warm lighting' },
  { file: 'topli-napitki/bela-kava-brez-kofeina.png', prompt: 'Professional food photography of decaffeinated white coffee, light milky decaf coffee in large cup, gentle warm tones, dark background' },
  { file: 'topli-napitki/cappuccino-brez-kofeina.png', prompt: 'Professional food photography of decaf cappuccino, rich milk foam art on decaffeinated cappuccino, warm cup, dark elegant background' },
  { file: 'topli-napitki/kava-brez-kofeina.png', prompt: 'Professional food photography of decaffeinated espresso, small espresso cup with dark decaf coffee, crema on top, dark moody background' },
  { file: 'topli-napitki/kava-mleko-brez-kofeina.png', prompt: 'Professional food photography of decaf coffee with milk, medium cup with light decaf coffee, gentle and warm, dark table' },
  { file: 'topli-napitki/macchiato-brez-kofeina.png', prompt: 'Professional food photography of decaf macchiato, small cup with decaf espresso and milk dot, Italian style, dark background' },
  { file: 'topli-napitki/kava-rizevo-mleko.png', prompt: 'Professional food photography of coffee with rice milk, modern cup with plant-based milk coffee, latte art, contemporary dark background' },
  { file: 'topli-napitki/kakav.png', prompt: 'Professional food photography of hot cocoa, rich dark hot chocolate in ceramic mug, steaming, dark moody background' },
  { file: 'topli-napitki/kakav-smetana.png', prompt: 'Professional food photography of hot cocoa with whipped cream, rich hot chocolate topped with cream and cocoa powder, dark elegant background' },
  { file: 'topli-napitki/babyccino.png', prompt: 'Professional food photography of babyccino, small cup with warm milk foam and cocoa sprinkle, cute presentation, dark table' },
  { file: 'topli-napitki/vroca-cokolada.png', prompt: 'Professional food photography of hot chocolate, thick rich dark hot chocolate in elegant cup, chocolate shavings, dark moody background' },
  { file: 'topli-napitki/caj-limona-med.png', prompt: 'Professional food photography of tea with lemon and honey, herbal tea in glass cup with lemon slice and honey, warm and soothing, dark table' },
  { file: 'topli-napitki/ledena-kava-olimia.png', prompt: 'Professional food photography of iced coffee, tall glass with cold coffee, ice cubes, milk layers, refreshing, dark background' },

  // GAZIRANE PIJACE (Carbonated Drinks) - 10 items
  { file: 'gazirane-pijace/coca-cola-zero.png', prompt: 'Professional food photography of Coca Cola Zero in glass with ice, dark cola drink, ice cubes, dark background, refreshing cool lighting' },
  { file: 'gazirane-pijace/cockta.png', prompt: 'Professional food photography of Cockta soda in glass with ice, Slovenian herbal cola drink, ice cubes, retro glass bottle beside, dark background' },
  { file: 'gazirane-pijace/fanta.png', prompt: 'Professional food photography of Fanta orange soda in glass with ice, bright orange carbonated drink, ice cubes, dark background' },
  { file: 'gazirane-pijace/fever-tree-tonic.png', prompt: 'Professional food photography of Fever Tree Tonic Water in glass with ice, crystal clear sparkling tonic, premium mixer, lime wedge, dark background' },
  { file: 'gazirane-pijace/fever-tree-med.png', prompt: 'Professional food photography of Fever Tree Mediterranean Tonic in glass with ice, slightly golden tonic water, citrus garnish, dark background' },
  { file: 'gazirane-pijace/fever-tree-rhubarb.png', prompt: 'Professional food photography of Fever Tree Rhubarb and Raspberry Tonic in glass with ice, pink tinted premium tonic, dark background' },
  { file: 'gazirane-pijace/red-bull.png', prompt: 'Professional food photography of Red Bull energy drink in glass with ice, amber energy drink, ice cubes, dark background, dynamic lighting' },
  { file: 'gazirane-pijace/schweppes-tonic.png', prompt: 'Professional food photography of Schweppes Tonic Water in glass with ice, clear sparkling tonic, ice cubes and lime, dark background' },
  { file: 'gazirane-pijace/schweppes-bitter.png', prompt: 'Professional food photography of Schweppes Bitter Lemon in glass with ice, pale yellow bitter lemon soda, lemon garnish, dark background' },
  { file: 'gazirane-pijace/sprite.png', prompt: 'Professional food photography of Sprite lemon-lime soda in glass with ice, clear green-tinted soda, lime wedge, dark background' },

  // MESANE PIJACE (Cocktails) - 10 items
  { file: 'mesane-pijace/cuba-libre.png', prompt: 'Professional cocktail photography of Cuba Libre, rum and cola in tall glass with lime wedge, ice cubes, dark moody bar background' },
  { file: 'mesane-pijace/martini-spritz.png', prompt: 'Professional cocktail photography of Martini Spritz, vermouth with sparkling water in wine glass, orange slice, ice, dark elegant bar' },
  { file: 'mesane-pijace/mango-mojito.png', prompt: 'Professional cocktail photography of Mango Mojito, fresh mango and mint in tall glass with white rum, soda, ice, dark bar background' },
  { file: 'mesane-pijace/strawberry-mojito.png', prompt: 'Professional cocktail photography of Strawberry Mojito, muddled strawberries and mint in tall glass, white rum, soda, ice, dark bar' },
  { file: 'mesane-pijace/hendricks-gin-tonic.png', prompt: 'Professional cocktail photography of Hendricks Gin and Tonic, premium gin in balloon glass with cucumber ribbon, tonic, ice, dark elegant bar' },
  { file: 'mesane-pijace/monolog-gin-tonic.png', prompt: 'Professional cocktail photography of Monolog Gin and Tonic, Slovenian craft gin in Copa glass with botanical garnish, tonic, ice, dark bar' },
  { file: 'mesane-pijace/gin-mare-tonic.png', prompt: 'Professional cocktail photography of Gin Mare and Tonic, Mediterranean gin in balloon glass with rosemary and olive, tonic, ice, dark bar' },
  { file: 'mesane-pijace/monkey47-gin-tonic.png', prompt: 'Professional cocktail photography of Monkey 47 Gin and Tonic, Black Forest gin in Copa glass with botanical garnish, tonic, ice, dark bar' },
  { file: 'mesane-pijace/orange-ginger-gin-tonic.png', prompt: 'Professional cocktail photography of Orange and Ginger Gin and Tonic, gin in glass with orange wheel and ginger, tonic, ice, dark bar' },
  { file: 'mesane-pijace/raspberry-pink-gin-tonic.png', prompt: 'Professional cocktail photography of Raspberry Pink Gin and Tonic, pink gin in glass with fresh raspberries, tonic, ice, dark elegant bar' },

  // SOKOVI (Juices) - 9 items
  { file: 'sokovi/marelicni-sok.png', prompt: 'Professional food photography of apricot juice in glass, bright orange apricot juice, fresh apricots beside, dark elegant background' },
  { file: 'sokovi/jablocni-sok.png', prompt: 'Professional food photography of apple juice in glass, golden clear apple juice, fresh apples beside, dark elegant background' },
  { file: 'sokovi/ribezov-sok.png', prompt: 'Professional food photography of blackcurrant juice in glass, deep red-purple currant juice, fresh currants beside, dark background' },
  { file: 'sokovi/ananasov-sok.png', prompt: 'Professional food photography of pineapple juice in glass, bright yellow tropical pineapple juice, pineapple slice, dark background' },
  { file: 'sokovi/pomarancni-sok.png', prompt: 'Professional food photography of orange juice in glass, vibrant fresh orange juice, orange slices beside, dark elegant background' },
  { file: 'sokovi/jagodni-sok.png', prompt: 'Professional food photography of strawberry juice in glass, bright red strawberry juice, fresh strawberries beside, dark background' },
  { file: 'sokovi/ledeni-caj.png', prompt: 'Professional food photography of iced tea in tall glass, amber cold tea with ice cubes and lemon, dark background' },
  { file: 'sokovi/cedevita.png', prompt: 'Professional food photography of Cedevita vitamin drink in glass, bright orange effervescent vitamin drink, dark background' },
  { file: 'sokovi/bubble-tea.png', prompt: 'Professional food photography of Bubble Tea boba drink in clear cup, milk tea with tapioca pearls, straw, dark background' },

  // VISKI (Whisky) - 9 items
  { file: 'viski/chivas-12.png', prompt: 'Professional whisky photography of Chivas Regal 12 Year Old, amber whisky in crystal tumbler glass, dark moody bar background' },
  { file: 'viski/johnnie-walker-black.png', prompt: 'Professional whisky photography of Johnnie Walker Black Label, rich amber whisky in crystal tumbler, dark elegant bar' },
  { file: 'viski/jack-daniels.png', prompt: 'Professional whisky photography of Jack Daniels Tennessee Whiskey, golden whisky in tumbler glass, dark bar background' },
  { file: 'viski/jameson.png', prompt: 'Professional whisky photography of Jameson Irish Whiskey, smooth golden whisky in tumbler glass, dark bar background' },
  { file: 'viski/lagavulin-16.png', prompt: 'Professional whisky photography of Lagavulin 16 Year Old Islay Single Malt, deep amber peated whisky in snifter glass, dark moody background' },
  { file: 'viski/laphroaig-10.png', prompt: 'Professional whisky photography of Laphroaig 10 Year Old Islay Single Malt, golden peaty whisky in tasting glass, dark moody bar' },
  { file: 'viski/glenmorangie-lasanta.png', prompt: 'Professional whisky photography of Glenmorangie Lasanta 12 Year Old, rich amber sherry-finished whisky in tulip glass, dark elegant bar' },
  { file: 'viski/glenmorangie-18.png', prompt: 'Professional whisky photography of Glenmorangie 18 Year Old, deep golden mature whisky in crystal tasting glass, dark premium bar' },
  { file: 'viski/nikka-miyagikyo.png', prompt: 'Professional whisky photography of Nikka Miyagikyo Japanese Single Malt, golden elegant Japanese whisky in tasting glass, dark bar' },

  // GIN - 6 items
  { file: 'gin/gin-kristal.png', prompt: 'Professional gin photography of Gin Kristal London Dry, crystal clear gin in copa balloon glass with juniper berries and citrus, dark elegant bar' },
  { file: 'gin/gin-monolog.png', prompt: 'Professional gin photography of Gin Monolog Slovenian craft gin, in balloon glass with local botanicals, dark bar background' },
  { file: 'gin/gin-hendricks.png', prompt: 'Professional gin photography of Hendricks Gin, dark apothecary-style bottle, gin in balloon glass with cucumber and rose petals, dark bar' },
  { file: 'gin/gin-mare.png', prompt: 'Professional gin photography of Gin Mare Mediterranean gin, in copa glass with rosemary sprig and olive, dark bar' },
  { file: 'gin/gin-tanqueray.png', prompt: 'Professional gin photography of Tanqueray London Dry Gin, green bottle, gin in glass with lime and juniper, dark bar background' },
  { file: 'gin/gin-monkey47.png', prompt: 'Professional gin photography of Monkey 47 Schwarzwald Dry Gin, in copa glass with forest botanicals and berries, dark bar' },

  // DESTILATI (Distillates) - 15 items
  { file: 'destilati/viljamovka.png', prompt: 'Professional photography of Viljamovka William pear brandy in small snifter glass, clear fruit brandy, Slovenian tradition, dark background' },
  { file: 'destilati/slivovka.png', prompt: 'Professional photography of Slivovka plum brandy in small snifter glass, golden plum brandy, Slovenian tradition, dark background' },
  { file: 'destilati/brinjevec.png', prompt: 'Professional photography of Brinjevec juniper brandy in small glass, clear herbal brandy with juniper berries, Slovenian tradition, dark background' },
  { file: 'destilati/grappa-sofija.png', prompt: 'Professional photography of Grappa Sofija in small snifter glass, crystal clear Italian-style grape brandy, elegant bottle, dark background' },
  { file: 'destilati/travarica-rossi.png', prompt: 'Professional photography of Travarica Rossi herbal brandy in small snifter, golden herbal brandy with herbs visible, dark background' },
  { file: 'destilati/hennessy-vs.png', prompt: 'Professional cognac photography of Hennessy VS in snifter glass, young cognac amber color, iconic bottle beside, dark luxury background' },
  { file: 'destilati/hennessy-xo.png', prompt: 'Professional cognac photography of Hennessy XO in crystal snifter, deep aged amber cognac, prestigious bottle, dark luxury background' },
  { file: 'destilati/delamaine-xo.png', prompt: 'Professional cognac photography of Delamaine XO in crystal snifter, rich deep amber aged cognac, elegant bottle, dark luxury bar' },
  { file: 'destilati/ararat-6.png', prompt: 'Professional brandy photography of Ararat 6 Year Old Armenian brandy in snifter, golden amber brandy, dark background' },
  { file: 'destilati/ararat-15.png', prompt: 'Professional brandy photography of Ararat 15 Year Old Armenian brandy in snifter, deep amber aged brandy, dark background' },
  { file: 'destilati/ararat-20.png', prompt: 'Professional brandy photography of Ararat 20 Year Old Armenian brandy in crystal snifter, very deep amber premium brandy, dark background' },
  { file: 'destilati/rum-bumbu.png', prompt: 'Professional rum photography of Bumbu Rum in tumbler glass, amber Caribbean rum, dark bar background' },
  { file: 'destilati/rum-zacapa.png', prompt: 'Professional rum photography of Zacapa Centenario Rum in snifter, deep amber premium Guatemalan rum, dark background' },
  { file: 'destilati/rum-diplomatico.png', prompt: 'Professional rum photography of Diplomatico Rum in snifter glass, rich amber Venezuelan rum, dark bar background' },
  { file: 'destilati/rum-la-hechicera.png', prompt: 'Professional rum photography of La Hechicera Rum in snifter, deep amber Colombian rum, dark bar background' },
  { file: 'destilati/rum-havana-club.png', prompt: 'Professional rum photography of Havana Club Rum in tumbler glass, golden Cuban rum, dark bar background' },

  // LIKERJI (Liqueurs) - 6 items
  { file: 'likerji/malibu.png', prompt: 'Professional liqueur photography of Malibu coconut rum liqueur in glass, white milky coconut rum, coconut beside glass, tropical dark background' },
  { file: 'likerji/canella.png', prompt: 'Professional liqueur photography of Canella limoncello in small glass, bright yellow Italian lemon liqueur, lemon beside, dark background' },
  { file: 'likerji/bumbu-cream.png', prompt: 'Professional liqueur photography of Bumbu Cream liqueur in glass, rich creamy rum cream liqueur, dark bar background' },
  { file: 'likerji/carolans.png', prompt: 'Professional liqueur photography of Carolans Irish Cream liqueur in glass, golden cream liqueur, dark background' },
  { file: 'likerji/medica-kejzar.png', prompt: 'Professional liqueur photography of Medica Kejzar honey liqueur in small glass, golden honey brandy, honey dipper beside, dark background' },
  { file: 'likerji/borovnica-kejzar.png', prompt: 'Professional liqueur photography of Borovnica Kejzar blueberry liqueur in small glass, deep purple blueberry liqueur, fresh blueberries, dark background' },

  // GRENCICE (Bitters) - 5 items
  { file: 'grencice/pelinkovec-badel.png', prompt: 'Professional photography of Pelinkovec Badel wormwood bitters in small glass, dark herbal bitter liqueur, dark background' },
  { file: 'grencice/cynar.png', prompt: 'Professional photography of Cynar artichoke bitter in rocks glass with ice, dark amber herbal bitter, dark bar background' },
  { file: 'grencice/jagermeister.png', prompt: 'Professional photography of Jagermeister herbal liqueur in shot glass, dark green-black herbal shot, iconic bottle, dark moody background' },
  { file: 'grencice/amaro.png', prompt: 'Professional photography of Amaro herbal bitter in small glass with ice, dark brown Italian herbal digestive, dark bar background' },
  { file: 'grencice/campari-bitter.png', prompt: 'Professional photography of Campari Bitter in rocks glass with ice, bright red iconic bitter, orange slice, dark bar background' },

  // TOCENO PIVO (Draft Beer) - 4 items
  { file: 'toceno-pivo/haler-nefiltriran.png', prompt: 'Professional beer photography of unfiltered draft beer in tall beer glass, cloudy golden hazy lager, white foam head, dark pub background' },
  { file: 'toceno-pivo/union-lager.png', prompt: 'Professional beer photography of Union Lager draft beer in tall beer glass, clear golden lager, white foam head, dark pub background' },
  { file: 'toceno-pivo/pelicon-ipa.png', prompt: 'Professional beer photography of Pelicon IPA draft beer in craft beer glass, hazy golden IPA, craft brewery aesthetic, dark pub background' },
  { file: 'toceno-pivo/radler.png', prompt: 'Professional beer photography of grapefruit radler in tall glass, light golden grapefruit beer, refreshing, dark pub background' },

  // CRAFT PIVA - 3 items
  { file: 'craft-piva/pelicon-winter.png', prompt: 'Professional beer photography of winter craft beer in tulip glass, dark amber winter ale, dark cozy pub background' },
  { file: 'craft-piva/zeleni-haler.png', prompt: 'Professional beer photography of green craft lager in glass, fresh herbal notes, dark pub background' },
  { file: 'craft-piva/bevog-tak.png', prompt: 'Professional beer photography of Bevog Tak craft beer in tasting glass, bold craft ale, rich amber color, dark craft brewery background' },

  // PIVO - 3 items
  { file: 'pivo/reset-lagerish.png', prompt: 'Professional beer photography of craft lager in pint glass, clear golden lager, white foam, modern craft beer aesthetic, dark background' },
  { file: 'pivo/reset-froggy-ipa.png', prompt: 'Professional beer photography of craft IPA in IPA glass, hazy golden India Pale Ale, citrus hop character, dark background' },
  { file: 'pivo/reset-irish-stout.png', prompt: 'Professional beer photography of Irish stout in pint glass, dark black stout, creamy tan foam head, dark background' },

  // BREZALK PIVO - 2 items
  { file: 'brezalk-pivo/heineken-0.png', prompt: 'Professional beer photography of Heineken 0.0 non-alcoholic beer in glass, golden clear lager, white foam, dark background' },
  { file: 'brezalk-pivo/daura-lager.png', prompt: 'Professional beer photography of Daura Lager non-alcoholic beer in glass, golden lager, white foam head, dark background' },

  // TUJA VINA - 6 items
  { file: 'tuja-vina/posip-terra-madre.png', prompt: 'Professional food photography of Posip Premium white wine in glass, pale golden Croatian wine, dark elegant background' },
  { file: 'tuja-vina/andreis-vinasmora.png', prompt: 'Professional food photography of Andreis Vinasmora white wine in glass, golden wine, dark elegant background' },
  { file: 'tuja-vina/plavac-mali-terra-madre.png', prompt: 'Professional food photography of Plavac Mali Premium red wine in glass, deep ruby Croatian red, dark elegant background' },
  { file: 'tuja-vina/vranec-instinct.png', prompt: 'Professional food photography of Vranec Instinct red wine in glass, deep dark purple Macedonian wine, dark elegant background' },
  { file: 'tuja-vina/jermann-dreams.png', prompt: 'Professional food photography of Jermann Dreams Chardonnay in glass, pale golden premium Italian white wine, dark elegant background' },
  { file: 'tuja-vina/vintage-tunina.png', prompt: 'Professional food photography of Vintage Tunina white wine blend in glass, deep golden premium Italian wine, dark elegant background' },

  // LIKERSKO VINO - 4 items
  { file: 'likersko-vino/keros-belo.png', prompt: 'Professional food photography of Keros Belo dessert wine in small glass, golden amber sweet white wine, dark elegant background' },
  { file: 'likersko-vino/keros-rdece.png', prompt: 'Professional food photography of Keros Rdece dessert wine in small glass, deep ruby sweet red wine, dark elegant background' },
  { file: 'likersko-vino/veliko-rdece-2012.png', prompt: 'Professional food photography of Veliko Rdece Movia 2012 vintage wine in glass, deep aged ruby, dark elegant background' },
  { file: 'likersko-vino/sladki-refosk.png', prompt: 'Professional food photography of Sladki Refosk sweet red wine in glass, deep purple sweet wine, dark elegant background' },

  // NARAVNI SOKOVI - 4 items
  { file: 'naravni-sokovi/limonada-okus.png', prompt: 'Professional food photography of flavored lemonade in tall glass, fresh lemon drink with fruit, ice, mint, dark elegant background' },
  { file: 'naravni-sokovi/hisni-sok-meta.png', prompt: 'Professional food photography of house mint juice in glass, fresh green mint drink with ice, dark background' },
  { file: 'naravni-sokovi/hisni-ledeni-caj.png', prompt: 'Professional food photography of house iced tea in tall glass, amber cold tea with ice and lemon, dark background' },
  { file: 'naravni-sokovi/pomarancni-sok.png', prompt: 'Professional food photography of fresh orange juice in glass, vibrant freshly squeezed orange juice, dark background' },

  // VODE - 4 items
  { file: 'vode/voda-z-okusom.png', prompt: 'Professional food photography of flavored water in glass, clear water with fruit slices and herbs, refreshing, dark background' },
  { file: 'vode/radenska-functionall.png', prompt: 'Professional food photography of Radenska functional sparkling water in glass, bubbles, modern bottle beside, dark background' },
  { file: 'vode/naravna-voda.png', prompt: 'Professional food photography of natural still water in elegant glass, clear pure water, dark minimalist background' },
  { file: 'vode/mineralna-voda.png', prompt: 'Professional food photography of mineral sparkling water in glass, effervescent bubbles in crystal clear water, dark minimalist background' },

  // ROSE VINO - 2 items
  { file: 'rose-vino/rose-batic.png', prompt: 'Professional food photography of Rose Batic wine in glass, elegant pink salmon rose wine, Slovenian premium, dark background' },
  { file: 'rose-vino/rose-verstovsek-steklenica.png', prompt: 'Professional food photography of Rose Verstovsek wine bottle and glass, pink rose wine with bottle, dark elegant background' },
];

async function main() {
  console.log(`=== RestaurantOS Menu Image Generator ===`);
  console.log(`Total items to generate: ${ITEMS.length}`);
  console.log('');

  const zai = await ZAI.create();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const outputPath = path.join(OUTPUT_BASE, item.file);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    process.stdout.write(`[${i + 1}/${ITEMS.length}] Generating: ${item.file} ... `);

    try {
      const response = await zai.images.generations.create({
        prompt: item.prompt,
        size: '1024x1024',
      });

      if (response.data && response.data[0] && response.data[0].base64) {
        const buffer = Buffer.from(response.data[0].base64, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log('OK');
        success++;
      } else {
        console.log('FAILED (no image data)');
        failed++;
      }
    } catch (error) {
      console.log(`FAILED: ${error.message}`);
      failed++;

      // If rate limited, wait longer
      if (error.message && error.message.includes('429')) {
        console.log('Rate limited, waiting 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        // Retry once
        try {
          const response = await zai.images.generations.create({
            prompt: item.prompt,
            size: '1024x1024',
          });
          if (response.data && response.data[0] && response.data[0].base64) {
            const buffer = Buffer.from(response.data[0].base64, 'base64');
            fs.writeFileSync(outputPath, buffer);
            console.log('  Retry OK');
            success++;
            failed--;
          }
        } catch (retryError) {
          console.log(`  Retry FAILED: ${retryError.message}`);
        }
      }
    }

    // Rate limiting: wait 5 seconds between requests
    if (i < ITEMS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('');
  console.log(`=== Generation Complete ===`);
  console.log(`Success: ${success}, Failed: ${failed}, Total: ${ITEMS.length}`);
}

main().catch(console.error);
