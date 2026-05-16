#!/bin/bash
# Generate remaining critical images one by one with pauses

GEN() {
  local prompt="$1"
  local output="$2"
  if [ -f "$output" ]; then
    echo "SKIP: $output already exists"
    return
  fi
  echo "Generating: $output"
  z-ai-generate -p "$prompt" -o "$output" -s 864x1152 2>&1 | tail -1
  sleep 4
}

BASE="/home/z/my-project/public/menu-images"

# === WINE GLASS vs BOTTLE (CRITICAL - must look different!) ===
GEN "Professional product photo of a wine glass with aromatic sweet white wine golden color single pour commercial wine photography" "$BASE/bela-vina/rumeni-muskat-steklenica-wait.png"
# Skip if rate limited

# Likersko vino - 0.05L vs 0.50L (CRITICAL!)
GEN "Professional product photo of a tiny 0.05L small tasting glass of amber dessert wine small glass clearly visible commercial wine photography" "$BASE/likersko-vino/keros-belo-005.png"
GEN "Professional product photo of a full 0.5L bottle of white dessert wine with elegant label commercial wine photography" "$BASE/likersko-vino/keros-belo-050.png"
GEN "Professional product photo of a tiny 0.05L small tasting glass of red dessert wine small glass clearly visible commercial wine photography" "$BASE/likersko-vino/keros-rdece-005.png"
GEN "Professional product photo of a full 0.5L bottle of red dessert wine with elegant label commercial wine photography" "$BASE/likersko-vino/keros-rdece-050.png"
GEN "Professional product photo of a wine glass of sweet Refosk red wine single pour commercial wine photography" "$BASE/likersko-vino/sladki-refosk-kozarec.png"
GEN "Professional product photo of a full bottle of sweet Refosk red wine commercial wine photography" "$BASE/likersko-vino/sladki-refosk-050.png"

# === CRITICAL FOOD DUPLICATES ===
# Pice - each must be unique
GEN "Professional food photography of Quattro Formaggi 4 cheese pizza with melting cheeses on wooden board commercial food photography" "$BASE/hrana/4-siri.png"
GEN "Professional food photography of BBQ pizza with barbecue sauce chicken and red onion on wooden board commercial food photography" "$BASE/hrana/bbq-pizza-unique.png"
GEN "Professional food photography of carpaccio pizza with thin beef and arugula on wooden board commercial food photography" "$BASE/hrana/carpaccio-pica.png"
GEN "Professional food photography of homemade pizza with fresh ingredients on wooden board commercial food photography" "$BASE/hrana/domaca-pica.png"
GEN "Professional food photography of Sicilian pizza with olives and capers on wooden board commercial food photography" "$BASE/hrana/siciliana-pica.png"
GEN "Professional food photography of garlic pizza with roasted garlic on wooden board commercial food photography" "$BASE/hrana/cesnova-pica.png"
GEN "Professional food photography of Capricciosa pizza with mushrooms ham and artichokes on wooden board commercial food photography" "$BASE/hrana/capricioza.png"
GEN "Professional food photography of Karst pizza with prsut and wild herbs on wooden board commercial food photography" "$BASE/hrana/kraska-pica.png"
GEN "Professional food photography of Mafioso pizza with spicy salami on wooden board commercial food photography" "$BASE/hrana/mafiozo.png"
GEN "Professional food photography of mixed salad bowl with fresh greens tomatoes and cucumber commercial food photography" "$BASE/hrana/mesana-solata-pica.png"
GEN "Professional food photography of vegetarian pizza with fresh vegetables on wooden board commercial food photography" "$BASE/hrana/zelenjavna-pica.png"
GEN "Professional food photography of seafood pizza with shrimp and squid on wooden board commercial food photography" "$BASE/hrana/morska-pica.png"
GEN "Professional food photography of truffle pizza with shaved truffles on wooden board commercial food photography" "$BASE/hrana/tartuf-pica.png"
GEN "Professional food photography of Rustica pizza with prosciutto and arugula on wooden board commercial food photography" "$BASE/hrana/rustika-pica.png"
GEN "Professional food photography of tuna pizza with fresh tuna on wooden board commercial food photography" "$BASE/hrana/tuna-pica.png"

# Zrezki - each must be unique
GEN "Professional food photography of Wiener schnitzel with lemon on plate commercial food photography" "$BASE/hrana/dunajski-zrezek.png"
GEN "Professional food photography of Ljubljana schnitzel with ham and cheese inside on plate commercial food photography" "$BASE/hrana/ljubljanski-zrezek.png"
GEN "Professional food photography of pork medallions in mushroom sauce on plate commercial food photography" "$BASE/hrana/svinjski-medaljoni.png"
GEN "Professional food photography of filet mignon on polenta plate commercial food photography" "$BASE/hrana/file-mignon-polenta.png"
GEN "Professional food photography of house steak with herb butter on plate commercial food photography" "$BASE/hrana/hisni-zrezek.png"
GEN "Professional food photography of roast beef grilled with rosemary on plate commercial food photography" "$BASE/hrana/rozbif-zar.png"
GEN "Professional food photography of roast beef with porcini mushrooms on plate commercial food photography" "$BASE/hrana/rozbif-jurcki.png"
GEN "Professional food photography of massive T-bone steak 1000g on wooden board commercial food photography" "$BASE/hrana/tbone-1000g.png"

# Solate
GEN "Professional food photography of Caesar salad with croutons and parmesan commercial food photography" "$BASE/hrana/cezar-solata.png"
GEN "Professional food photography of Greek salad with feta cheese and olives commercial food photography" "$BASE/hrana/grska-solata.png"
GEN "Professional food photography of Italian salad with mozzarella and pesto commercial food photography" "$BASE/hrana/italijanska-solata.png"
GEN "Professional food photography of chicken salad with grilled chicken breast commercial food photography" "$BASE/hrana/piscancja-solata.png"
GEN "Professional food photography of french fries pommes frites in paper cone commercial food photography" "$BASE/hrana/pomfrit.png"
GEN "Professional food photography of roast beef salad with arugula commercial food photography" "$BASE/hrana/roastbeef-solata.png"
GEN "Professional food photography of tuna salad with fresh tuna commercial food photography" "$BASE/hrana/solata-tuna.png"
GEN "Professional food photography of smoked salmon salad commercial food photography" "$BASE/hrana/solata-losos.png"
GEN "Professional food photography of fried chicken salad commercial food photography" "$BASE/hrana/solata-ocvrti-piscanec.png"

# Lignji
GEN "Professional food photography of fried calamari with lemon commercial food photography" "$BASE/hrana/lignji-ocvrti.png"
GEN "Professional food photography of stuffed calamari with filling commercial food photography" "$BASE/hrana/lignji-polnjeni.png"
GEN "Professional food photography of fried mixed seafood fritto misto commercial food photography" "$BASE/hrana/frito-misto.png"

# Čevapčiči
GEN "Professional food photography of pleskavica grilled meat patty with sides commercial food photography" "$BASE/hrana/pleskavica.png"
GEN "Professional food photography of pleskavica with kajmak cream commercial food photography" "$BASE/hrana/pleskavica-kajmak.png"
GEN "Professional food photography of stuffed pleskavica with cheese inside commercial food photography" "$BASE/hrana/polnjena-pleskavica.png"
GEN "Professional food photography of falafel wrap in pita bread commercial food photography" "$BASE/hrana/falafel-wrap.png"

# Burgerji
GEN "Professional food photography of Black Angus burger with thick patty commercial food photography" "$BASE/hrana/black-angus-burger.png"
GEN "Professional food photography of salmon burger with tartar sauce commercial food photography" "$BASE/hrana/burger-losos.png"

# Juhe
GEN "Professional food photography of beef soup with egg in bowl commercial food photography" "$BASE/hrana/goveja-juha-jajce.png"
GEN "Professional food photography of soup of the day in bowl commercial food photography" "$BASE/hrana/dnevna-juha.png"
GEN "Professional food photography of vegetable soup with fresh vegetables in bowl commercial food photography" "$BASE/hrana/zelenjavna-juha.png"

# Testenine
GEN "Professional food photography of spaghetti with tomato sauce on plate commercial food photography" "$BASE/hrana/spageti-paradiznik.png"
GEN "Professional food photography of penne with pesto and tomatoes commercial food photography" "$BASE/hrana/peresniki-pesto.png"
GEN "Professional food photography of penne with chicken and mushrooms commercial food photography" "$BASE/hrana/peresniki-piscanec.png"
GEN "Professional food photography of fuži pasta with shrimp commercial food photography" "$BASE/hrana/fuzi-gamberi.png"
GEN "Professional food photography of gnocchi with salmon in cream sauce commercial food photography" "$BASE/hrana/njoki-losos.png"
GEN "Professional food photography of wide ribbon pasta with salmon commercial food photography" "$BASE/hrana/rezanci-losos.png"
GEN "Professional food photography of spaghetti with seafood commercial food photography" "$BASE/hrana/spageti-morski.png"
GEN "Professional food photography of gnocchi with zucchini and pancetta commercial food photography" "$BASE/hrana/njoki-bucke.png"
GEN "Professional food photography of zlikrofi dumplings with sauce commercial food photography" "$BASE/hrana/zlikrofi.png"
GEN "Professional food photography of zlikrofi with tepka pear sauce commercial food photography" "$BASE/hrana/zlikrofi-tepke.png"

# Ribje jedi
GEN "Professional food photography of tuna steak grilled with sesame commercial food photography" "$BASE/hrana/tunin-steak.png"
GEN "Professional food photography of white fish filet with blitva chard commercial food photography" "$BASE/hrana/file-bele-ribe.png"
GEN "Professional food photography of grilled octopus on plate commercial food photography" "$BASE/hrana/hobotnica-zar.png"

# Žar
GEN "Professional food photography of mixed grill platter with various meats commercial food photography" "$BASE/hrana/mesano-meso.png"
GEN "Professional food photography of spicy grilled sausage with mustard commercial food photography" "$BASE/hrana/pikantna-klobasa.png"
GEN "Professional food photography of raznjici skewers on plate commercial food photography" "$BASE/hrana/raznjici.png"
GEN "Professional food photography of BBQ ribs with sauce commercial food photography" "$BASE/hrana/bbq-rebrca.png"

# Priloge
GEN "Professional food photography of boiled potatoes with parsley commercial food photography" "$BASE/hrana/kuhan-krompir.png"
GEN "Professional food photography of roasted vegetables on plate commercial food photography" "$BASE/hrana/pecena-zelenjava.png"
GEN "Professional food photography of pan fried potatoes golden brown commercial food photography" "$BASE/hrana/prazen-krompir.png"
GEN "Professional food photography of cooked vegetables side dish commercial food photography" "$BASE/hrana/kuhana-zelenjava.png"
GEN "Professional food photography of gnocchi as side dish commercial food photography" "$BASE/hrana/njoki-priloga.png"
GEN "Professional food photography of vegetarian plate with colorful vegetables commercial food photography" "$BASE/hrana/vegetarijanski-kroznik.png"

# Sir
GEN "Professional food photography of fried cheese with tartar sauce commercial food photography" "$BASE/hrana/ocvrti-sir.png"
GEN "Professional food photography of kids meal chicken nuggets with fries commercial food photography" "$BASE/hrana/scooby-doo.png"

# Rižote
GEN "Professional food photography of risotto with chicken and vegetables commercial food photography" "$BASE/hrana/rizota-piscanec.png"
GEN "Professional food photography of fresh lepinja bread commercial food photography" "$BASE/hrana/lepinja.png"
GEN "Professional food photography of fuži pasta with truffles commercial food photography" "$BASE/hrana/fuzi-tartufi.png"
GEN "Professional food photography of buckwheat porridge with mushrooms commercial food photography" "$BASE/hrana/ajdrova-kasa.png"
GEN "Professional food photography of duvec rice with vegetables commercial food photography" "$BASE/hrana/duvec-riz.png"

echo "=== ALL CRITICAL IMAGES GENERATED ==="
