#!/bin/bash
# RestaurantOS - Professional AI Image Generator
# Replaces all placeholder images with unique AI-generated photos

cd /home/z/my-project

# Function to generate an image with retry
generate_image() {
  local output_path="$1"
  local prompt="$2"
  local size="${3:-864x1152}"
  
  if [ -f "$output_path" ]; then
    existing_size=$(stat -c%s "$output_path" 2>/dev/null || echo 0)
    if [ "$existing_size" -gt 20000 ]; then
      echo "SKIP (already professional): $output_path ($existing_size bytes)"
      return 0
    fi
  fi
  
  echo "Generating: $output_path"
  z-ai-generate -p "$prompt" -o "$output_path" -s "$size" 2>/dev/null
  
  if [ $? -eq 0 ] && [ -f "$output_path" ]; then
    echo "  OK: $output_path"
  else
    echo "  RETRY: $output_path"
    sleep 2
    z-ai-generate -p "$prompt" -o "$output_path" -s "$size" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "  OK (retry): $output_path"
    else
      echo "  FAILED: $output_path"
    fi
  fi
  sleep 1
}

# ============ GLAVNE JEDI (Main dishes) ============
generate_image "public/menu-images/glavne-jedi/bbq-rebrca.png" "Professional food photography of BBQ baby back ribs with parmesan and roasted potatoes, BBQ sauce, dark slate plate, restaurant presentation, overhead shot, warm lighting, shallow depth of field" "1152x864"
generate_image "public/menu-images/glavne-jedi/beefsteak-poprova.png" "Professional food photography of beefsteak in green peppercorn sauce, roasted vegetables, baked potato, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/beefsteak-zar-rukoli.png" "Professional food photography of grilled beefsteak on bed of fresh arugula, roasted vegetables, baked potato, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/bograc.png" "Professional food photography of bograc stew in traditional cast iron kettle, hearty meat stew with paprika, served in rustic bowl, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/dunajski-zrezek.png" "Professional food photography of Wiener schnitzel (dunajski zrezek), golden breaded veal cutlet, lemon wedge, potato salad, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/hawaii-zrezek.png" "Professional food photography of Hawaiian steak with pineapple and melted cheese, vegetable side, creamy sauce, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/hisna-plosca.png" "Professional food photography of house platter for two, mixed grilled meats, pork Vienna schnitzel, turkey Paris schnitzel, grilled turkey, mushroom sauce, french fries, potato croquettes, fried gnocchi, restaurant presentation, overhead shot" "1152x864"
generate_image "public/menu-images/glavne-jedi/hisni-zrezek.png" "Professional food photography of house steak with cream sauce, cheese, mushrooms and garlic, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/kmecka-plosca.png" "Professional food photography of farmhouse platter for two, roasted pork, stuffed veal breast, roasted ribs, salted potatoes, fried potatoes, gnocchi, vegetables, cheese struklji, rustic wooden board, restaurant presentation, overhead shot" "1152x864"
generate_image "public/menu-images/glavne-jedi/kmecka-zimska.png" "Professional food photography of winter farmhouse platter, roasted pork, grilled sausage, blood sausage, roasted ribs, turnips, sauerkraut, matevž, buckwheat žganci, salted potatoes, rustic wooden board, restaurant presentation, overhead shot" "1152x864"
generate_image "public/menu-images/glavne-jedi/kmecki-kroznik.png" "Professional food photography of farmhouse bowl, roasted pork, gnocchi, stuffed veal breast, roasted ribs, salted potatoes, vegetables, cheese struklji, white bowl, restaurant presentation, overhead shot" "1152x864"
generate_image "public/menu-images/glavne-jedi/kmecki-zimski.png" "Professional food photography of winter farmhouse bowl, roasted pork, grilled sausage, blood sausage, roasted ribs, turnips, sauerkraut, buckwheat žganci, salted potatoes, white bowl, restaurant presentation, overhead shot" "1152x864"
generate_image "public/menu-images/glavne-jedi/kraski-beefsteak.png" "Professional food photography of Karst beefsteak with prosciutto and cheese, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/kraski-zrezek.png" "Professional food photography of Karst schnitzel with prosciutto, cheese and garlic, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/krvavica.png" "Professional food photography of blood sausage (krvavica) with sauerkraut or turnips, matevž, salted potatoes, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/ljubljanski-zrezek.png" "Professional food photography of Ljubljana schnitzel stuffed with ham and cheese, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/naravni-zrezek.png" "Professional food photography of natural steak with vegetable side, white plate, restaurant presentation, overhead shot, warm lighting, natural meat juices" "1152x864"
generate_image "public/menu-images/glavne-jedi/ocvrt-pisanec.png" "Professional food photography of whole roasted fried chicken, golden crispy skin, 12 pieces on wooden board, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/pariski-zrezek.png" "Professional food photography of Paris schnitzel, thin breaded and fried meat, lemon wedge, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/pecena-svinjska-kraca.png" "Professional food photography of roasted pork knuckle (svinjska krača), french fries, ajvar, mustard, onion rings, horseradish, dark plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/pecenica.png" "Professional food photography of grilled sausage (pečenica) with sauerkraut or turnips, matevž, salted potatoes, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/pohancki.png" "Professional food photography of breaded pork/turkey/chicken cutlets (pohančki), golden crispy, french fries, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/polnjena-telecja-prsa.png" "Professional food photography of stuffed veal breast, vegetable side, salted potatoes, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/rostbeef.png" "Professional food photography of roastbeef, sliced rare beef, baked potatoes and vegetables, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/rumpsteak.png" "Professional food photography of rumpsteak, grilled medium-rare, vegetable side, ajvar, mustard, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/sirov-zrezek.png" "Professional food photography of cheese steak with cheese sauce and cheese struklji, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/svinjska-pecenka.png" "Professional food photography of roasted pork loin (svinjska pečenka), vegetable side, salted potatoes, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/tagliata.png" "Professional food photography of tagliata on arugula, thinly sliced beef, baked potatoes, vegetables, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/telecja-pecenka.png" "Professional food photography of roasted veal loin (telečja pečenka), vegetable side, salted potatoes, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/zar-tris.png" "Professional food photography of grill trio, pork loin, chicken breast, roastbeef, baked potatoes, onion rings, sauce, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-curry.png" "Professional food photography of steak in curry sauce, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting, golden curry sauce" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-gobe.png" "Professional food photography of steak with mushrooms, mushroom sauce, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-gorgonzola.png" "Professional food photography of steak in gorgonzola sauce with mushrooms, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-pehtran.png" "Professional food photography of steak in tarragon cream sauce, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting, green tarragon" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-smetanova.png" "Professional food photography of steak in cream sauce, vegetable side, white plate, restaurant presentation, overhead shot, warm lighting, white creamy sauce" "1152x864"
generate_image "public/menu-images/glavne-jedi/zrezek-zar-rukoli.png" "Professional food photography of grilled steak on arugula, baked potatoes, onion rings, sauce, white plate, restaurant presentation, overhead shot, warm lighting" "1152x864"

echo "=== GLAVNE JEDI done ==="
