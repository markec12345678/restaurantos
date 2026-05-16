#!/bin/bash
# Complete image generation for ALL menu items without images
# Each item gets a UNIQUE image matching its description
# Runs in background - monitor with: tail -f /home/z/my-project/download/gen-images-log.txt

LOG="/home/z/my-project/download/gen-images-log.txt"
BASE="/home/z/my-project/public/menu-images"

gen() {
  local prompt="$1"
  local output="$2"
  if [ -f "$output" ]; then
    echo "SKIP: $(basename $output)" >> $LOG
    return 0
  fi
  echo "GEN: $(basename $output) - $(date +%H:%M:%S)" >> $LOG
  z-ai-generate -p "$prompt" -o "$output" -s 864x1152 >> $LOG 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "FAIL: $(basename $output)" >> $LOG
    sleep 10
  else
    echo "OK: $(basename $output) - $(date +%H:%M:%S)" >> $LOG
  fi
  sleep 5
}

echo "=== START: $(date) ===" >> $LOG

# BURGERJI (7)
gen "Professional food photography of cheeseburger with melted cheddar on brioche bun" "$BASE/burgerji/cheese-please.png"
gen "Professional food photography of crispy fried chicken burger with coleslaw" "$BASE/burgerji/crispy-chicken.png"
gen "Professional food photography of fitness burger with turkey patty and avocado" "$BASE/burgerji/fit-burger.png"
gen "Professional food photography of garden veggie burger with fresh vegetables" "$BASE/burgerji/green-garden.png"
gen "Professional food photography of house signature burger with special sauce" "$BASE/burgerji/hisni-burger.png"
gen "Professional food photography of Italian style burger with mozzarella and pesto" "$BASE/burgerji/jamies-italian.png"
gen "Professional food photography of classic burger with lettuce tomato and onion" "$BASE/burgerji/the-classic.png"

# GLAVNE JEDI (30)
gen "Professional food photography of beef goulash in pot" "$BASE/glavne-jedi/goveji-golaz.png"
gen "Professional food photography of Hawaii steak with pineapple" "$BASE/glavne-jedi/hawaii-zrezek.png"
gen "Professional food photography of house platter with mixed meats" "$BASE/glavne-jedi/hisna-plosca.png"
gen "Professional food photography of farmer platter with traditional meats" "$BASE/glavne-jedi/kmecka-plosca.png"
gen "Professional food photography of winter farmer platter with hearty food" "$BASE/glavne-jedi/kmecka-plosca-zimska.png"
gen "Professional food photography of farmer plate with traditional Slovenian food" "$BASE/glavne-jedi/kmecki-kroznik.png"
gen "Professional food photography of winter farmer plate with stew" "$BASE/glavne-jedi/kmecki-kroznik-zimski.png"
gen "Professional food photography of Karst beefsteak with herbs" "$BASE/glavne-jedi/kraski-beefsteak.png"
gen "Professional food photography of Karst schnitzel" "$BASE/glavne-jedi/kraski-zrezek.png"
gen "Professional food photography of blood sausage with sides" "$BASE/glavne-jedi/krvavica.png"
gen "Professional food photography of natural grilled steak" "$BASE/glavne-jedi/naravni-zrezek.png"
gen "Professional food photography of fried chicken breaded" "$BASE/glavne-jedi/ocvrt-piscanec.png"
gen "Professional food photography of Parisian schnitzel" "$BASE/glavne-jedi/pariski-zrezek.png"
gen "Professional food photography of roasted pork knuckle" "$BASE/glavne-jedi/pecena-svinjska-kraca.png"
gen "Professional food photography of grilled sausage with sides" "$BASE/glavne-jedi/pecenica.png"
gen "Professional food photography of breaded fried meat" "$BASE/glavne-jedi/pohancocki.png"
gen "Professional food photography of stuffed veal breast" "$BASE/glavne-jedi/polnjena-telecja-prsa.png"
gen "Professional food photography of roast beef on plate" "$BASE/glavne-jedi/rostbeef.png"
gen "Professional food photography of rump steak grilled" "$BASE/glavne-jedi/rumpsteak.png"
gen "Professional food photography of cheese steak with melted cheese" "$BASE/glavne-jedi/sirov-zrezek.png"
gen "Professional food photography of roasted pork" "$BASE/glavne-jedi/svinjska-pecenka.png"
gen "Professional food photography of tagliata sliced beef on arugula" "$BASE/glavne-jedi/tagliata-rukola.png"
gen "Professional food photography of veal roast" "$BASE/glavne-jedi/telecja-pecenka.png"
gen "Professional food photography of steak in curry sauce" "$BASE/glavne-jedi/zrezek-curry.png"
gen "Professional food photography of steak in gorgonzola sauce with mushrooms" "$BASE/glavne-jedi/zrezek-gorgonzola-gobe.png"
gen "Professional food photography of steak in cream sauce" "$BASE/glavne-jedi/zrezek-smetanova.png"
gen "Professional food photography of steak in cream sauce with tarragon" "$BASE/glavne-jedi/zrezek-smetana-pehtran.png"
gen "Professional food photography of steak with mushrooms" "$BASE/glavne-jedi/zrezek-gobe.png"
gen "Professional food photography of grilled steak on arugula" "$BASE/glavne-jedi/zrezek-zar-rukola.png"
gen "Professional food photography of mixed grill platter" "$BASE/glavne-jedi/zar-tris.png"

# HLAJENE PREDJEDI (3)
gen "Professional food photography of cold cuts platter with ham and cheese" "$BASE/hladne-predjedi/domaci-narezek.png"
gen "Professional food photography of prosciutto with olives" "$BASE/hladne-predjedi/prsut-olive.png"
gen "Professional food photography of cheese platter with various cheeses" "$BASE/hladne-predjedi/sirova-plosca.png"

# JUHE (3)
gen "Professional food photography of creamy mushroom soup in bowl" "$BASE/juhe/dnevna-gobova.png"
gen "Professional food photography of creamy vegetable soup in bowl" "$BASE/juhe/dnevna-zelenjavna.png"
gen "Professional food photography of beef soup in bowl" "$BASE/juhe/goveja-juha.png"

# KALAMARI (7)
gen "Professional food photography of grilled calamari on plate" "$BASE/kalamari/kalamari-zar.png"
gen "Professional food photography of calamari in sailor style with tomato" "$BASE/kalamari/kalamari-mornarsko.png"
gen "Professional food photography of grilled calamari on arugula" "$BASE/kalamari/kalamari-rukola.png"
gen "Professional food photography of mixed fried calamari" "$BASE/kalamari/mesani-kalamari.png"
gen "Professional food photography of fried calamari rings" "$BASE/kalamari/ocvrti-kalamari.png"
gen "Professional food photography of stuffed grilled calamari" "$BASE/kalamari/polnjeni-kalamari-zar.png"
gen "Professional food photography of stuffed calamari breaded" "$BASE/kalamari/polnjeni-kalamari-dunajsko.png"

# PIZZE (24)
gen "Professional food photography of four seasons pizza" "$BASE/pizze/4-letni-casi.png"
gen "Professional food photography of house pizza with various toppings" "$BASE/pizze/hisna-pica.png"
gen "Professional food photography of kebab pizza with meat" "$BASE/pizze/kebab.png"
gen "Professional food photography of farmer pizza with bacon" "$BASE/pizze/kmecka.png"
gen "Professional food photography of queen pizza with ham and mushrooms" "$BASE/pizze/kraljica.png"
gen "Professional food photography of hunter pizza with game meat" "$BASE/pizze/lovska.png"
gen "Professional food photography of margherita pizza with basil" "$BASE/pizze/margerita.png"
gen "Professional food photography of Mexican pizza with jalapenos" "$BASE/pizze/mehiska.png"
gen "Professional food photography of mortadella pizza" "$BASE/pizze/mortadela.png"
gen "Professional food photography of Napoli pizza with anchovies" "$BASE/pizze/napoli.png"
gen "Professional food photography of spicy pizza with feferoni" "$BASE/pizze/pikant.png"
gen "Professional food photography of fishermans pizza with seafood" "$BASE/pizze/ribiska.png"
gen "Professional food photography of Romana pizza with tomato" "$BASE/pizze/romana.png"
gen "Professional food photography of pizza with bacon" "$BASE/pizze/s-slanino.png"
gen "Professional food photography of pizza with dry salami" "$BASE/pizze/s-suho-salamo.png"
gen "Professional food photography of pizza with fresh mushrooms" "$BASE/pizze/s-sampinjoni.png"
gen "Professional food photography of pizza with fresh vegetables" "$BASE/pizze/s-zelenjavo.png"
gen "Professional food photography of pizza with tuna" "$BASE/pizze/s-tuno.png"
gen "Professional food photography of vegetarian pizza" "$BASE/pizze/vegetarijanska.png"
gen "Professional food photography of pizza with shrimp" "$BASE/pizze/z-gamberi.png"
gen "Professional food photography of pizza with eggplant" "$BASE/pizze/z-melancani.png"
gen "Professional food photography of pizza with arugula" "$BASE/pizze/z-rukolo.png"
gen "Professional food photography of quattro formaggi four cheese pizza" "$BASE/pizze/stirje-siri.png"
gen "Professional food photography of student pizza with ham" "$BASE/pizze/studentska.png"

# SOLATE (21)
gen "Professional food photography of Caesar salad with croutons" "$BASE/solate/cezarjeva-solata.png"
gen "Professional food photography of bean salad" "$BASE/solate/fizolova-solata.png"
gen "Professional food photography of corn salad" "$BASE/solate/koruzna-solata.png"
gen "Professional food photography of cucumber salad" "$BASE/solate/kumare.png"
gen "Professional food photography of mixed salad with tuna" "$BASE/solate/mesana-solata-tuna.png"
gen "Professional food photography of lamb lettuce salad" "$BASE/solate/motovilec.png"
gen "Professional food photography of tomato salad" "$BASE/solate/paradiznikova-solata.png"
gen "Professional food photography of roasted pepper salad" "$BASE/solate/pecena-paprika.png"
gen "Professional food photography of arugula salad" "$BASE/solate/rukola.png"
gen "Professional food photography of Queen salad with shrimp" "$BASE/solate/solata-kraljica.png"
gen "Professional food photography of Queen salad with turkey" "$BASE/solate/solata-kraljica-puran.png"
gen "Professional food photography of Queen salad with tuna" "$BASE/solate/solata-kraljica-tuna.png"
gen "Professional food photography of Queen salad with ham" "$BASE/solate/solata-kraljica-sunka.png"
gen "Professional food photography of Queen salad with egg" "$BASE/solate/solata-kraljica-jajca.png"
gen "Professional food photography of arugula salad with parmesan" "$BASE/solate/rukola-parmezan.png"
gen "Professional food photography of salad bowl with feta cheese" "$BASE/solate/solatni-kroznik-feta.png"
gen "Professional food photography of salad with grilled bacon" "$BASE/solate/solatni-kroznik-slanina.png"
gen "Professional food photography of salad with turkey" "$BASE/solate/solatni-kroznik-puran.png"
gen "Professional food photography of salad bowl with tuna" "$BASE/solate/solatni-kroznik-tuna.png"
gen "Professional food photography of green salad" "$BASE/solate/zelena-solata.png"
gen "Professional food photography of cabbage salad" "$BASE/solate/zeljnata-solata.png"

# SLADICE (23)
gen "Professional food photography of banana split dessert" "$BASE/sladice/banana-split.png"
gen "Professional food photography of house dessert cake" "$BASE/sladice/hisna-grmada.png"
gen "Professional food photography of house sweet dessert" "$BASE/sladice/hisna-sladica.png"
gen "Professional food photography of Linolada cake with banana" "$BASE/sladice/linolada-banana.png"
gen "Professional food photography of Nutella cake with banana" "$BASE/sladice/nutelina-torta.png"
gen "Professional food photography of chocolate crepes" "$BASE/sladice/palacinke-cokolad.png"
gen "Professional food photography of Nutella crepes" "$BASE/sladice/palacinke-nutella.png"
gen "Professional food photography of Nutella banana crepes" "$BASE/sladice/palacinke-nutella-banana.png"
gen "Professional food photography of Nutella walnut crepes" "$BASE/sladice/palacinke-nutella-orehi.png"
gen "Professional food photography of cranberry crepes" "$BASE/sladice/palacinke-brusnice.png"
gen "Professional food photography of jam crepes" "$BASE/sladice/palacinke-marmelada.png"
gen "Professional food photography of walnut crepes" "$BASE/sladice/palacinke-orehi.png"
gen "Professional food photography of panna cotta with strawberry" "$BASE/sladice/panna-cotta-jagoda.png"
gen "Professional food photography of tarragon crepes" "$BASE/sladice/pehtranove-palacinke.png"
gen "Professional food photography of fruit cup dessert" "$BASE/sladice/sadna-kupa.png"
gen "Professional food photography of cottage cheese strudel" "$BASE/sladice/sirovi-strukelj.png"
gen "Professional food photography of cottage cheese crepes" "$BASE/sladice/skutine-palacinke.png"
gen "Professional food photography of ice cream scoop" "$BASE/sladice/sladoled-kepica.png"
gen "Professional food photography of ice cream portion" "$BASE/sladice/sladoled-porcija.png"
gen "Professional food photography of Hana cake slice" "$BASE/sladice/torte-hana.png"
gen "Professional food photography of hot cherries with ice cream" "$BASE/sladice/vroce-visnje.png"
gen "Professional food photography of hot forest berries with ice cream" "$BASE/sladice/vroci-gozdni-sadezi.png"
gen "Professional food photography of chocolate souffle" "$BASE/sladice/cokoladni-souffle.png"

# PALACINKE (13)
gen "Professional food photography of grandmas crepe with jam" "$BASE/palacinke/babicina-poslastica.png"
gen "Professional food photography of cheesecake crepe with banana" "$BASE/palacinke/cheesecake-banana.png"
gen "Professional food photography of Oreo cheesecake crepe with strawberry" "$BASE/palacinke/cheesecake-oreo.png"
gen "Professional food photography of Ferrero Rocher crepe" "$BASE/palacinke/ferrero-rocher.png"
gen "Professional food photography of fruity crepe with berries" "$BASE/palacinke/fruty-njam.png"
gen "Professional food photography of Jurmac crepe" "$BASE/palacinke/jurmacinka.png"
gen "Professional food photography of Kinder Bueno crepe" "$BASE/palacinke/kinder-bueno.png"
gen "Professional food photography of M and M crepe" "$BASE/palacinke/mms.png"
gen "Professional food photography of pink dreams crepe with berries" "$BASE/palacinke/pink-dreams.png"
gen "Professional food photography of Raffaello crepe" "$BASE/palacinke/raffaello.png"
gen "Professional food photography of Snickers crepe" "$BASE/palacinke/snickers.png"
gen "Professional food photography of strawberry crepe" "$BASE/palacinke/sweet-strawberry.png"
gen "Professional food photography of pistachio white chocolate crepe" "$BASE/palacinke/white-pistachio.png"

# RIZOTE (7)
gen "Professional food photography of seafood risotto" "$BASE/rizote/morska-rizota.png"
gen "Professional food photography of risotto with turkey and peppers" "$BASE/rizote/rizota-puran-paprika.png"
gen "Professional food photography of risotto with shrimp and mushrooms" "$BASE/rizote/rizota-gamberi-gobe.png"
gen "Professional food photography of mushroom risotto" "$BASE/rizote/rizota-gobe.png"
gen "Professional food photography of risotto with porcini mushrooms" "$BASE/rizote/rizota-jurcki.png"
gen "Professional food photography of seafood risotto with shrimp" "$BASE/rizote/rizota-morski-sadezi.png"
gen "Professional food photography of vegetable risotto" "$BASE/rizote/zelenjavna-rizota.png"

# TESTENINE (17+3)
gen "Professional food photography of spaghetti carbonara" "$BASE/testenine-njoki/carbonara.png"
gen "Professional food photography of Milanese style pasta" "$BASE/testenine-njoki/milanese.png"
gen "Professional food photography of Napoli style pasta" "$BASE/testenine-njoki/napoli.png"
gen "Professional food photography of Pad Thai with chicken" "$BASE/testenine-njoki/pad-thai-piscanec.png"
gen "Professional food photography of Pad Thai with vegetables" "$BASE/testenine-njoki/pad-thai-zelenjava.png"
gen "Professional food photography of pasta with chicken" "$BASE/testenine-njoki/s-piscancem.png"
gen "Professional food photography of pasta with lung roast and vegetables" "$BASE/testenine-njoki/s-pljucno-pecenko.png"
gen "Professional food photography of pasta with turkey in curry sauce" "$BASE/testenine-njoki/s-puran-curry.png"
gen "Professional food photography of pasta with turkey in cream sauce" "$BASE/testenine-njoki/s-puran-smetana.png"
gen "Professional food photography of pasta with truffles" "$BASE/testenine-njoki/s-tartufi.png"
gen "Professional food photography of Sicilian style pasta" "$BASE/testenine-njoki/sicilijana.png"
gen "Professional food photography of pasta in gorgonzola sauce" "$BASE/testenine-njoki/v-gorgonzoli.png"
gen "Professional food photography of pasta in cream sauce" "$BASE/testenine-njoki/v-smetanovi.png"
gen "Professional food photography of pasta with shrimp in wine sauce" "$BASE/testenine-njoki/z-gamberi-vino.png"
gen "Professional food photography of pasta with mushrooms" "$BASE/testenine-njoki/z-gobami.png"
gen "Professional food photography of pasta with seafood" "$BASE/testenine-njoki/z-morskimi-sadezi.png"
gen "Professional food photography of pasta with seafood in cream sauce" "$BASE/testenine-njoki/z-morskimi-smetana.png"
gen "Professional food photography of meat lasagna" "$BASE/testenine-njoki/mesna-lazanja.png"
gen "Professional food photography of gnocchi with porcini mushrooms" "$BASE/testenine-njoki/njoki-jurcki.png"
gen "Professional food photography of zlikrofi with gorgonzola" "$BASE/testenine-njoki/zlikrofi-gorgonzola.png"

# RIBJE JEDI (7)
gen "Professional food photography of grilled sea bass filet" "$BASE/ribje-jedi/file-brancina.png"
gen "Professional food photography of grilled sea bream filet" "$BASE/ribje-jedi/file-orade.png"
gen "Professional food photography of grilled trout filet" "$BASE/ribje-jedi/file-postrvi.png"
gen "Professional food photography of shrimp Parisienne style" "$BASE/ribje-jedi/gamberi-parisko.png"
gen "Professional food photography of grilled salmon filet" "$BASE/ribje-jedi/losos.png"
gen "Professional food photography of fried hake with sides" "$BASE/ribje-jedi/ocvrt-oslic.png"
gen "Professional food photography of fish platter with various fish" "$BASE/ribje-jedi/ribja-plosca.png"

# TOPLE PREDJEDI (7)
gen "Professional food photography of fried cheese with tartar sauce" "$BASE/tople-predjedi/ocvrti-sir-tatarska.png"
gen "Professional food photography of fried mushrooms" "$BASE/tople-predjedi/ocvrti-sampinjoni.png"
gen "Professional food photography of grilled bacon on arugula" "$BASE/tople-predjedi/pecena-slanina-rukola.png"
gen "Professional food photography of cottage cheese dumplings" "$BASE/tople-predjedi/sirovi-struklji.png"
gen "Professional food photography of grilled mushrooms with Trieste sauce" "$BASE/tople-predjedi/sampinjoni-trzaska.png"
gen "Professional food photography of grilled mushrooms with gorgonzola" "$BASE/tople-predjedi/sampinjoni-gorgonzola.png"
gen "Professional food photography of mushrooms in gorgonzola sauce" "$BASE/tople-predjedi/sampinjoni-gorgonzola-omaka.png"

# VEGETARIJANSKE JEDI (7)
gen "Professional food photography of fried zucchini slices" "$BASE/vegetarijanske-jedi/ocvrte-bucke.png"
gen "Professional food photography of fried eggplant slices" "$BASE/vegetarijanske-jedi/ocvrti-melancani.png"
gen "Professional food photography of roasted vegetables on arugula" "$BASE/vegetarijanske-jedi/pecena-zelenjava-rukola.png"
gen "Professional food photography of soy patties with salad" "$BASE/vegetarijanske-jedi/sojini-polpeti.png"
gen "Professional food photography of vegetarian platter" "$BASE/vegetarijanske-jedi/vegetarijanska-plosca.png"
gen "Professional food photography of vegetable plate" "$BASE/vegetarijanske-jedi/zelenjavni-kroznik.png"
gen "Professional food photography of vegetable steaks" "$BASE/vegetarijanske-jedi/zelenjavni-zrezki.png"

# OTROSKE JEDI (12)
gen "Professional food photography of kids pancake soup" "$BASE/otroske-jedi/juha-palacinke.png"
gen "Professional food photography of kids ice cream scoop" "$BASE/otroske-jedi/kepica-sladoleda.png"
gen "Professional food photography of kids pirate meal" "$BASE/otroske-jedi/gusar-berto.png"
gen "Professional food photography of kids herbal meal" "$BASE/otroske-jedi/korenjak.png"
gen "Professional food photography of kids mouse meal" "$BASE/otroske-jedi/miskolin.png"
gen "Professional food photography of kids penguin meal" "$BASE/otroske-jedi/pingvincek.png"
gen "Professional food photography of kids spaghetti meal" "$BASE/otroske-jedi/spagetek.png"
gen "Professional food photography of kids breaded chicken" "$BASE/otroske-jedi/otroski-pohancki.png"
gen "Professional food photography of kids butterfly pancakes" "$BASE/otroske-jedi/palacinke-metuljcek.png"
gen "Professional food photography of kids Jurcek pizza" "$BASE/otroske-jedi/pizza-jurcek.png"
gen "Professional food photography of kids baby pizza" "$BASE/otroske-jedi/pizza-malcek.png"
gen "Professional food photography of kids fruit cup with cream" "$BASE/otroske-jedi/sadna-kupa-smetana.png"

# MALICE (12)
gen "Professional food photography of BBQ chicken wings lunch" "$BASE/malice/malica-bbv-perutnicke.png"
gen "Professional food photography of Bograc stew lunch" "$BASE/malice/malica-bograc.png"
gen "Professional food photography of Wiener schnitzel lunch" "$BASE/malice/malica-dunajski.png"
gen "Professional food photography of beef goulash lunch" "$BASE/malice/malica-golaz.png"
gen "Professional food photography of meat cheese lunch" "$BASE/malice/malica-mesni-sir.png"
gen "Professional food photography of fried hake lunch" "$BASE/malice/malica-oslic.png"
gen "Professional food photography of fried hake with fries lunch" "$BASE/malice/malica-oslic-pomfrit.png"
gen "Professional food photography of fried cheese lunch" "$BASE/malice/malica-ocvrti-sir.png"
gen "Professional food photography of Parisian schnitzel lunch" "$BASE/malice/malica-pariski.png"
gen "Professional food photography of roasted ribs lunch" "$BASE/malice/malica-pecena-rebra.png"
gen "Professional food photography of roast pork lunch" "$BASE/malice/malica-svinjska-pecenka.png"
gen "Professional food photography of spaghetti bolognese lunch" "$BASE/malice/malica-spageti-bolonjske.png"

# OMAKE (9)
gen "Professional food photography of curry sauce in small bowl" "$BASE/omake/curry-omaka.png"
gen "Professional food photography of mushroom sauce in bowl" "$BASE/omake/gobova-omaka.png"
gen "Professional food photography of gorgonzola sauce in bowl" "$BASE/omake/gorgonzolna-omaka.png"
gen "Professional food photography of mustard sauce in bowl" "$BASE/omake/gorcicna-omaka.png"
gen "Professional food photography of hunter sauce in bowl" "$BASE/omake/gozdarska-omaka.png"
gen "Professional food photography of walnut sauce in bowl" "$BASE/omake/orehova-omaka.png"
gen "Professional food photography of pepper sauce in bowl" "$BASE/omake/poprova-omaka.png"
gen "Professional food photography of cheese sauce in bowl" "$BASE/omake/sirova-omaka.png"
gen "Professional food photography of cream sauce in bowl" "$BASE/omake/smetanova-omaka.png"

# PRILOGE (16)
gen "Professional food photography of grilled zucchini with garlic side dish" "$BASE/priloge/bucke-cesen.png"
gen "Professional food photography of potato chips side dish" "$BASE/priloge/krompirjev-cips.png"
gen "Professional food photography of potato fritters side dish" "$BASE/priloge/krompirjevi-ocvrtki.png"
gen "Professional food photography of boiled then roasted potatoes" "$BASE/priloge/kuhan-pecen-krompir.png"
gen "Professional food photography of boiled gnocchi side dish" "$BASE/priloge/kuhani-njoki.png"
gen "Professional food photography of fried zucchini slices side dish" "$BASE/priloge/ocvrte-bucke.png"
gen "Professional food photography of fried gnocchi side dish" "$BASE/priloge/ocvrti-njoki.png"
gen "Professional food photography of roasted potatoes side dish" "$BASE/priloge/pecen-krompir.png"
gen "Professional food photography of roasted vegetables side dish" "$BASE/priloge/pecena-zelenjava.png"
gen "Professional food photography of french fries pommes frites" "$BASE/priloge/pommes-frites.png"
gen "Professional food photography of rice side dish" "$BASE/priloge/riz.png"
gen "Professional food photography of cheese strudel side dish" "$BASE/priloge/sirov-strukelj.png"
gen "Professional food photography of salt potatoes side dish" "$BASE/priloge/slan-krompir.png"
gen "Professional food photography of Grana Padano hard cheese side dish" "$BASE/priloge/grana-padano.png"
gen "Professional food photography of wide ribbon pasta side dish" "$BASE/priloge/siroki-rezanci.png"
gen "Professional food photography of grooved potato fries" "$BASE/priloge/zlebasti-krompircek.png"

echo "=== ALL DONE: $(date) ===" >> $LOG
