#!/bin/bash
# Generate unique, professional AI images for all menu items that share duplicate images
# Usage: bash scripts/generate-unique-images.sh

set -e
BASE="/home/z/my-project/public/menu-images"
SIZE="1024x1024"
DELAY=2  # seconds between requests to avoid rate limiting

echo "=== RestaurantOS Menu Image Generator ==="
echo "Generating unique professional images for all duplicate menu items..."
echo ""

generate() {
  local filepath="$1"
  local prompt="$2"
  local fullpath="${BASE}/${filepath}"
  
  # Skip if file doesn't exist (we'll create it)
  local dir=$(dirname "$fullpath")
  mkdir -p "$dir"
  
  echo -n "Generating: $filepath ... "
  if z-ai-generate -p "$prompt" -o "$fullpath" -s "$SIZE" 2>/dev/null; then
    echo "OK"
  else
    echo "FAILED (retrying once...)"
    sleep 5
    if z-ai-generate -p "$prompt" -o "$fullpath" -s "$SIZE" 2>/dev/null; then
      echo "OK (retry)"
    else
      echo "FAILED PERMANENTLY"
    fi
  fi
  sleep $DELAY
}

# ============================================================
# BELA VINA (White Wines) - 20 duplicates
# ============================================================
echo "--- Generating Bela Vina (White Wines) ---"
generate "bela-vina/cuvee-emino.png" "Professional food photography of a glass of white wine Cuvee Emino, elegant wine glass with golden white wine, Slovenian wine label visible, dark moody restaurant background, soft warm lighting, shallow depth of field, 4k quality"
generate "bela-vina/chardonnay-verus.png" "Professional food photography of a glass of Chardonnay Verus white wine, pale golden color in crystal wine glass, green bottle beside, Slovenian vineyard aesthetic, dark restaurant table, ambient lighting, premium feel"
generate "bela-vina/sauvignon-blanc-cru.png" "Professional food photography of Sauvignon Blanc Cru white wine in elegant glass, pale straw yellow color, fresh aromatic look, bottle with cork visible, restaurant setting, warm soft light"
generate "bela-vina/laski-rizling.png" "Professional food photography of Laski Rizling white wine, golden yellow wine in crystal glass, Slovenian wine tradition, rustic elegant setting, soft warm lighting"
generate "bela-vina/traminec.png" "Professional food photography of Traminec white wine, distinctive amber-gold color in crystal wine glass, aromatic wine, floral notes, elegant restaurant table, moody lighting"
generate "bela-vina/rebula.png" "Professional food photography of Rebula white wine, bright golden yellow in elegant wine glass, Brda region Slovenian wine, dark table, warm ambient light, premium feel"
generate "bela-vina/chardonnay-dular.png" "Professional food photography of Chardonnay Dular white wine, rich golden color in crystal glass, premium Slovenian chardonnay, barrel-aged look, elegant dark background"
generate "bela-vina/chardonnay-vicomte.png" "Professional food photography of Chardonnay Vicomte white wine, pale gold wine in elegant crystal glass, French-style Slovenian wine, sophisticated dark background, soft lighting"
generate "bela-vina/sipon-verus.png" "Professional food photography of Sipon Verus white wine, light golden wine in crystal glass, unique Slovenian grape variety, fresh vibrant look, dark restaurant table, warm light"
generate "bela-vina/sivi-pinot-jamertal.png" "Professional food photography of Sivi Pinot Jamertal white wine, Pinot Gris golden copper tint in crystal glass, elegant Slovenian wine, dark background, soft warm lighting"
generate "bela-vina/renski-rizling-stare.png" "Professional food photography of Renski Rizling Stare white wine, bright pale gold in crystal glass, Riesling wine, Slovenian premium, elegant dark table, ambient lighting"
generate "bela-vina/renski-rizling-keltis.png" "Professional food photography of Renski Rizling Keltis white wine, golden yellow Riesling in crystal glass, premium Slovenian wine, dark moody background, warm lighting"
generate "bela-vina/alter.png" "Professional food photography of Alter white wine blend, pale golden in modern crystal glass, innovative Slovenian wine, contemporary dark background, soft lighting"
generate "bela-vina/malvazija-movia.png" "Professional food photography of Malvazija Movia white wine, amber golden in elegant glass, natural wine aesthetic, Movia winery prestige, dark table, warm ambient light"
generate "bela-vina/rebula-cru.png" "Professional food photography of Rebula Cru white wine, deep golden in crystal glass, premium Brda region wine, sophisticated dark background, warm lighting"
generate "bela-vina/burja-bela.png" "Professional food photography of Burja Bela white wine, bright pale gold in modern glass, natural biodynamic Slovenian wine, minimalist dark background, soft lighting"
generate "bela-vina/angel-belo-2021.png" "Professional food photography of Angel Belo 2021 white wine, light golden in crystal glass, elegant modern Slovenian wine, dark background, warm soft light"
generate "bela-vina/angel-belo-2019.png" "Professional food photography of Angel Belo 2019 white wine, deeper golden aged tone in crystal glass, mature vintage Slovenian wine, dark table, warm ambient lighting"
generate "bela-vina/rumeni-muskat.png" "Professional food photography of Rumeni Muskat white wine, bright golden aromatic wine in crystal glass, Muscat grape variety, floral elegant, dark background, soft light"
generate "bela-vina/rumeni-muskat-pozna.png" "Professional food photography of Rumeni Muskat Pozna white wine, deep amber golden late harvest in crystal glass, dessert wine style, rich and aromatic, dark background, warm light"
generate "bela-vina/bela-frankinja.png" "Professional food photography of Bela Frankinja white wine, pale golden Blaufrankisch white in crystal glass, unique Slovenian variety, elegant dark table, warm lighting"

# ============================================================
# RDECA VINA (Red Wines) - 14 duplicates
# ============================================================
echo "--- Generating Rdeca Vina (Red Wines) ---"
generate "rdeca-vina/modra-frankinja-dular.png" "Professional food photography of Modra Frankinja Dular red wine, deep ruby red in crystal wine glass, Slovenian Blaufrankisch, dark elegant background, warm soft lighting"
generate "rdeca-vina/modra-frankinja-luna.png" "Professional food photography of Modra Frankinja Luna red wine, vibrant ruby red in crystal glass, moonlit aesthetic, premium Slovenian red wine, dark table, ambient lighting"
generate "rdeca-vina/modri-pinot-verus.png" "Professional food photography of Modri Pinot Verus red wine, translucent ruby Pinot Noir in crystal glass, elegant Slovenian wine, dark background, soft warm light"
generate "rdeca-vina/modri-pinot-opoka.png" "Professional food photography of Modri Pinot Opoka red wine, deep ruby Pinot Noir in crystal glass, mineral terroir expression, premium Slovenian wine, dark moody background"
generate "rdeca-vina/merlot-keltis.png" "Professional food photography of Merlot Keltis red wine, deep garnet red in crystal glass, full-bodied Slovenian Merlot, dark elegant table, warm ambient lighting"
generate "rdeca-vina/merlot-opoka.png" "Professional food photography of Merlot Opoka red wine, dark plum red in crystal glass, mineral-rich terroir Merlot, sophisticated dark background, warm soft light"
generate "rdeca-vina/cabernet-keltis.png" "Professional food photography of Cabernet Keltis red wine, deep dark ruby in crystal glass, structured Slovenian Cabernet, elegant dark table, warm lighting"
generate "rdeca-vina/cabernet-pavo.png" "Professional food photography of Cabernet Pavo red wine, intense dark red in crystal glass, bold Slovenian Cabernet Sauvignon, dark background, soft warm lighting"
generate "rdeca-vina/guerila-retro.png" "Professional food photography of Guerila Retro red wine, deep purple-red in modern glass, rebellious natural Slovenian wine, contemporary dark setting, moody lighting"
generate "rdeca-vina/duet-edi-simcic.png" "Professional food photography of Duet Edi Simcic red wine, deep garnet in crystal glass, iconic Slovenian premium blend, luxurious dark background, warm lighting"
generate "rdeca-vina/duet-lex-2018.png" "Professional food photography of Duet Lex 2018 red wine, deep ruby in crystal glass, premium vintage Slovenian blend, sophisticated dark table, ambient light"
generate "rdeca-vina/duet-lex-2020.png" "Professional food photography of Duet Lex 2020 red wine, vibrant ruby in crystal glass, young premium Slovenian blend, dark elegant background, soft warm lighting"
generate "rdeca-vina/carolina-rdeca.png" "Professional food photography of Carolina Rdeca red wine, deep crimson in crystal glass, elegant Slovenian red blend, dark table, warm ambient lighting"
generate "rdeca-vina/veliko-rdece-movia.png" "Professional food photography of Veliko Rdece Movia red wine, deep dark ruby in elegant glass, legendary Movia red, premium dark background, warm soft light"

# ============================================================
# PENINE (Sparkling Wines) - 11 duplicates
# ============================================================
echo "--- Generating Penine (Sparkling Wines) ---"
generate "penine/no1-brut.png" "Professional food photography of No.1 Brut sparkling wine in tall champagne flute, fine bubbles rising, pale golden color, elegant celebration setting, dark background, soft warm lighting"
generate "penine/slapsak-brut-reserve.png" "Professional food photography of Domaine Slapsak Brut Reserve sparkling wine in champagne flute, persistent bubbles, golden hue, premium Slovenian sparkling, dark elegant background, warm light"
generate "penine/slapsak-brut-rose.png" "Professional food photography of Domaine Slapsak Brut Rose sparkling wine in champagne flute, delicate pink color, fine bubbles, romantic dark background, soft warm lighting"
generate "penine/gourmet-rose.png" "Professional food photography of Penina Gourmet Rose sparkling wine in elegant flute, salmon pink color, fine effervescence, premium Slovenian sparkling, dark table, ambient light"
generate "penine/zlata-radgonska.png" "Professional food photography of Zlata Radgonska sparkling wine in champagne flute, golden bubbles, classic Slovenian sparkling tradition, elegant dark background, warm lighting"
generate "penine/maria-brut.png" "Professional food photography of Maria Brut 2020 sparkling wine in tall flute, pale gold with fine mousse, elegant Slovenian sparkling, dark sophisticated background, soft light"
generate "penine/boemme-rumeni-muskat.png" "Professional food photography of Boemme Rumeni Muskat sparkling wine in flute, golden aromatic Muscat bubbles, unique Slovenian sparkling, dark background, warm ambient light"
generate "penine/bjana-brut.png" "Professional food photography of Bjana Brut sparkling wine in champagne flute, bright golden with fine bubbles, premium Slovenian methode traditionnelle, dark elegant setting"
generate "penine/mufi-pet-nat.png" "Professional food photography of Mufi Pet Nat natural sparkling wine in glass, cloudy pale with natural sediment, fun artisan Slovenian sparkling, casual dark background"
generate "penine/louis-roederer.png" "Professional food photography of Louis Roederer champagne in crystal flute, ultra-fine bubbles, golden prestige champagne, luxury dark background, warm sophisticated lighting"
generate "penine/pol-roger.png" "Professional food photography of Pol Roger champagne in elegant flute, fine persistent bubbles, golden classic champagne, dark premium background, soft warm lighting"
generate "penine/moet-chandon.png" "Professional food photography of Moet and Chandon champagne in champagne flute, iconic golden bubbles, luxury celebration, dark elegant background, warm lighting"
generate "penine/dom-perignon.png" "Professional food photography of Dom Perignon champagne in crystal flute, ultra-fine mousse, deep golden prestige cuvee, ultra-luxury dark setting, sophisticated warm light"

# ============================================================
# TOPLI NAPITKI (Hot Drinks) - 16 duplicates
# ============================================================
echo "--- Generating Topli Napitki (Hot Drinks) ---"
generate "topli-napitki/kava-macchiato.png" "Professional food photography of espresso macchiato coffee, small cup with shot of espresso and dot of milk foam, Italian coffee culture, dark moody background, warm lighting"
generate "topli-napitki/bela-kava.png" "Professional food photography of bela kava white coffee, large cup with light milky coffee, Slovenian coffee tradition, saucer with spoon, dark table, warm ambient light"
generate "topli-napitki/kava-z-mlekom.png" "Professional food photography of kava z mlekom coffee with milk, medium cup with creamy coffee, steaming, saucer, dark elegant background, soft warm lighting"
generate "topli-napitki/kava-s-smethano.png" "Professional food photography of kava s smetano coffee with cream, elegant cup topped with whipped cream, rich coffee aroma, dark table, warm lighting"
generate "topli-napitki/bela-kava-brez-kofeina.png" "Professional food photography of decaffeinated bela kava, light milky decaf coffee in large cup, gentle warm tones, dark background, soft lighting"
generate "topli-napitki/cappuccino-brez-kofeina.png" "Professional food photography of decaf cappuccino, rich milk foam art on decaffeinated cappuccino, warm cup, dark elegant background, soft lighting"
generate "topli-napitki/kava-brez-kofeina.png" "Professional food photography of decaffeinated espresso, small espresso cup with dark decaf coffee, crema on top, dark moody background, warm light"
generate "topli-napitki/kava-mleko-brez-kofeina.png" "Professional food photography of decaf coffee with milk, medium cup with light decaf coffee, gentle and warm, dark table, soft ambient lighting"
generate "topli-napitki/macchiato-brez-kofeina.png" "Professional food photography of decaf macchiato, small cup with decaf espresso and milk dot, Italian style, dark background, warm soft lighting"
generate "topli-napitki/kava-rizevo-mleko.png" "Professional food photography of coffee with rice milk, modern cup with plant-based milk coffee, latte art, contemporary dark background, soft lighting"
generate "topli-napitki/kakav.png" "Professional food photography of hot cocoa kakav, rich dark hot chocolate in ceramic mug, steaming, dark moody background, warm lighting"
generate "topli-napitki/kakav-smetana.png" "Professional food photography of hot cocoa with whipped cream, rich hot chocolate topped with cream and cocoa powder, dark elegant background, warm light"
generate "topli-napitki/babyccino.png" "Professional food photography of babyccino, small cup with warm milk foam and cocoa sprinkle, children's coffee drink, cute presentation, dark table, warm light"
generate "topli-napitki/vroca-cokolada.png" "Professional food photography of hot chocolate vroca cokolada, thick rich dark hot chocolate in elegant cup, chocolate shavings, dark moody background, warm lighting"
generate "topli-napitki/caj-limona-med.png" "Professional food photography of tea with lemon and honey, herbal tea in glass cup with lemon slice and honey, warm and soothing, dark table, soft lighting"
generate "topli-napitki/ledena-kava-olimia.png" "Professional food photography of iced coffee ledena kava Olimia, tall glass with cold coffee, ice cubes, milk layers, refreshing, dark background, cool lighting"

# ============================================================
# GAZIRANE PIJACE (Carbonated Drinks) - 10 duplicates
# ============================================================
echo "--- Generating Gazirane Pijace (Carbonated Drinks) ---"
generate "gazirane-pijace/coca-cola-zero.png" "Professional food photography of Coca Cola Zero in glass with ice, dark cola drink in crystal glass, ice cubes, Coke Zero can beside, dark background, refreshing cool lighting"
generate "gazirane-pijace/cockta.png" "Professional food photography of Cockta soda in glass with ice, Slovenian iconic herbal cola drink, ice cubes, retro glass bottle beside, dark background, cool lighting"
generate "gazirane-pijace/fanta.png" "Professional food photography of Fanta orange soda in glass with ice, bright orange carbonated drink, ice cubes, Fanta bottle beside, dark background, refreshing cool light"
generate "gazirane-pijace/fever-tree-tonic.png" "Professional food photography of Fever Tree Tonic Water in glass with ice, crystal clear sparkling tonic, premium mixer, ice cubes and lime wedge, dark background, cool lighting"
generate "gazirane-pijace/fever-tree-med.png" "Professional food photography of Fever Tree Mediterranean Tonic in glass with ice, slightly golden tonic water, premium mixer, citrus garnish, dark background, cool light"
generate "gazirane-pijace/fever-tree-rhubarb.png" "Professional food photography of Fever Tree Rhubarb and Raspberry Tonic in glass with ice, pink tinted premium tonic, raspberry garnish, dark background, cool lighting"
generate "gazirane-pijace/red-bull.png" "Professional food photography of Red Bull energy drink in glass with ice, amber energy drink, ice cubes, Red Bull can beside, dark background, cool dynamic lighting"
generate "gazirane-pijace/schweppes-tonic.png" "Professional food photography of Schweppes Tonic Water in glass with ice, clear sparkling tonic, ice cubes and lime, Schweppes bottle, dark background, cool lighting"
generate "gazirane-pijace/schweppes-bitter.png" "Professional food photography of Schweppes Bitter Lemon in glass with ice, pale yellow bitter lemon soda, ice cubes, lemon garnish, dark background, cool light"
generate "gazirane-pijace/sprite.png" "Professional food photography of Sprite lemon-lime soda in glass with ice, clear green-tinted soda, ice cubes, lime wedge, dark background, refreshing cool lighting"

# ============================================================
# MESANE PIJACE (Mixed Drinks / Cocktails) - 10 duplicates
# ============================================================
echo "--- Generating Mesane Pijace (Mixed Drinks) ---"
generate "mesane-pijace/cuba-libre.png" "Professional cocktail photography of Cuba Libre, rum and cola in tall glass with lime wedge, ice cubes, dark moody bar background, warm ambient lighting"
generate "mesane-pijace/martini-spritz.png" "Professional cocktail photography of Martini Spritz, Martini vermouth with sparkling water in wine glass, orange slice, ice, dark elegant bar, warm lighting"
generate "mesane-pijace/mango-mojito.png" "Professional cocktail photography of Mango Mojito, fresh mango and mint in tall glass with white rum, soda, ice, tropical vibrant, dark bar background, warm light"
generate "mesane-pijace/strawberry-mojito.png" "Professional cocktail photography of Strawberry Mojito, muddled strawberries and mint in tall glass, white rum, soda, ice, dark bar background, warm lighting"
generate "mesane-pijace/hendricks-gin-tonic.png" "Professional cocktail photography of Hendricks Gin and Tonic, premium gin in balloon glass with cucumber ribbon, tonic, ice, dark elegant bar, soft lighting"
generate "mesane-pijace/monolog-gin-tonic.png" "Professional cocktail photography of Monolog Gin and Tonic, Slovenian craft gin in Copa glass with botanical garnish, tonic, ice, dark bar background, warm light"
generate "mesane-pijace/gin-mare-tonic.png" "Professional cocktail photography of Gin Mare and Tonic, Mediterranean gin in balloon glass with rosemary and olive, tonic, ice, dark bar background, warm lighting"
generate "mesane-pijace/monkey47-gin-tonic.png" "Professional cocktail photography of Monkey 47 Gin and Tonic, Black Forest gin in Copa glass with botanical garnish, tonic, ice, dark bar, warm light"
generate "mesane-pijace/orange-ginger-gin-tonic.png" "Professional cocktail photography of Orange and Ginger Gin and Tonic, gin in glass with orange wheel and ginger, tonic, ice, dark bar background, warm lighting"
generate "mesane-pijace/raspberry-pink-gin-tonic.png" "Professional cocktail photography of Raspberry Pink Gin and Tonic, pink gin in glass with fresh raspberries, tonic, ice, dark elegant bar, warm soft lighting"

# ============================================================
# SOKOVI (Juices) - 10 duplicates
# ============================================================
echo "--- Generating Sokovi (Juices) ---"
generate "sokovi/marelicni-sok.png" "Professional food photography of apricot juice in glass, bright orange apricot juice, fresh apricots beside glass, dark elegant background, warm soft lighting"
generate "sokovi/jablocni-sok.png" "Professional food photography of apple juice in glass, golden clear apple juice, fresh apples beside, dark elegant background, warm soft lighting"
generate "sokovi/ribezov-sok.png" "Professional food photography of blackcurrant juice in glass, deep red-purple currant juice, fresh currants beside, dark background, warm lighting"
generate "sokovi/ananasov-sok.png" "Professional food photography of pineapple juice in glass, bright yellow tropical pineapple juice, pineapple slice garnish, dark background, warm light"
generate "sokovi/pomarancni-sok.png" "Professional food photography of orange juice in glass, vibrant fresh orange juice, orange slices beside, dark elegant background, warm soft lighting"
generate "sokovi/jagodni-sok.png" "Professional food photography of strawberry juice in glass, bright red strawberry juice, fresh strawberries beside, dark background, warm soft lighting"
generate "sokovi/ledeni-caj.png" "Professional food photography of iced tea in tall glass, amber cold tea with ice cubes and lemon, refreshing, dark background, cool lighting"
generate "sokovi/cedevita.png" "Professional food photography of Cedevita vitamin drink in glass, bright orange effervescent vitamin drink, tablets beside, dark background, cool lighting"
generate "sokovi/bubble-tea.png" "Professional food photography of Bubble Tea boba drink in clear cup, milk tea with tapioca pearls at bottom, straw, dark background, soft lighting"

# ============================================================
# VISKI (Whisky) - 9 duplicates
# ============================================================
echo "--- Generating Viski (Whisky) ---"
generate "viski/chivas-12.png" "Professional whisky photography of Chivas Regal 12 Year Old, amber whisky in crystal tumbler glass, Chivas bottle behind, dark moody bar background, warm lighting"
generate "viski/johnnie-walker-black.png" "Professional whisky photography of Johnnie Walker Black Label, rich amber whisky in crystal tumbler, iconic bottle behind, dark elegant bar, warm lighting"
generate "viski/jack-daniels.png" "Professional whisky photography of Jack Daniels Tennessee Whiskey, golden whisky in tumbler glass, iconic square bottle behind, dark bar background, warm lighting"
generate "viski/jameson.png" "Professional whisky photography of Jameson Irish Whiskey, smooth golden whisky in tumbler glass, Jameson bottle behind, dark bar background, warm lighting"
generate "viski/lagavulin-16.png" "Professional whisky photography of Lagavulin 16 Year Old Islay Single Malt, deep amber peated whisky in snifter glass, bottle behind, dark moody background, warm light"
generate "viski/laphroaig-10.png" "Professional whisky photography of Laphroaig 10 Year Old Islay Single Malt, golden peaty whisky in tasting glass, bottle behind, dark moody bar, warm lighting"
generate "viski/glenmorangie-lasanta.png" "Professional whisky photography of Glenmorangie Lasanta 12 Year Old, rich amber sherry-finished whisky in tulip glass, bottle behind, dark elegant bar, warm light"
generate "viski/glenmorangie-18.png" "Professional whisky photography of Glenmorangie 18 Year Old, deep golden mature whisky in crystal tasting glass, bottle behind, dark premium bar, warm lighting"
generate "viski/nikka-miyagikyo.png" "Professional whisky photography of Nikka Miyagikyo Japanese Single Malt, golden elegant Japanese whisky in tasting glass, bottle behind, dark bar, soft lighting"
generate "viski/nikka-from-the-barrel.png" "Professional whisky photography of Nikka From the Barrel Japanese Whisky, rich amber bold whisky in small tumbler, iconic square bottle, dark bar, warm lighting"

# ============================================================
# GIN - 6 duplicates
# ============================================================
echo "--- Generating Gin ---"
generate "gin/gin-kristal.png" "Professional gin photography of Gin Kristal London Dry, crystal clear gin in copa balloon glass with juniper berries and citrus, dark elegant bar background, soft lighting"
generate "gin/gin-monolog.png" "Professional gin photography of Gin Monolog Slovenian craft gin, in balloon glass with local botanicals, dark bar background, warm soft lighting"
generate "gin/gin-hendricks.png" "Professional gin photography of Hendricks Gin, dark apothecary-style bottle, gin in balloon glass with cucumber and rose petals, dark bar, soft warm lighting"
generate "gin/gin-mare.png" "Professional gin photography of Gin Mare Mediterranean gin, in copa glass with rosemary sprig and olive, Mediterranean botanicals, dark bar, warm lighting"
generate "gin/gin-tanqueray.png" "Professional gin photography of Tanqueray London Dry Gin, green bottle, gin in glass with lime and juniper, dark bar background, warm soft lighting"
generate "gin/gin-monkey47.png" "Professional gin photography of Monkey 47 Schwarzwald Dry Gin, in copa glass with forest botanicals and berries, dark bar background, warm moody lighting"

# ============================================================
# DESTILATI (Distillates, Cognac, Rum) - 15 duplicates
# ============================================================
echo "--- Generating Destilati (Distillates) ---"
generate "destilati/viljamovka.png" "Professional photography of Viljamovka William pear brandy in small snifter glass, clear fruit brandy with pear bottle beside, Slovenian tradition, dark background, warm lighting"
generate "destilati/slivovka.png" "Professional photography of Slivovka plum brandy in small snifter glass, golden plum brandy with plum bottle beside, Slovenian tradition, dark background, warm light"
generate "destilati/brinjevec.png" "Professional photography of Brinjevec juniper brandy in small glass, clear herbal brandy with juniper berries beside, Slovenian tradition, dark background, warm lighting"
generate "destilati/grappa-sofija.png" "Professional photography of Grappa Sofija in small snifter glass, crystal clear Italian-style grape brandy, elegant bottle, dark background, warm soft lighting"
generate "destilati/travarica-rossi.png" "Professional photography of Travarica Rossi herbal brandy in small snifter, golden herbal brandy with herbs visible, dark background, warm ambient lighting"
generate "destilati/hennessy-vs.png" "Professional cognac photography of Hennessy VS in snifter glass, young cognac amber color, iconic bottle beside, dark luxury background, warm lighting"
generate "destilati/hennessy-xo.png" "Professional cognac photography of Hennessy XO in crystal snifter, deep aged amber cognac, prestigious bottle beside, dark luxury background, warm lighting"
generate "destilati/delamaine-xo.png" "Professional cognac photography of Delamaine XO in crystal snifter, rich deep amber aged cognac, elegant bottle beside, dark luxury bar, warm soft lighting"
generate "destilati/ararat-6.png" "Professional brandy photography of Ararat 6 Year Old Armenian brandy in snifter, golden amber brandy, iconic bottle beside, dark background, warm lighting"
generate "destilati/ararat-15.png" "Professional brandy photography of Ararat 15 Year Old Armenian brandy in snifter, deep amber aged brandy, premium bottle beside, dark background, warm lighting"
generate "destilati/ararat-20.png" "Professional brandy photography of Ararat 20 Year Old Armenian brandy in crystal snifter, very deep amber premium brandy, luxury bottle, dark background, warm light"
generate "destilati/rum-bumbu.png" "Professional rum photography of Bumbu Rum in tumbler glass, amber Caribbean rum, bottle beside, dark bar background, warm lighting"
generate "destilati/rum-zacapa.png" "Professional rum photography of Zacapa Centenario Rum in snifter, deep amber premium Guatemalan rum, elegant bottle, dark background, warm lighting"
generate "destilati/rum-diplomatico.png" "Professional rum photography of Diplomatico Rum in snifter glass, rich amber Venezuelan rum, iconic bottle beside, dark bar background, warm soft lighting"
generate "destilati/rum-la-hechicera.png" "Professional rum photography of La Hechicera Rum in snifter, deep amber Colombian rum, craft bottle beside, dark bar background, warm lighting"
generate "destilati/rum-havana-club.png" "Professional rum photography of Havana Club Rum in tumbler glass, golden Cuban rum, iconic bottle beside, dark bar background, warm lighting"

# ============================================================
# LIKERJI (Liqueurs) - 6 duplicates
# ============================================================
echo "--- Generating Likerji (Liqueurs) ---"
generate "likerji/malibu.png" "Professional liqueur photography of Malibu Rum coconut liqueur in glass, white milky coconut rum, coconut beside glass, tropical dark background, warm lighting"
generate "likerji/canella.png" "Professional liqueur photography of Canella limoncello liqueur in small glass, bright yellow Italian lemon liqueur, lemon beside, dark elegant background, warm light"
generate "likerji/bumbu-cream.png" "Professional liqueur photography of Bumbu Cream liqueur in glass, rich creamy rum cream liqueur, dark bottle beside, dark bar background, warm lighting"
generate "likerji/carolans.png" "Professional liqueur photography of Carolans Irish Cream liqueur in glass, golden cream liqueur, Irish cream bottle beside, dark background, warm soft lighting"
generate "likerji/medica-kejzar.png" "Professional liqueur photography of Medica Kejzar honey liqueur in small glass, golden honey brandy, honey dipper beside, dark background, warm lighting"
generate "likerji/borovnica-kejzar.png" "Professional liqueur photography of Borovnica Kejzar blueberry liqueur in small glass, deep purple blueberry liqueur, fresh blueberries beside, dark background, warm light"

# ============================================================
# GRENCICE (Bitters) - 5 duplicates
# ============================================================
echo "--- Generating Grenčice (Bitters) ---"
generate "grencice/pelinkovec-badel.png" "Professional photography of Pelinkovec Badel wormwood bitters in small glass, dark herbal bitter liqueur, herbal aesthetic, dark background, warm lighting"
generate "grencice/cynar.png" "Professional photography of Cynar artichoke bitter in rocks glass with ice, dark amber herbal bitter, artichoke bottle, dark bar background, warm lighting"
generate "grencice/jagermeister.png" "Professional photography of Jagermeister herbal liqueur in shot glass, dark green-black herbal shot, iconic bottle behind, dark moody background, cool lighting"
generate "grencice/amaro.png" "Professional photography of Amaro herbal bitter in small glass with ice, dark brown Italian herbal digestive, dark bar background, warm lighting"
generate "grencice/campari-bitter.png" "Professional photography of Campari Bitter in rocks glass with ice, bright red iconic bitter, orange slice, dark bar background, warm lighting"

# ============================================================
# TOCENO PIVO (Draft Beer) - 4 duplicates
# ============================================================
echo "--- Generating Točeno Pivo (Draft Beer) ---"
generate "toceno-pivo/haler-nefiltriran.png" "Professional beer photography of Haler Lager Nefiltriran unfiltered draft beer in tall beer glass, cloudy golden hazy lager, white foam head, dark pub background, warm lighting"
generate "toceno-pivo/union-lager.png" "Professional beer photography of Union Lager draft beer in tall beer glass, clear golden lager, white foam head, dark pub background, warm lighting"
generate "toceno-pivo/pelicon-ipa.png" "Professional beer photography of Pelicon IPA draft beer in craft beer glass, hazy golden IPA, citrus hop aroma, craft brewery aesthetic, dark pub background, warm light"
generate "toceno-pivo/radler.png" "Professional beer photography of Radler Grenivka grapefruit radler in tall glass, light golden grapefruit beer, refreshing, dark pub background, cool lighting"

# ============================================================
# CRAFT PIVA (Craft Beers) - 3 duplicates
# ============================================================
echo "--- Generating Craft Piva (Craft Beers) ---"
generate "craft-piva/pelicon-winter.png" "Professional beer photography of Pelicon Winter craft beer in tulip glass, dark amber winter ale, warm malt character, dark cozy pub background, warm lighting"
generate "craft-piva/zeleni-haler.png" "Professional beer photography of Zeleni Haler craft beer in glass, green-tinted craft lager, fresh herbal notes, dark pub background, cool lighting"
generate "craft-piva/bevog-tak.png" "Professional beer photography of Bevog Tak craft beer in tasting glass, bold craft ale, rich amber color, dark craft brewery background, warm lighting"

# ============================================================
# PIVO (Beer) - 3 duplicates
# ============================================================
echo "--- Generating Pivo (Beer) ---"
generate "pivo/reset-lagerish.png" "Professional beer photography of Reset Lagerish craft lager in pint glass, clear golden lager, white foam, modern craft beer aesthetic, dark background, warm lighting"
generate "pivo/reset-froggy-ipa.png" "Professional beer photography of Reset Froggy IPA in craft IPA glass, hazy golden India Pale Ale, citrus hop character, dark background, warm lighting"
generate "pivo/reset-irish-stout.png" "Professional beer photography of Reset Irish Extra Stout in pint glass, dark black stout, creamy tan foam head, Irish stout tradition, dark background, warm lighting"

# ============================================================
# BREZALKOHOLNO PIVO (Non-alcoholic Beer) - 2 duplicates
# ============================================================
echo "--- Generating Brezalkoholno Pivo ---"
generate "brezalk-pivo/heineken-0.png" "Professional beer photography of Heineken 0.0 non-alcoholic beer in glass, golden clear lager, white foam, green Heineken bottle, dark background, cool lighting"
generate "brezalk-pivo/daura-lager.png" "Professional beer photography of Daura Lager non-alcoholic beer in glass, golden lager, white foam head, dark background, warm lighting"

# ============================================================
# TUJA VINA (Foreign Wines) - 6 duplicates
# ============================================================
echo "--- Generating Tuja Vina (Foreign Wines) ---"
generate "tuja-vina/posip-terra-madre.png" "Professional food photography of Posip Premium Terra Madre white wine in glass, pale golden Croatian wine, dark elegant background, warm soft lighting"
generate "tuja-vina/andreis-vinasmora.png" "Professional food photography of Andreis Vinasmora white wine in glass, golden Slovenian-Italian border wine, dark elegant background, warm lighting"
generate "tuja-vina/plavac-mali-terra-madre.png" "Professional food photography of Plavac Mali Premium Terra Madre red wine in glass, deep ruby Croatian red, dark elegant background, warm lighting"
generate "tuja-vina/vranec-instinct.png" "Professional food photography of Vranec Instinct red wine in glass, deep dark purple Macedonian wine, dark elegant background, warm soft lighting"
generate "tuja-vina/jermann-dreams.png" "Professional food photography of Jermann Dreams Chardonnay in glass, pale golden premium Italian white wine, dark elegant background, warm lighting"
generate "tuja-vina/vintage-tunina.png" "Professional food photography of Vintage Tunina white wine blend in glass, deep golden premium Italian wine, dark elegant background, warm soft lighting"

# ============================================================
# LIKERSKO VINO (Dessert Wine) - 4 duplicates
# ============================================================
echo "--- Generating Likersko Vino (Dessert Wine) ---"
generate "likersko-vino/keros-belo.png" "Professional food photography of Keros Belo dessert wine in small glass, golden amber sweet white wine, dark elegant background, warm lighting"
generate "likersko-vino/keros-rdece.png" "Professional food photography of Keros Rdece dessert wine in small glass, deep ruby sweet red wine, dark elegant background, warm soft lighting"
generate "likersko-vino/veliko-rdece-2012.png" "Professional food photography of Veliko Rdece Movia 2012 vintage dessert wine in glass, deep aged ruby, dark elegant background, warm lighting"
generate "likersko-vino/sladki-refosk.png" "Professional food photography of Sladki Refosk sweet red wine in glass, deep purple sweet wine, dark elegant background, warm soft lighting"

# ============================================================
# NARAVNI SOKOVI (Natural Juices) - 4 duplicates
# ============================================================
echo "--- Generating Naravni Sokovi (Natural Juices) ---"
generate "naravni-sokovi/limonada-okus.png" "Professional food photography of flavored lemonade in tall glass, fresh lemon drink with fruit, ice, mint, dark elegant background, cool refreshing lighting"
generate "naravni-sokovi/hisni-sok-meta.png" "Professional food photography of house mint juice in glass, fresh green mint drink with ice, natural homemade style, dark background, cool lighting"
generate "naravni-sokovi/hisni-ledeni-caj.png" "Professional food photography of house iced tea in tall glass, amber cold tea with ice and lemon, dark background, cool refreshing lighting"
generate "naravni-sokovi/pomarancni-sok.png" "Professional food photography of fresh orange juice in glass, vibrant freshly squeezed orange juice, orange slices beside, dark background, warm lighting"

# ============================================================
# VODE (Waters) - 4 duplicates
# ============================================================
echo "--- Generating Vode (Waters) ---"
generate "vode/voda-z-okusom.png" "Professional food photography of flavored water in glass, clear water with fruit slices and herbs, refreshing, dark background, cool lighting"
generate "vode/radenska-functionall.png" "Professional food photography of Radenska FunctionALL functional water in glass, sparkling water with bubbles, modern bottle beside, dark background, cool lighting"
generate "vode/naravna-voda.png" "Professional food photography of natural still water in elegant glass, clear pure water, dark minimalist background, cool clean lighting"
generate "vode/mineralna-voda.png" "Professional food photography of mineral sparkling water in glass, effervescent bubbles in crystal clear water, dark minimalist background, cool lighting"

# ============================================================
# ROSE VINO (Rose Wine) - 2 duplicates
# ============================================================
echo "--- Generating Rosé Vino ---"
generate "rose-vino/rose-batic.png" "Professional food photography of Rosé Batič wine in glass, elegant pink salmon rose wine, Slovenian premium, dark background, warm soft lighting"
generate "rose-vino/rose-verstovsek-steklenica.png" "Professional food photography of Rosé Verstovšek wine bottle and glass, pink rose wine with bottle, dark elegant background, warm lighting"

echo ""
echo "=== Generation Complete ==="
echo "All unique professional images have been generated!"
