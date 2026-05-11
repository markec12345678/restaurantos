#!/usr/bin/env node
/**
 * UPGRADE menu images from SVG to AI-generated professional photos.
 * Uses z-ai-web-dev-sdk with exponential backoff for rate limiting.
 * 
 * Usage: node scripts/upgrade-images-ai.mjs [--batch N] [--start N]
 *   --batch N  : Process N images per run (default: 5)
 *   --start N  : Start from item index N (default: 0)
 * 
 * Already-generated AI images (files > 30KB) are skipped.
 * On 429 rate limit: waits with exponential backoff up to 5 minutes.
 * Run multiple times to process all images in batches.
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import ZAI from 'z-ai-web-dev-sdk';

const MIN_AI_SIZE = 30000;

const args = process.argv.slice(2);
let BATCH_SIZE = 5;
let START_IDX = 0;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch' && args[i+1]) { BATCH_SIZE = parseInt(args[i+1]); i++; }
  if (args[i] === '--start' && args[i+1]) { START_IDX = parseInt(args[i+1]); i++; }
}

const ITEMS = [
  { path: '/menu-images/bela-vina/alter.png', prompt: 'Elegant bottle of Alter 2021 Slovenian organic white wine cuvee, pale gold color, modern eco label, professional studio product photography, dark moody background, warm spotlight' },
  { path: '/menu-images/bela-vina/angel-belo-2019.png', prompt: 'Large 3L format bottle of Angel Belo Grande Cuvee 2019, Slovenian organic white wine, ornate angel label, premium magnum bottle, professional wine photography, dark background' },
  { path: '/menu-images/bela-vina/angel-belo-2021.png', prompt: 'Bottle of Angel Belo Grande Cuvee 2021 Slovenian organic white wine from Batic winery, elegant angel-themed label, 0.75L wine bottle, professional studio photography, dark background' },
  { path: '/menu-images/bela-vina/bela-frankinja.png', prompt: 'Bottle of Bela Frankinja 2023 Slovenian semi-sweet white wine from Dular winery, golden amber color, distinctive wine label, professional product photography, dark background' },
  { path: '/menu-images/bela-vina/burja-bela.png', prompt: 'Bottle of Burja Bela 2022 Slovenian Demeter biodynamic white wine from Vipava valley, minimalist modern label, professional wine photography, dark elegant background' },
  { path: '/menu-images/bela-vina/chardonnay-dular.png', prompt: 'Bottle of Chardonnay Dular 2022 Slovenian organic white wine from Bizeljsko, elegant green bottle with white label, professional studio wine photography, dark background' },
  { path: '/menu-images/bela-vina/chardonnay-verus.png', prompt: 'Bottle of Chardonnay Verus 2023 premium Slovenian white wine from Styria, sleek modern label, professional product photography, cool elegant lighting, dark background' },
  { path: '/menu-images/bela-vina/chardonnay-vicomte.png', prompt: 'Bottle of Chardonnay Domaine Vicomte de Noue 2020 premium Slovenian white wine from Goriska Brda, French-style elegant label, luxury wine photography, dark background' },
  { path: '/menu-images/bela-vina/cuvee-emino.png', prompt: 'Bottle of Cuvee Emino 2022 Slovenian white wine blend, contemporary wine label, professional wine product photography, dark moody background, warm lighting' },
  { path: '/menu-images/bela-vina/laski-rizling.png', prompt: 'Bottle of Laski Rizling 2021 traditional Slovenian white wine from Dolenjska, classic wine label, professional product photography, dark background, warm lighting' },
  { path: '/menu-images/bela-vina/malvazija-movia.png', prompt: 'Bottle of Malvazija Malval Movia 2023 premium Slovenian white wine from Goriska Brda, iconic Movia label, professional wine photography, dark elegant background' },
  { path: '/menu-images/bela-vina/rebula-cru.png', prompt: 'Bottle of Rebula Cru Selection 2021 premium Slovenian white wine from Marjan Simcic, sophisticated cru label, professional wine photography, dark background' },
  { path: '/menu-images/bela-vina/renski-rizling-keltis.png', prompt: 'Bottle of Renski Rizling Keltis 2021 Slovenian organic white wine, natural eco-style wine label, professional product photography, dark background, cool lighting' },
  { path: '/menu-images/bela-vina/renski-rizling-stare.png', prompt: 'Bottle of Renski Rizling Stare Trte 2015 aged Slovenian white wine from Dveri-Pax, vintage-style label, professional photography, dark background' },
  { path: '/menu-images/bela-vina/rumeni-muskat-pozna.png', prompt: 'Bottle of Rumeni Muskat Pozna Trgatev 2019 late harvest sweet Slovenian white wine, golden dessert wine, elegant label, professional photography, dark background' },
  { path: '/menu-images/bela-vina/rumeni-muskat.png', prompt: 'Bottle of Rumeni Muskat 2023 Slovenian semi-sweet white wine from Dular winery, aromatic muscat, distinctive label, professional wine photography, dark background' },
  { path: '/menu-images/bela-vina/sauvignon-blanc-cru.png', prompt: 'Bottle of Sauvignon Blanc Cru Veliki Vrh 2023 premium Slovenian white wine from Familija Brodnjak, elegant cru label, professional wine photography, dark background' },
  { path: '/menu-images/bela-vina/sipon-verus.png', prompt: 'Bottle of Sipon Verus 2022 unique Slovenian white wine from Styria, modern Verus label, professional product photography, cool elegant lighting, dark background' },
  { path: '/menu-images/bela-vina/sivi-pinot-jamertal.png', prompt: 'Bottle of Sivi Pinot Jamertal 2021 Slovenian Pinot Gris from Valdhuber, refined wine label, professional studio photography, dark background' },
  { path: '/menu-images/bela-vina/traminec.png', prompt: 'Bottle of Traminec 2023 Slovenian Gewurztraminer from Keltis boutique winery, aromatic floral wine, elegant label, professional product photography, dark background' },
  { path: '/menu-images/bela-vina/rebula.png', prompt: 'Bottle of Rebula 2022 Slovenian white wine from Borut Blazic in Goriska Brda, rustic modern label, professional wine photography, dark background' },
  { path: '/menu-images/brezalk-pivo/daura.png', prompt: 'Bottle of Daura Lager non-alcoholic beer by Estrella Damm, gluten-free, 0.33L golden bottle, professional beer product photography, dark background with condensation' },
  { path: '/menu-images/brezalk-pivo/heineken-00.png', prompt: 'Bottle of Heineken 0.0 non-alcoholic beer, iconic green glass bottle with red zero label, professional beer product photography, dark background, refreshing' },
  { path: '/menu-images/craft-piva/bevog-tak.png', prompt: 'Bottle of Bevog Tak Pale Ale craft beer from Slovenia, 0.33L with colorful artistic label, professional beer photography, dark moody background' },
  { path: '/menu-images/craft-piva/pelicon-winter.png', prompt: 'Bottle of Pelicon Winter dark craft beer from Slovenia, 0.75L large format, seasonal craft beer label with winter motifs, professional photography, dark background' },
  { path: '/menu-images/craft-piva/zeleni-haler.png', prompt: 'Bottle of Zeleni Haler Lager with Hemp craft beer from Haler brewery Slovenia, green-tinted craft label, professional beer photography, dark background' },
  { path: '/menu-images/destilati/ararat-6.png', prompt: 'Bottle of Ararat 6yo Armenian brandy, elegant dark glass bottle with gold label, professional spirits product photography, dark luxurious background, warm amber glow' },
  { path: '/menu-images/destilati/ararat-15.png', prompt: 'Bottle of Ararat 15yo premium Armenian brandy, ornate dark glass bottle with elaborate gold label, luxury spirits photography, dark background, warm amber light' },
  { path: '/menu-images/destilati/ararat-20.png', prompt: 'Bottle of Ararat 20yo ultra-premium Armenian brandy, luxurious decanter-style bottle with gold details, top-tier spirits photography, dark opulent background' },
  { path: '/menu-images/destilati/brinjevec.png', prompt: 'Bottle of Brinjevec Slovenian juniper brandy, traditional clear spirit in transparent bottle, rustic Slovenian label, professional spirits photography, dark background' },
  { path: '/menu-images/destilati/delamaine-xo.png', prompt: 'Bottle of Delamaine X.O. Cognac, premium French cognac in elegant crystal decanter, rich amber color, luxury spirits photography, dark sophisticated background' },
  { path: '/menu-images/destilati/grappa-sofija.png', prompt: 'Bottle of Grappa Sofija Rebula premium Slovenian grappa from Jakoncic winery, elegant clear spirit bottle, professional spirits photography, dark background' },
  { path: '/menu-images/destilati/hennessy-vs.png', prompt: 'Bottle of Hennessy V.S. Cognac, iconic French cognac with recognizable label, professional spirits product photography, dark background, warm amber lighting' },
  { path: '/menu-images/destilati/hennessy-xo.png', prompt: 'Bottle of Hennessy X.O. Cognac, ultra-premium French cognac in distinctive decanter, luxury spirits photography, dark opulent background, warm amber glow' },
  { path: '/menu-images/destilati/rum-bumbu.png', prompt: 'Bottle of Bumbu Original Rum from Barbados, distinctive round bottle with colorful Caribbean label, professional rum product photography, dark background' },
  { path: '/menu-images/destilati/rum-diplomatico.png', prompt: 'Bottle of Diplomatico Reserva Exclusiva Rum from Venezuela, elegant dark bottle with distinctive label, professional rum photography, dark background' },
  { path: '/menu-images/destilati/rum-hechicera.png', prompt: 'Bottle of La Hechicera Reserva Familiar 21yo Rum from Colombia, elegant tall bottle with minimalist premium label, professional rum photography, dark background' },
  { path: '/menu-images/destilati/rum-zacapa.png', prompt: 'Bottle of Zacapa Solera 23yo Rum from Guatemala, distinctive round bottle with woven palm band, premium rum photography, dark luxurious background' },
  { path: '/menu-images/destilati/slivovka.png', prompt: 'Bottle of Slivovka Slovenian plum brandy, traditional clear spirit in elegant bottle, rustic label with plum motifs, professional spirits photography, dark background' },
  { path: '/menu-images/destilati/travarica-rossi.png', prompt: 'Bottle of Travarica Rossi Istrian herb brandy, traditional herbal spirit in clear bottle, professional spirits photography, dark background' },
  { path: '/menu-images/destilati/viljamovka.png', prompt: 'Bottle of Viljamovka Slovenian Williams pear brandy, elegant clear spirit bottle with whole pear inside, professional spirits photography, dark background' },
  { path: '/menu-images/gazirane-pijace/coca-cola-zero.png', prompt: 'Can of Coca-Cola Zero, black can with red Coca-Cola logo, professional soda product photography, dark background with condensation, refreshing look' },
  { path: '/menu-images/gazirane-pijace/cockta.png', prompt: 'Bottle of Cockta, iconic Slovenian herbal soda drink, retro-style brown glass bottle with distinctive label, professional beverage photography, dark background' },
  { path: '/menu-images/gazirane-pijace/fanta.png', prompt: 'Can of Fanta orange soda, bright orange can with Fanta logo, professional soda product photography, dark background with condensation' },
  { path: '/menu-images/gazirane-pijace/fever-tree-med.png', prompt: 'Bottle of Fever Tree Mediterranean Tonic Water, premium slim glass bottle with elegant label, professional mixer product photography, dark background' },
  { path: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', prompt: 'Bottle of Fever Tree Rhubarb and Raspberry Tonic Water, premium slim glass bottle with pink-toned label, professional mixer photography, dark background' },
  { path: '/menu-images/gazirane-pijace/fever-tree-tonic.png', prompt: 'Bottle of Fever Tree Premium Indian Tonic Water, iconic slim glass bottle with classic label, professional mixer product photography, dark background' },
  { path: '/menu-images/gazirane-pijace/red-bull.png', prompt: 'Can of Red Bull Energy Drink, iconic blue and silver can with red bull logo, professional product photography, dark background, dynamic lighting' },
  { path: '/menu-images/gazirane-pijace/schweppes-bitter.png', prompt: 'Bottle of Schweppes Bitter Lemon, classic mixer drink in glass bottle with yellow label, professional beverage photography, dark background' },
  { path: '/menu-images/gazirane-pijace/schweppes-tonic.png', prompt: 'Bottle of Schweppes Tonic Water, classic glass bottle with green label, professional mixer product photography, dark background with condensation' },
  { path: '/menu-images/gazirane-pijace/sprite.png', prompt: 'Can of Sprite lemon-lime soda, green can with Sprite logo, professional soda product photography, dark background with condensation' },
  { path: '/menu-images/gin/gin-hendricks.png', prompt: 'Bottle of Hendricks Gin, iconic dark apothecary-style bottle with cork stopper and black label, Scottish gin, professional spirits photography, dark moody background' },
  { path: '/menu-images/gin/gin-kristal.png', prompt: 'Bottle of Gin Kristal London Dry, Slovenian gin in crystal-clear bottle with elegant London dry label, professional spirits product photography, dark background' },
  { path: '/menu-images/gin/gin-mare.png', prompt: 'Bottle of Gin Mare Mediterranean Gin, distinctive light blue glass bottle with Mediterranean herbs motif, Spanish gin, professional spirits photography, dark background' },
  { path: '/menu-images/gin/gin-monkey47.png', prompt: 'Bottle of Monkey 47 Schwarzwald Dry Gin, distinctive dark apothecary bottle with monkey illustration label, German craft gin, professional spirits photography, dark background' },
  { path: '/menu-images/gin/gin-monolog.png', prompt: 'Bottle of Gin Monolog, Slovenian craft gin in elegant bottle with minimalist modern label, professional spirits product photography, dark background' },
  { path: '/menu-images/gin/gin-tanqueray.png', prompt: 'Bottle of Tanqueray London Dry Gin, iconic green glass bottle with red seal and classical label, professional spirits photography, dark background' },
  { path: '/menu-images/grencice/amaro.png', prompt: 'Bottle of Amaro herbal bitter liqueur, Italian-style dark herbal liqueur in rustic brown bottle, professional spirits photography, dark background' },
  { path: '/menu-images/grencice/aperol.png', prompt: 'Bottle of Aperol, iconic bright orange Italian aperitif in tall slim glass bottle, professional spirits product photography, dark background' },
  { path: '/menu-images/grencice/campari.png', prompt: 'Bottle of Campari Bitter, iconic red Italian bitter liqueur in distinctive round bottle, professional spirits photography, dark background' },
  { path: '/menu-images/grencice/cynar.png', prompt: 'Bottle of Cynar, Italian artichoke-based bitter aperitif, distinctive label with artichoke, professional spirits photography, dark background' },
  { path: '/menu-images/grencice/jagermeister.png', prompt: 'Bottle of Jagermeister, iconic dark green glass bottle with stag head logo, German herbal liqueur, professional spirits photography, dark moody background' },
  { path: '/menu-images/likerji/borovnica-kejzar.png', prompt: 'Bottle of Liker Borovnica Kejzar, Slovenian blueberry liqueur, deep purple-blue spirit in elegant bottle, professional spirits photography, dark background' },
  { path: '/menu-images/likerji/bumbu-cream.png', prompt: 'Bottle of Bumbu Cream Rum Liqueur, Caribbean rum cream liqueur in distinctive round bottle, professional cream liqueur photography, dark background' },
  { path: '/menu-images/likerji/canella.png', prompt: 'Bottle of Canella Liqueur, Italian prosecco-based cream liqueur in elegant bottle, professional liqueur product photography, dark background' },
  { path: '/menu-images/likerji/carolans.png', prompt: 'Bottle of Carolans Irish Cream Liqueur, Irish whiskey cream liqueur in dark glass bottle with gold label, professional cream liqueur photography, dark background' },
  { path: '/menu-images/likerji/malibu.png', prompt: 'Bottle of Malibu Rum Liqueur, iconic white bottle with palm tree sunset label, Caribbean coconut rum, professional spirits photography, dark background' },
  { path: '/menu-images/likerji/medica-kejzar.png', prompt: 'Bottle of Liker Medica Kejzar, Slovenian honey liqueur, golden amber spirit with honeycomb label, professional spirits photography, dark background' },
  { path: '/menu-images/likersko-vino/keros-belo.png', prompt: 'Bottle of Keros Belo 2020 Slovenian sweet dessert white wine from Vinarstvo Kerin, elegant small format bottle, professional wine photography, dark background' },
  { path: '/menu-images/likersko-vino/keros-rdece.png', prompt: 'Bottle of Keros Rdece 2018 Slovenian sweet dessert red wine from Vinarstvo Kerin, elegant small format bottle with deep red color, professional wine photography, dark background' },
  { path: '/menu-images/likersko-vino/sladki-refosk.png', prompt: 'Bottle of Sladki Refosk Slovenian sweet red dessert wine from Vina Koper, deep ruby dessert wine bottle, professional wine photography, dark background' },
  { path: '/menu-images/likersko-vino/veliko-rdece-2012.png', prompt: 'Large 3L bottle of Veliko Rdece Movia 2012 premium Slovenian red wine, impressive large format, luxury wine photography, dark opulent background' },
  { path: '/menu-images/mesane-pijace/cuba-libre.png', prompt: 'Cuba Libre cocktail in tall glass, dark rum with Coca-Cola and lime wedge, ice cubes, professional cocktail photography, dark moody background' },
  { path: '/menu-images/mesane-pijace/gin-mare-tonic.png', prompt: 'Gin Mare and Tonic cocktail in copa glass, Mediterranean gin with tonic water, rosemary sprig and lime, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', prompt: 'Hendricks Gin and Tonic in balloon glass, cucumber slice garnish, professional cocktail photography, dark moody background, cool elegant lighting' },
  { path: '/menu-images/mesane-pijace/mango-mojito.png', prompt: 'Mango Mojito cocktail in tall glass, fresh mango with mint leaves and lime, rum cocktail with ice, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/martini-spritz.png', prompt: 'Martini Spritz cocktail in wine glass, Martini bianco with prosecco and soda, lime garnish, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', prompt: 'Monkey 47 Gin Tonic in copa glass, juniper berries and rosemary garnish, professional craft cocktail photography, dark moody background' },
  { path: '/menu-images/mesane-pijace/monolog-gin-tonic.png', prompt: 'Monolog Gin Tonic in elegant glass, Slovenian craft gin with tonic water, juniper berries and lime, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', prompt: 'Orange and Ginger Gin Tonic in glass, orange slice and ginger garnish, warm amber cocktail, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', prompt: 'Raspberry Pink Gin Tonic in glass, pink-hued cocktail with fresh raspberries and mint, professional cocktail photography, dark background' },
  { path: '/menu-images/mesane-pijace/strawberry-mojito.png', prompt: 'Strawberry Mojito cocktail in tall glass, fresh strawberries with mint leaves and lime, rum cocktail with crushed ice, professional cocktail photography, dark background' },
  { path: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', prompt: 'Glass of homemade iced tea, amber-colored cold tea with ice cubes and lemon slice, professional beverage photography, dark background, refreshing' },
  { path: '/menu-images/naravni-sokovi/hisni-sok-meta.png', prompt: 'Glass of homemade mint juice, green fresh mint drink with ice cubes and mint leaves, professional beverage photography, dark background' },
  { path: '/menu-images/naravni-sokovi/limonada-okus.png', prompt: 'Glass of flavored lemonade with elderberry and ginger, pink-hued artisan lemonade with ice, professional beverage photography, dark background' },
  { path: '/menu-images/naravni-sokovi/pomarancni-sok.png', prompt: 'Glass of freshly squeezed orange juice, vibrant orange color with pulp, professional juice photography, dark background, warm citrus lighting' },
  { path: '/menu-images/penine/bjana-brut.png', prompt: 'Bottle of Bjana Brut sparkling wine from Goriska Brda Slovenia, elegant tall bottle with white label, professional wine photography, dark background' },
  { path: '/menu-images/penine/boemme-rumeni-muskat.png', prompt: 'Bottle of Penina Boemme Rumeni Muskat Slovenian semi-dry sparkling wine, golden-hued bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/gourmet-rose.png', prompt: 'Bottle of Penina Gourmet Rose sparkling wine from Istenic Slovenia, elegant pink bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/louis-roederer.png', prompt: 'Bottle of Champagne Louis Roederer Collection 244 Brut, premium French champagne, luxury champagne photography, dark opulent background' },
  { path: '/menu-images/penine/maria-brut.png', prompt: 'Bottle of Maria Brut 2020 Slovenian sparkling wine from Vinarstvo Kerin, elegant minimalist label, professional wine photography, dark background' },
  { path: '/menu-images/penine/mufi-pet-nat.png', prompt: 'Bottle of Mufi Pet Nat Brut Nature 2023 Slovenian natural sparkling wine from Keltis, funky craft wine bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/no1-brut.png', prompt: 'Bottle of No.1 Brut sparkling wine from Istenic winery Slovenia, elegant tall green bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/pol-roger.png', prompt: 'Bottle of Champagne Pol Roger Brut Reserve, premium French champagne with white and gold label, luxury champagne photography, dark sophisticated background' },
  { path: '/menu-images/penine/slapsak-brut-reserve.png', prompt: 'Bottle of Domaine Slapsak Brut Reserve Slovenian sparkling wine from Dolenjska, elegant bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/slapsak-brut-rose.png', prompt: 'Bottle of Domaine Slapsak Brut Rose Slovenian rose sparkling wine, pink-hued bottle, professional wine photography, dark background' },
  { path: '/menu-images/penine/zlata-radgonska.png', prompt: 'Bottle of Zlata Radgonska Penina Brut Selection classic Slovenian sparkling wine, traditional tall bottle with gold label, professional wine photography, dark background' },
  { path: '/menu-images/pivo/reset-froggy.png', prompt: 'Bottle of Reset Froggy IPA craft beer from Brezice Slovenia, 0.50L bottle with colorful frog-themed label, professional beer photography, dark background' },
  { path: '/menu-images/pivo/reset-lagerish.png', prompt: 'Bottle of Reset Lagerish Cream Ale craft beer from Brezice Slovenia, 0.50L bottle with artistic craft beer label, professional beer photography, dark background' },
  { path: '/menu-images/pivo/reset-stout.png', prompt: 'Bottle of Reset Irish Extra Stout craft beer from Brezice Slovenia, dark stout beer, 0.50L bottle with dark moody label, professional beer photography, dark background' },
  { path: '/menu-images/rdeca-vina/cabernet-keltis.png', prompt: 'Bottle of Cabernet Sauvignon Keltis 2018 Slovenian organic red wine from Bizeljsko, dark green bottle with eco label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/cabernet-pavo.png', prompt: 'Bottle of Cabernet Sauvignon Pavo Limited Edition 2021 premium Slovenian red wine from Kristancic, exclusive label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/carolina-rdeca.png', prompt: 'Bottle of Carolina Rdeca 2018 premium Slovenian red wine blend from Jakoncic in Goriska Brda, elegant label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/duet-edi-simcic.png', prompt: 'Bottle of Duet Edi Simcic 2021 premium Slovenian red wine blend from Goriska Brda, sophisticated label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/duet-lex-2018.png', prompt: 'Large 1.5L magnum bottle of Duet Lex Edi Simcic 2018 premium Slovenian red wine, luxury wine photography, dark opulent background' },
  { path: '/menu-images/rdeca-vina/duet-lex-2020.png', prompt: 'Bottle of Duet Lex Edi Simcic 2020 premium Slovenian red wine from Goriska Brda, elegant lex label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/guerila-retro.png', prompt: 'Bottle of Guerila Retro Selection 2020 Slovenian red wine from Vipava valley, retro-style artistic label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/merlot-keltis.png', prompt: 'Bottle of Merlot Keltis 2018 Slovenian organic red wine from Bizeljsko, natural eco-style wine label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/merlot-opoka.png', prompt: 'Bottle of Merlot Opoka 2019 premium Slovenian red wine from Marjan Simcic in Goriska Brda, opoka terroir label, luxury wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-dular.png', prompt: 'Bottle of Modra Frankinja Dular 2023 Slovenian organic red wine from Bizeljsko, eco-style label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/modra-frankinja-luna.png', prompt: 'Bottle of Modra Frankinja Luna 2021 premium Slovenian red wine from Kobal, moon-themed elegant label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/modri-pinot-opoka.png', prompt: 'Bottle of Modri Pinot Opoka 2020 ultra-premium Slovenian Pinot Noir from Simcic in Goriska Brda, luxury wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/modri-pinot-verus.png', prompt: 'Bottle of Modri Pinot Verus 2019 Slovenian Pinot Noir from Verus winery in Ormoz, sleek modern label, professional wine photography, dark background' },
  { path: '/menu-images/rdeca-vina/veliko-rdece-movia.png', prompt: 'Bottle of Veliko Rdece Movia 2015 legendary Slovenian red wine from Movia winery in Goriska Brda, iconic minimalist label, professional wine photography, dark background' },
  { path: '/menu-images/rose-vino/rose-batic.png', prompt: 'Bottle of Rose Batic 2024 Slovenian rose wine from Vipavska dolina, elegant pink-tinged bottle with organic Batic label, professional wine photography, dark background' },
  { path: '/menu-images/rose-vino/rose-verstovsek.png', prompt: 'Bottle of Rose Verstovsek Estate 2024 Slovenian rose wine from Bizeljsko, modern minimalist label, professional wine photography, dark background' },
  { path: '/menu-images/sokovi/ananasov-sok.png', prompt: 'Glass of pineapple juice, vibrant yellow tropical juice with ice, professional beverage photography, dark background, warm tropical lighting' },
  { path: '/menu-images/sokovi/bubble-tea.png', prompt: 'Glass of bubble tea with tapioca pearls, trendy boba tea drink, professional beverage photography, dark background, colorful modern lighting' },
  { path: '/menu-images/sokovi/cedevita.png', prompt: 'Glass of Cedevita vitamin drink, iconic Slovenian orange vitamin beverage, professional drink photography, dark background' },
  { path: '/menu-images/sokovi/jabolcni-sok.png', prompt: 'Glass of 100% natural apple juice, golden clear juice in glass, professional beverage photography, dark background' },
  { path: '/menu-images/sokovi/jagodni-sok.png', prompt: 'Glass of strawberry juice, vibrant red berry juice with fresh strawberries, professional beverage photography, dark background' },
  { path: '/menu-images/sokovi/ledeni-caj.png', prompt: 'Glass of iced tea, amber-colored cold tea with ice and lemon, professional beverage photography, dark background, refreshing' },
  { path: '/menu-images/sokovi/marelicni-sok.png', prompt: 'Glass of apricot juice, warm orange-golden juice in glass, professional beverage photography, dark background' },
  { path: '/menu-images/sokovi/pomarancni-sok.png', prompt: 'Carton of packaged orange juice drink, professional beverage photography, dark background, bright citrus lighting' },
  { path: '/menu-images/sokovi/ribezov-sok.png', prompt: 'Glass of currant juice, deep red-black berry juice with currants, professional beverage photography, dark background' },
  { path: '/menu-images/toceno-pivo/haler-nefiltriran.png', prompt: 'Glass of Haler Lager Nefiltriran draft beer, unfiltered golden lager with hazy appearance and white foam head, professional beer photography, dark background' },
  { path: '/menu-images/toceno-pivo/pelicon-ipa.png', prompt: 'Glass of Pelicon 3rd Pill IPA draft beer, craft IPA with amber color and thick foam head, professional beer photography, dark background' },
  { path: '/menu-images/toceno-pivo/radler.png', prompt: 'Glass of Radler Grenivka draft beer, grapefruit radler with light golden color and citrus garnish, professional beer photography, dark background' },
  { path: '/menu-images/toceno-pivo/union-lager.png', prompt: 'Glass of Union Lager draft beer, classic Slovenian pale lager with golden color and white foam, professional beer photography, dark background' },
  { path: '/menu-images/topli-napitki/babyccino.png', prompt: 'Babyccino in small cup, frothy warm milk with chocolate sprinkle in little cup, professional coffee photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', prompt: 'Decaffeinated white coffee in ceramic cup, lots of steamed milk with decaf coffee, professional coffee photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/bela-kava.png', prompt: 'White coffee in ceramic cup, milky coffee with lots of steamed milk, professional coffee photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/caj-limona-med.png', prompt: 'Cup of hot tea with lemon and honey, warm herbal tea with lemon slice, professional tea photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', prompt: 'Decaffeinated cappuccino in ceramic cup, decaf coffee with thick milk foam and latte art, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/kakav-smetana.png', prompt: 'Hot cocoa with whipped cream in ceramic mug, rich hot chocolate topped with cream and cocoa dust, professional drink photography, dark background' },
  { path: '/menu-images/topli-napitki/kakav.png', prompt: 'Hot cocoa in ceramic mug, rich hot chocolate drink, professional drink photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/kava-brez-kofeina.png', prompt: 'Decaffeinated espresso in small ceramic cup, decaf coffee shot, professional coffee photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/kava-macchiato.png', prompt: 'Espresso macchiato in small ceramic cup, espresso with a drop of steamed milk, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', prompt: 'Decaf coffee with milk in ceramic cup, decaffeinated coffee with steamed milk, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/kava-rizevo-mleko.png', prompt: 'Coffee with rice milk in ceramic cup, lactose-free coffee with plant-based milk, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/kava-s-smetano.png', prompt: 'Coffee with cream in ceramic cup, espresso topped with whipped cream, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/kava-z-mlekom.png', prompt: 'Coffee with milk in ceramic cup, classic coffee with steamed milk, professional coffee photography, dark background, warm cozy lighting' },
  { path: '/menu-images/topli-napitki/ledena-kava-olimia.png', prompt: 'Iced coffee Olimia in tall glass, layered iced coffee with ice cream and whipped cream, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', prompt: 'Decaf macchiato in small ceramic cup, decaffeinated espresso with milk spot, professional coffee photography, dark background' },
  { path: '/menu-images/topli-napitki/vroca-cokolada.png', prompt: 'Hot chocolate in ceramic mug, thick rich hot chocolate with whipped cream and chocolate shavings, professional drink photography, dark background' },
  { path: '/menu-images/tuja-vina/andreis-vinasmora.png', prompt: 'Bottle of Andreis Vinasmora 2020 Croatian red wine from Primosten, rustic Mediterranean wine bottle, professional wine photography, dark background' },
  { path: '/menu-images/tuja-vina/jermann-dreams.png', prompt: 'Bottle of Chardonnay Where Dreams Have No End 2021 iconic Italian white wine from Jermann, dreamy artistic label, luxury wine photography, dark background' },
  { path: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', prompt: 'Bottle of Plavac Mali Premium Terra Madre 2017 Croatian red wine from Dalmatia, Mediterranean wine bottle, professional wine photography, dark background' },
  { path: '/menu-images/tuja-vina/posip-terra-madre.png', prompt: 'Bottle of Posip Premium Terra Madre 2021 Croatian white wine from Dalmatia, elegant Mediterranean wine bottle, professional wine photography, dark background' },
  { path: '/menu-images/tuja-vina/vintage-tunina.png', prompt: 'Bottle of Vintage Tunina 2022 premium Italian white wine from Jermann, elegant artistic label, luxury wine photography, dark background' },
  { path: '/menu-images/tuja-vina/vranec-instinct.png', prompt: 'Bottle of Vranec Instinct 2019 Macedonian red wine from Puklavec Family, bold dark wine bottle with modern label, professional wine photography, dark background' },
  { path: '/menu-images/viski/chivas-12.png', prompt: 'Bottle of Chivas Regal 12yo blended Scotch whisky, distinctive gold bottle with premium label, professional spirits photography, dark background, warm amber lighting' },
  { path: '/menu-images/viski/glenmorangie-18.png', prompt: 'Bottle of Glenmorangie 18yo single malt Scotch whisky, elegant tall bottle with premium label, luxury whisky photography, dark background, warm golden lighting' },
  { path: '/menu-images/viski/glenmorangie-lasanta.png', prompt: 'Bottle of Glenmorangie Lasanta 12yo sherry cask finish, elegant tall bottle, professional whisky photography, dark background, warm amber lighting' },
  { path: '/menu-images/viski/jameson.png', prompt: 'Bottle of Jameson Irish Whiskey, iconic Irish whiskey bottle with green label, professional spirits photography, dark background, warm lighting' },
  { path: '/menu-images/viski/johnnie-walker-black.png', prompt: 'Bottle of Johnnie Walker Black Label 12yo blended Scotch whisky, iconic square bottle with slanted label, professional spirits photography, dark background' },
  { path: '/menu-images/viski/lagavulin-16.png', prompt: 'Bottle of Lagavulin 16yo Islay single malt Scotch whisky, classic rounded bottle with white label, peaty Islay whisky, professional spirits photography, dark background' },
  { path: '/menu-images/viski/laphroaig-10.png', prompt: 'Bottle of Laphroaig 10yo Islay single malt Scotch whisky, distinctive green bottle with bold label, smoky Islay whisky, professional spirits photography, dark background' },
  { path: '/menu-images/viski/nikka-barrel.png', prompt: 'Bottle of Nikka From the Barrel Japanese blended whisky, distinctive short sturdy bottle, professional spirits photography, dark background, warm amber lighting' },
  { path: '/menu-images/viski/nikka-miyagikyo.png', prompt: 'Bottle of Nikka Miyagikyo Japanese single malt whisky, elegant bottle with Japanese calligraphy, luxury whisky photography, dark background, warm golden lighting' },
  { path: '/menu-images/vode/mineralna-voda.png', prompt: 'Bottle of sparkling mineral water, glass bottle with carbonated water and bubbles, professional beverage photography, dark background, clean cool lighting' },
  { path: '/menu-images/vode/naravna-voda.png', prompt: 'Bottle of natural still water, clear glass bottle with pure water, professional beverage photography, dark background, clean clear lighting' },
  { path: '/menu-images/vode/radenska-functionall.png', prompt: 'Bottle of Radenska FunctionALL functional water, modern Slovenian functional water bottle, professional beverage photography, dark background, clean modern lighting' },
  { path: '/menu-images/vode/voda-z-okusom.png', prompt: 'Bottle of flavored water with fruit essence, water bottle with subtle fruit infusion, professional beverage photography, dark background, refreshing lighting' },
];

const DELAY_MS = 5000;
const MAX_RETRIES = 5;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateImage(zai, item, retryCount = 0) {
  try {
    const response = await zai.images.generations.create({
      prompt: item.prompt,
      size: '864x1152'
    });
    const base64 = response.data[0].base64;
    const buffer = Buffer.from(base64, 'base64');
    const fullPath = join(process.cwd(), 'public', item.path);
    const { writeFileSync } = await import('fs');
    writeFileSync(fullPath, buffer);
    return { success: true, size: buffer.length };
  } catch (err) {
    const msg = err.message || '';
    if ((msg.includes('429') || msg.includes('Too many') || msg.includes('rate')) && retryCount < MAX_RETRIES) {
      const waitSec = Math.min(60 * Math.pow(2, retryCount), 300); // exponential: 60s, 120s, 240s, 300s max
      console.log(`\n    ⏳ Rate limited, waiting ${waitSec}s (retry ${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(waitSec * 1000);
      return generateImage(zai, item, retryCount + 1);
    }
    return { success: false, error: msg.slice(0, 120) };
  }
}

async function main() {
  console.log(`\n🎨 Upgrading ${ITEMS.length} menu images to AI-generated photos...`);
  console.log(`   Batch: ${BATCH_SIZE} images | Start: ${START_IDX}`);
  console.log(`   Skipping images already > ${MIN_AI_SIZE/1000}KB (already AI-generated)\n`);

  const zai = await ZAI.create();
  let upgraded = 0, skipped = 0, failed = 0, processed = 0;

  for (let i = START_IDX; i < ITEMS.length && processed < BATCH_SIZE; i++) {
    const item = ITEMS[i];
    const fullPath = join(process.cwd(), 'public', item.path);

    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.size > MIN_AI_SIZE) {
        skipped++;
        continue;
      }
    }

    const label = item.path.split('/').pop().replace('.png', '');
    process.stdout.write(`  [${i+1}/${ITEMS.length}] ${label}... `);

    const result = await generateImage(zai, item);

    if (result.success) {
      console.log(`✅ (${(result.size/1024).toFixed(0)}KB)`);
      upgraded++;
    } else {
      console.log(`❌ ${result.error}`);
      failed++;
    }
    processed++;

    if (processed < BATCH_SIZE) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n📊 Batch complete! Upgraded: ${upgraded}, Skipped: ${skipped}, Failed: ${failed}, Processed: ${processed}`);
  
  // Find next non-AI item for next batch
  let nextStart = START_IDX;
  let foundNext = false;
  for (let i = START_IDX; i < ITEMS.length; i++) {
    const fullPath = join(process.cwd(), 'public', ITEMS[i].path);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.size <= MIN_AI_SIZE) {
        if (!foundNext) { nextStart = i; foundNext = true; }
      }
    } else {
      if (!foundNext) { nextStart = i; foundNext = true; }
    }
  }

  const remaining = ITEMS.slice(nextStart).filter(item => {
    const fp = join(process.cwd(), 'public', item.path);
    if (existsSync(fp)) return statSync(fp).size <= MIN_AI_SIZE;
    return true;
  }).length;

  if (remaining > 0) {
    console.log(`\n🔄 Run next batch: node scripts/upgrade-images-ai.mjs --batch ${BATCH_SIZE} --start ${nextStart}`);
    console.log(`   Remaining items to upgrade: ${remaining}`);
  } else {
    console.log('\n🎉 All items processed! All images are AI-generated!');
  }
}

main().catch(console.error);
