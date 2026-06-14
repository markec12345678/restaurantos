#!/bin/bash
cd /home/z/my-project/restaurantos

declare -A PROMPTS

# Gazirane pijače
PROMPTS["coca-cola-zero"]="Professional product photography of a Coca-Cola Zero glass bottle and glass with ice, dark background, condensation droplets, studio lighting"
PROMPTS["cockta"]="Professional product photography of Cockta Slovenian soda bottle and glass, dark background, condensation, studio lighting"

# Viski
PROMPTS["lagavulin-16"]="Professional product photography of Lagavulin 16yo single malt whisky bottle and glass with amber liquid, dark moody background, studio lighting"
PROMPTS["laphroaig-10"]="Professional product photography of Laphroaig 10yo single malt whisky bottle and glass with golden liquid, dark background, studio lighting"

# Sladice
PROMPTS["palacinke-orehi"]="Professional food photography of pancakes with walnuts and honey, white plate, restaurant style, warm lighting, top-down view"
PROMPTS["palacinke-nutella"]="Professional food photography of crepes with Nutella chocolate spread, drizzled on plate, restaurant style, warm lighting"
PROMPTS["tiramisu"]="Professional food photography of classic Italian tiramisu dessert in a glass, cocoa dusted, restaurant style, warm lighting"
PROMPTS["vroce-visnje"]="Professional food photography of hot sour cherries with vanilla ice cream, white bowl, restaurant style, warm lighting"
PROMPTS["vroci-gozdni-sadezi"]="Professional food photography of hot forest berries with ice cream, white bowl, restaurant style, warm lighting"
PROMPTS["palacinke-nutella-banana"]="Professional food photography of crepes with Nutella and sliced banana, white plate, restaurant style, warm lighting"
PROMPTS["nutelina-torta"]="Professional food photography of Nutella chocolate cake slice with banana, restaurant dessert, warm lighting, top-down view"
PROMPTS["palacinke-nutella-orehi"]="Professional food photography of crepes with Nutella and walnuts, white plate, restaurant style, warm lighting"
PROMPTS["palacinke-cokolada"]="Professional food photography of chocolate pancakes with chocolate sauce, white plate, restaurant style, warm lighting"
PROMPTS["cokoladni-souffle"]="Professional food photography of chocolate souffle dessert, risen and dusted with powdered sugar, restaurant style, warm lighting"

# Grenčice
PROMPTS["amaro"]="Professional product photography of Amaro herbal liqueur bottle and small glass, dark background, studio lighting"
PROMPTS["jagermeister"]="Professional product photography of Jagermeister herbal liqueur bottle and shot glass, dark background, studio lighting, iconic green bottle"
PROMPTS["cynar"]="Professional product photography of Cynar herbal bitter liqueur bottle and glass, dark background, studio lighting"

# Destilati
PROMPTS["ararat-20"]="Professional product photography of Ararat 20yo Armenian brandy bottle and snifter glass, dark background, studio lighting"
PROMPTS["delamaine-xo"]="Professional product photography of Delamaine XO cognac bottle and crystal snifter, dark background, studio lighting"
PROMPTS["hennessy-xo"]="Professional product photography of Hennessy XO cognac bottle and crystal snifter, dark background, studio lighting"

# Otroške jedi
PROMPTS["pizza-jurcek"]="Professional food photography of a small kid-friendly mushroom pizza, white plate, restaurant style, warm lighting"

# Vegetarijanske jedi
PROMPTS["sojini-polpeti"]="Professional food photography of soy vegetarian patties on a plate with salad, restaurant style, warm lighting, top-down view"
PROMPTS["zelenjavni-zrezki"]="Professional food photography of vegetable cutlets with salad, white plate, restaurant style, warm lighting"
PROMPTS["ocvrti-melancani"]="Professional food photography of fried eggplant slices with parmesan, white plate, restaurant style, warm lighting"
PROMPTS["vegetarijanska-plosca"]="Professional food photography of a vegetarian platter with grilled vegetables, cheese, and bread, restaurant style, warm lighting"
PROMPTS["bucke-na-zaru"]="Professional food photography of grilled zucchini slices with garlic, white plate, restaurant style, warm lighting"

# Omake
PROMPTS["gobova-omaka"]="Professional food photography of mushroom sauce in a small bowl, creamy texture, restaurant style, warm lighting"
PROMPTS["orehova-omaka"]="Professional food photography of walnut sauce in a small bowl, restaurant style, warm lighting"
PROMPTS["poprova-omaka"]="Professional food photography of peppercorn sauce in a small bowl, restaurant style, warm lighting"
PROMPTS["gozdarska-omaka"]="Professional food photography of forest/hunter sauce in a small bowl, rich brown color, restaurant style, warm lighting"

# Palačinke
PROMPTS["kinder-bueno"]="Professional food photography of Kinder Bueno crepes with hazelnut cream, white plate, restaurant style, warm lighting"
PROMPTS["ferrero-rocher"]="Professional food photography of Ferrero Rocher chocolate crepes, white plate, restaurant style, warm lighting"
PROMPTS["snickers"]="Professional food photography of Snickers chocolate peanut crepes, white plate, restaurant style, warm lighting"

# Likerji
PROMPTS["borovnica-kejzar"]="Professional product photography of blueberry liqueur Kejzar bottle and small glass, dark background, studio lighting"

# Mešane pijače
PROMPTS["cuba-libre"]="Professional food photography of Cuba Libre cocktail with rum, cola, lime, ice in a glass, bar style, warm lighting"

# Malice
PROMPTS["malica-bograc"]="Professional food photography of bograc stew in a pot, traditional Hungarian-style stew, restaurant style, warm lighting"
PROMPTS["malica-goveji-golaz"]="Professional food photography of beef goulash with bread, white bowl, restaurant style, warm lighting"
PROMPTS["malica-pecena-rebra"]="Professional food photography of roasted pork ribs with sides, white plate, restaurant style, warm lighting"

COUNT=0
TOTAL=${#PROMPTS[@]}

for file in "${!PROMPTS[@]}"; do
  COUNT=$((COUNT + 1))
  # Find the full path
  FULL_PATH=$(find ./public/menu-images -name "${file}.png" | head -1)
  if [ -z "$FULL_PATH" ]; then
    echo "⚠️ File not found for: ${file}"
    continue
  fi
  
  PROMPT="${PROMPTS[$file]}"
  echo "[$COUNT/$TOTAL] Generating: ${file}.png"
  echo "  Path: ${FULL_PATH}"
  echo "  Prompt: ${PROMPT}"
  
  z-ai-generate -p "${PROMPT}" -o "${FULL_PATH}" -s 1024x1024 2>&1 | tail -1
  
  # Small delay to avoid rate limits
  sleep 1
done

echo ""
echo "========== REGENERATION COMPLETE =========="
echo "Regenerated: ${COUNT} images"
