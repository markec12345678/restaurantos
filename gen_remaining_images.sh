#!/bin/bash
# Generate remaining food images - ONE AT A TIME with delays
# Runs in background, can survive session issues

declare -A P
P["svinjska-rebra-z-zara"]="BBQ pork ribs with coleslaw fries restaurant photo"
P["medaljoni-iz-govedine"]="Beef medallions asparagus red wine sauce restaurant photo"
P["piscancji-file-v-parmezani"]="Chicken parmesan mozzarella tomato sauce restaurant photo"
P["tagliatelle-s-tartufi"]="Tagliatelle pasta black truffle shavings butter restaurant photo"
P["penne-s-piscancem-in-curryjem"]="Penne pasta chicken curry sauce restaurant photo"
P["rezanci-z-gobami"]="Homemade noodles wild mushrooms cream restaurant photo"
P["stirje-siri"]="Four cheese pizza mozzarella gorgonzola restaurant photo"
P["tunina-pica"]="Tuna pizza onions olives capers restaurant photo"
P["havajska-pica"]="Hawaiian pizza ham pineapple restaurant photo"
P["kmecka-pica"]="Rustic pizza bacon sausage peppers restaurant photo"
P["bbq-burger"]="BBQ burger bacon onion rings restaurant photo"
P["chili-burger"]="Chili burger jalapenos spicy restaurant photo"
P["burger-z-jajcem-in-slanino"]="Burger fried egg crispy bacon restaurant photo"
P["krofi-s-pomarancno-marmelado"]="Fried doughnuts orange marmalade restaurant photo"
P["ledeni-desert"]="Ice cream dessert chocolate sauce berries restaurant photo"
P["domino-kocke"]="Domino cube cake chocolate cream layers restaurant photo"
P["sladoled-tri-okuse"]="Three scoops ice cream different flavors restaurant photo"
P["njoki"]="Potato gnocchi tomato sauce parmesan restaurant photo"
P["mlinci"]="Baked mlinci flatbread Slovenian restaurant photo"
P["krompirjevi-kroketi"]="Golden fried potato croquettes restaurant photo"
P["ocvrtki"]="Fried dough pieces Slovenian side dish restaurant photo"
P["ajdova-kasa"]="Buckwheat porridge crispy pork Slovenian restaurant photo"
P["zar-zelenjava"]="Grilled mixed vegetables olive oil restaurant photo"
P["file-lososa-z-zara"]="Grilled salmon fillet asparagus lemon restaurant photo"
P["file-brancina"]="Grilled sea bass fillet vegetables restaurant photo"
P["ocvrti-lignji-s-tartarsko-omako"]="Fried squid tartar sauce lemon restaurant photo"
P["hrenovke-na-zaru"]="Grilled frankfurter sausages mustard restaurant photo"
P["klobase-na-zaru"]="Grilled sausages sauerkraut mustard restaurant photo"
P["piscancji-file-na-zaru"]="Grilled chicken breast herbs lemon restaurant photo"
P["pikantne-klobase"]="Spicy grilled sausages peppers onions restaurant photo"
P["zar-deska-za-dve"]="Grilled meat platter two mixed meats restaurant photo"
P["rizota-s-tartufi"]="Truffle risotto black truffle shavings restaurant photo"
P["rizota-s-sparglji"]="Asparagus risotto parmesan lemon restaurant photo"
P["rizota-z-buckami-in-feto"]="Zucchini feta risotto fresh herbs restaurant photo"
P["francoski-toast"]="French toast maple syrup berries restaurant photo"
P["jajcni-benedikt"]="Eggs Benedict hollandaise ham English muffin restaurant photo"
P["granola-z-jogurtom"]="Granola yogurt fresh berries breakfast restaurant photo"
P["kava-in-krof"]="Coffee Slovenian doughnut breakfast restaurant photo"
P["piscancji-nugeti-s-pomfri"]="Chicken nuggets french fries kids meal restaurant photo"
P["mini-burger-s-pomfri"]="Mini burger french fries kids meal restaurant photo"
P["sladoled-za-otroke"]="Kids ice cream sprinkles waffle cone restaurant photo"
P["club-sendvic-s-piscancem"]="Club sandwich chicken bacon lettuce restaurant photo"
P["krvavica-s-kislim-zeljem"]="Blood sausage sauerkraut Slovenian restaurant photo"
P["idrijski-zlikrofi"]="Idrija zlikrofi Slovenian dumplings restaurant photo"
P["prekmurska-gibanica"]="Prekmurska gibanica layered cake poppy seeds restaurant photo"
P["kmecki-kroznik"]="Slovenian farmers plate mixed meats restaurant photo"
P["obara-z-ajdovo-kaso"]="Slovenian stew buckwheat porridge restaurant photo"
P["domace-pecenice-s-kislim-zeljem"]="Homemade sausages sauerkraut Slovenian restaurant photo"
P["potica"]="Slovenian potica walnut roll cake sliced restaurant photo"

COUNT=0
FAIL=0
TOTAL=${#P[@]}

for slug in "${!P[@]}"; do
  if [ -f "./public/menu-images/${slug}.png" ]; then
    echo "SKIP $slug (exists)"
    continue
  fi
  
  COUNT=$((COUNT + 1))
  echo "[$COUNT] Generating: $slug"
  
  if z-ai-generate -p "${P[$slug]}, top-down view, warm lighting, clean background" -o "./public/menu-images/${slug}.png" -s 1024x1024 2>/dev/null; then
    echo "  OK"
  else
    echo "  FAIL - will retry after delay"
    FAIL=$((FAIL + 1))
    sleep 30
    # Retry once
    if z-ai-generate -p "${P[$slug]}, top-down view, warm lighting, clean background" -o "./public/menu-images/${slug}.png" -s 1024x1024 2>/dev/null; then
      echo "  RETRY OK"
      FAIL=$((FAIL - 1))
    else
      echo "  RETRY FAIL"
    fi
  fi
  
  sleep 15
done

echo ""
echo "Done! Attempted: $COUNT, Failed: $FAIL"
