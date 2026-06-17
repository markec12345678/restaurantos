import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync, existsSync, statSync } from 'fs';

const MIN_SIZE = 20000; // Skip files larger than 20KB (already professional)
const BASE_DELAY = 3000;
const MAX_RETRIES = 5;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gen(zai, prompt, path, size = '1152x864') {
  if (existsSync(path)) {
    const sz = statSync(path).size;
    if (sz > MIN_SIZE) { console.log(`SKIP: ${path} (${(sz/1024).toFixed(0)}KB)`); return true; }
  }
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const r = await zai.images.generations.create({ prompt, size });
      const buf = Buffer.from(r.data[0].base64, 'base64');
      writeFileSync(path, buf);
      console.log(`OK: ${path} (${(buf.length/1024).toFixed(0)}KB)`);
      await sleep(BASE_DELAY);
      return true;
    } catch(e) {
      if (e.message?.includes('429')) {
        const w = Math.min(i * 60000, 300000);
        console.log(`RATELIMIT ${i}/${MAX_RETRIES}: wait ${w/1000}s - ${path}`);
        await sleep(w);
      } else {
        console.error(`ERR ${i}: ${e.message?.slice(0,100)}`);
        if (i < MAX_RETRIES) await sleep(5000);
      }
    }
  }
  console.error(`FAIL: ${path}`);
  return false;
}

const L = '1152x864', P = '864x1152';

const items = [
  // GLAVNE JEDI
  ['glavne-jedi/bbq-rebrca','BBQ baby back ribs with parmesan roasted potatoes BBQ sauce dark slate plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/beefsteak-poprova','Beefsteak in green peppercorn sauce with roasted vegetables and baked potato white plate professional food photography restaurant',L],
  ['glavne-jedi/beefsteak-zar-rukoli','Grilled beefsteak on fresh arugula bed with roasted vegetables baked potato white plate professional food photography restaurant',L],
  ['glavne-jedi/bograc','Bograc stew in traditional cast iron kettle with paprika red sauce meat professional food photography restaurant warm lighting',L],
  ['glavne-jedi/dunajski-zrezek','Wiener schnitzel golden breaded veal cutlet with lemon wedge potato salad white plate professional food photography restaurant',L],
  ['glavne-jedi/hawaii-zrezek','Hawaiian steak with grilled pineapple ring melted cheese creamy sauce vegetables white plate professional food photography restaurant',L],
  ['glavne-jedi/hisna-plosca','House platter for two mixed grilled meats schnitzel fries potato croquettes rustic wooden board professional food photography restaurant',L],
  ['glavne-jedi/hisni-zrezek','House steak with cream sauce cheese mushrooms garlic vegetable side white plate professional food photography restaurant',L],
  ['glavne-jedi/kmecka-plosca','Farmhouse platter for two roasted pork stuffed veal ribs potatoes gnocchi vegetables cheese struklji rustic board professional food photography',L],
  ['glavne-jedi/kmecka-zimska','Winter farmhouse platter roasted pork sausage blood sausage ribs sauerkraut turnips buckwheat rustic board professional food photography',L],
  ['glavne-jedi/kmecki-kroznik','Farmhouse bowl roasted pork gnocchi stuffed veal ribs potatoes vegetables cheese struklji white bowl professional food photography restaurant',L],
  ['glavne-jedi/kmecki-zimski','Winter farmhouse bowl roasted pork sausage blood sausage ribs sauerkraut turnips buckwheat white bowl professional food photography restaurant',L],
  ['glavne-jedi/kraski-beefsteak','Karst beefsteak with prosciutto ham and melted cheese vegetable side white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/kraski-zrezek','Karst schnitzel stuffed with prosciutto cheese garlic vegetable side white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/krvavica','Blood sausage krvavica with sauerkraut matevž mashed beans salted potatoes white plate professional food photography restaurant',L],
  ['glavne-jedi/ljubljanski-zrezek','Ljubljana schnitzel stuffed with ham and cheese breaded fried vegetable side white plate professional food photography restaurant',L],
  ['glavne-jedi/naravni-zrezek','Natural steak with vegetable side natural meat juices white plate professional food photography restaurant warm lighting medium rare',L],
  ['glavne-jedi/ocvrt-pisanec','Whole roasted fried chicken golden crispy skin carved pieces wooden board professional food photography restaurant warm lighting',L],
  ['glavne-jedi/pariski-zrezek','Paris schnitzel thin breaded fried meat with lemon wedge vegetable side white plate professional food photography restaurant',L],
  ['glavne-jedi/pecena-svinjska-kraca','Roasted pork knuckle with french fries ajvar mustard onion rings horseradish dark plate professional food photography restaurant',L],
  ['glavne-jedi/pecenica','Grilled sausage pecenica with sauerkraut matevž salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/pohancki','Breaded cutlets pohanki golden crispy with french fries white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/polnjena-telecja-prsa','Stuffed veal breast with vegetables and salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/rostbeef','Roastbeef sliced rare beef with baked potatoes and vegetables white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/rumpsteak','Rumpsteak grilled medium-rare with vegetable side ajvar mustard white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/sirov-zrezek','Cheese steak with cheese sauce and cheese struklji vegetable side white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/svinjska-pecenka','Roasted pork loin with vegetable side and salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/tagliata','Tagliata thinly sliced beef on arugula with baked potatoes vegetables white plate professional food photography restaurant',L],
  ['glavne-jedi/telecja-pecenka','Roasted veal loin with vegetable side and salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/zar-tris','Grill trio pork chicken and roastbeef with baked potatoes onion rings sauce white plate professional food photography restaurant',L],
  ['glavne-jedi/zrezek-curry','Steak in golden curry sauce with vegetable side white plate professional food photography restaurant warm lighting Indian spices',L],
  ['glavne-jedi/zrezek-gobe','Steak with mushrooms and mushroom sauce vegetable side white plate professional food photography restaurant warm lighting forest',L],
  ['glavne-jedi/zrezek-gorgonzola','Steak in blue gorgonzola sauce with mushrooms vegetable side white plate professional food photography restaurant warm lighting',L],
  ['glavne-jedi/zrezek-pehtran','Steak in green tarragon cream sauce with fresh tarragon vegetable side white plate professional food photography restaurant',L],
  ['glavne-jedi/zrezek-smetanova','Steak in white cream sauce with vegetable side white plate professional food photography restaurant warm lighting elegant',L],
  ['glavne-jedi/zrezek-zar-rukoli','Grilled steak on arugula with baked potatoes onion rings sauce white plate professional food photography restaurant warm lighting',L],
  // HLAĐNE PREDJEDI
  ['hladne-predjedi/prsut-olive','Karst prosciutto ham slices with green and black olives wooden board professional food photography restaurant warm lighting',L],
  ['hladne-predjedi/sirova-plosca','Cheese platter with various artisan cheeses grapes nuts crackers wooden board professional food photography restaurant warm lighting',L],
  // TOPLE PREDJEDI
  ['tople-predjedi/ocvrti-sampinjoni','Fried mushrooms with golden breading and tartar sauce white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/ocvrti-sir','Fried cheese with golden breading and tartar sauce white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/sampinjoni-gorgonzolna-omaka','Mushrooms in creamy blue gorgonzola sauce white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/sampinjoni-zar-gorgonzola','Grilled mushrooms with melted gorgonzola cheese on top white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/sampinjoni-zar-trzaska','Grilled mushrooms with Trieste sauce garlic and herbs white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/sirovi-struklji','Cheese struklji 3 pieces steamed dumplings with cheese filling white plate professional food photography restaurant warm lighting',L],
  ['tople-predjedi/slanina-rukola','Pan-fried crispy bacon strips on fresh arugula white plate professional food photography restaurant warm lighting',L],
  // JUHE
  ['juhe/goveja-klasicna','Traditional beef soup with vegetables in white bowl professional food photography restaurant warm lighting steaming',P],
  ['juhe/kremna-gobova','Creamy mushroom soup with mushroom pieces and cream drizzle in white bowl professional food photography restaurant warm lighting',P],
  ['juhe/kremna-zelenjavna','Creamy vegetable soup with colorful vegetables in white bowl professional food photography restaurant warm lighting steaming',P],
  // KALAMARI
  ['kalamari/mesani','Mixed calamari platter for three people fried grilled stuffed with tartar sauce professional food photography restaurant',L],
  ['kalamari/mornarsko','Calamari sailor-style with tomato sauce and tartar sauce white plate professional food photography restaurant warm lighting',L],
  ['kalamari/na-zaru','Grilled calamari with salted potatoes and blitva Swiss chard white plate professional food photography restaurant',L],
  ['kalamari/ocvrti','Fried calamari rings with golden breading and tartar sauce white plate professional food photography restaurant warm lighting',L],
  ['kalamari/polnjeni-dunajsko','Stuffed calamari Viennese-style with cheese and prosciutto breaded tartar sauce white plate professional food photography restaurant',L],
  ['kalamari/polnjeni-zar','Grilled stuffed calamari with cheese and prosciutto salted potatoes blitva white plate professional food photography restaurant',L],
  ['kalamari/zar-rukoli','Grilled calamari on arugula with parmesan shavings white plate professional food photography restaurant warm lighting',L],
  // RIBJE JEDI
  ['ribje-jedi/file-brancina','Grilled sea bass fillet with vegetables and salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/file-orade','Sea bream fillet with Trieste sauce vegetables salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/file-postrvi','Trout fillet with vegetables and salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/gamberi-parisko','Prawns Parisian-style with tartar sauce white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/losos','Grilled salmon fillet with Trieste sauce vegetables salted potatoes white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/ocvrt-oslic','Fried hake with tartar sauce and french fries white plate professional food photography restaurant warm lighting',L],
  ['ribje-jedi/ribja-plosca','Fish platter for two with mixed seafood sea bass bream calamari prawns vegetables white plate professional food photography restaurant',L],
  // SOLATE
  ['solate/cezarjeva','Caesar salad with fried chicken mozzarella parmesan croutons white bowl professional food photography restaurant',L],
  ['solate/fizolova','Bean salad with onion and parsley white plate professional food photography restaurant warm lighting',L],
  ['solate/grska','Greek salad with tomatoes cucumbers peppers feta cheese olives white plate professional food photography restaurant',L],
  ['solate/koruzna','Corn salad with sweet corn kernels white plate professional food photography restaurant warm lighting',L],
  ['solate/kraljica','Queen salad double mixed salad with cheese tartar sauce white plate professional food photography restaurant',L],
  ['solate/kraljica-jajca','Queen salad with boiled eggs cheese tartar sauce white plate professional food photography restaurant',L],
  ['solate/kraljica-puran','Queen salad with turkey breast cheese tartar sauce white plate professional food photography restaurant',L],
  ['solate/kraljica-sunka','Queen salad with ham cheese tartar sauce white plate professional food photography restaurant',L],
  ['solate/kraljica-tuna','Queen salad with tuna cheese tartar sauce white plate professional food photography restaurant',L],
  ['solate/kroznik-feta','Salad bowl with feta cheese pine nuts tomatoes cucumbers white bowl professional food photography restaurant',L],
  ['solate/kroznik-puran','Salad bowl with turkey pine nuts radish carrots white bowl professional food photography restaurant',L],
  ['solate/kroznik-slanina','Salad bowl with crispy bacon pine nuts egg white bowl professional food photography restaurant',L],
  ['solate/kroznik-tuna','Salad bowl with tuna pine nuts egg white bowl professional food photography restaurant',L],
  ['solate/kumare','Cucumber salad with sliced cucumbers and dill white plate professional food photography restaurant',L],
  ['solate/mesana-tuna','Mixed salad with tuna and tartar sauce white plate professional food photography restaurant',L],
  ['solate/motovilec','Lamb lettuce salad with olive oil white plate professional food photography restaurant',L],
  ['solate/paradiznikova','Tomato salad with sliced tomatoes and basil white plate professional food photography restaurant',L],
  ['solate/pecena-paprika','Roasted pepper salad with garlic and olive oil white plate professional food photography restaurant',L],
  ['solate/rukola','Arugula salad with olive oil white plate professional food photography restaurant',L],
  ['solate/rukola-parmezan','Arugula with parmesan shavings white plate professional food photography restaurant',L],
  ['solate/zelena','Green lettuce salad with vinaigrette white plate professional food photography restaurant',L],
  ['solate/zeljnata','Cabbage salad with shredded cabbage white plate professional food photography restaurant',L],
  // PIZZE
  ['pizze/4-siri','Four cheese pizza with melted mozzarella gorgonzola parmesan and fontina professional food photography restaurant overhead shot',L],
  ['pizze/hisna','House pizza with ham salami sausage mushrooms olives professional food photography restaurant overhead shot',L],
  ['pizze/kebab','Kebab pizza with sliced meat onion lettuce garlic sauce professional food photography restaurant overhead shot',L],
  ['pizze/kmecka','Farmhouse pizza with ham mushrooms horseradish sour cream professional food photography restaurant overhead shot',L],
  ['pizze/kraljica','Queen pizza with ham and mushrooms professional food photography restaurant overhead shot',L],
  ['pizze/kraska','Karst pizza with prosciutto and mushrooms professional food photography restaurant overhead shot',L],
  ['pizze/lovska','Hunter pizza with game meat and mushrooms professional food photography restaurant overhead shot',L],
  ['pizze/margerita','Margherita pizza with fresh mozzarella tomatoes basil professional food photography restaurant overhead shot',L],
  ['pizze/mehiska','Mexican pizza with spicy salami jalapenos corn professional food photography restaurant overhead shot',L],
  ['pizze/melancani','Eggplant pizza with grilled eggplant and mozzarella professional food photography restaurant overhead shot',L],
  ['pizze/morska','Seafood pizza with shrimp calamari and tomato sauce professional food photography restaurant overhead shot',L],
  ['pizze/mortadela','Mortadella pizza with sliced mortadella and pistachio professional food photography restaurant overhead shot',L],
  ['pizze/napoli','Napoli pizza with tomato sauce and oregano professional food photography restaurant overhead shot',L],
  ['pizze/pikant','Spicy pizza with hot salami and jalapeno peppers professional food photography restaurant overhead shot',L],
  ['pizze/ribiska','Fish pizza with tuna anchovies and capers professional food photography restaurant overhead shot',L],
  ['pizze/romana','Roman pizza with prosciutto arugula and parmesan professional food photography restaurant overhead shot',L],
  ['pizze/s-slanino','Pizza with crispy bacon strips professional food photography restaurant overhead shot',L],
  ['pizze/s-tuno','Pizza with tuna and red onion professional food photography restaurant overhead shot',L],
  ['pizze/sampinjoni','Mushroom pizza with fresh mushrooms professional food photography restaurant overhead shot',L],
  ['pizze/studentska','Student pizza with ham salami mushrooms corn professional food photography restaurant overhead shot',L],
  ['pizze/suha-salama','Pizza with dry aged salami slices professional food photography restaurant overhead shot',L],
  ['pizze/svezja-zelenjava','Pizza with fresh vegetables peppers tomatoes zucchini professional food photography restaurant overhead shot',L],
  ['pizze/vegetarijanska','Vegetarian pizza with colorful vegetables professional food photography restaurant overhead shot',L],
  ['pizze/z-gamberi','Pizza with prawns and cherry tomatoes professional food photography restaurant overhead shot',L],
  ['pizze/z-rukolo','Pizza with fresh arugula and prosciutto professional food photography restaurant overhead shot',L],
  // TESTENINE NJOKI
  ['testenine-njoki/carbonara','Spaghetti carbonara with crispy prosciutto cream sauce egg white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/gamberi','Pasta with prawns in tomato sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/gobe','Pasta with mixed wild mushrooms white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/gorgonzola','Pasta in blue gorgonzola cream sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/milanese','Milanese pasta with green peas and ham white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/morski-sadezi','Pasta with seafood in tomato sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/morski-smetanova','Pasta with seafood in cream sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/napoli','Pasta with tomato sauce and basil white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/padthai-piscanec','Pad Thai with chicken bean sprouts peanuts lime rice noodles white plate professional food photography restaurant',L],
  ['testenine-njoki/padthai-zelenjava','Vegetable Pad Thai with bean sprouts peanuts lime rice noodles white plate professional food photography restaurant',L],
  ['testenine-njoki/piscanec','Pasta with chicken mozzarella cherry tomatoes white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/pljucna-pecenka','Pasta with roast beef and vegetables white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/puran-curry','Pasta with turkey in yellow curry cream sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/puran-smetanova','Pasta with turkey in cream sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/sicilijana','Sicilian pasta with cherry tomatoes eggplant mozzarella white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/smetanova','Pasta in white cream sauce white plate professional food photography restaurant warm lighting',L],
  ['testenine-njoki/tartufi','Pasta with black truffles in cream sauce white plate professional food photography restaurant warm lighting',L],
  // RIZOTE
  ['rizote/gamberi-gobe','Risotto with prawns and mushrooms white plate professional food photography restaurant warm lighting',L],
  ['rizote/gobe','Mushroom risotto with wild mushrooms white plate professional food photography restaurant warm lighting',L],
  ['rizote/morska','Seafood risotto with shrimp and mussels white plate professional food photography restaurant warm lighting',L],
  ['rizote/puran-paprika','Risotto with turkey and red pepper white plate professional food photography restaurant warm lighting',L],
  ['rizote/zelenjavna','Vegetable risotto with colorful vegetables white plate professional food photography restaurant warm lighting',L],
  // SLADICE
  ['sladice/cokoladna-torta','Chocolate cake slice with ganache and berries white plate professional food photography restaurant warm lighting',P],
  ['sladice/cokoladni-lava-cake','Chocolate lava cake with liquid center and vanilla ice cream white plate professional food photography restaurant warm lighting',P],
  ['sladice/creme-brulee','Creme brulee with caramelized sugar top in white ramekin professional food photography restaurant warm lighting',P],
  ['sladice/panna-cotta','Panna cotta with red berry coulis in glass professional food photography restaurant warm lighting',P],
  ['sladice/struklji-sladki','Sweet struklji dumplings with walnut filling white plate professional food photography restaurant warm lighting',P],
  ['sladice/tiramisu','Tiramisu with cocoa dust and mascarpone in glass professional food photography restaurant warm lighting',P],
  // VODE
  ['vode/mineralna-voda-025','Small glass bottle of sparkling mineral water 0.25L with condensation on white table professional food photography restaurant',P],
  ['vode/naravna-voda-050','Bottle of still natural water 0.5L on white table professional food photography restaurant',P],
  // LIKERSKO VINO
  ['likersko-vino/keros-belo-005','Small glass of sweet white dessert wine 0.05L on white table professional food photography restaurant',P],
  ['likersko-vino/keros-belo-050','Bottle of sweet white dessert wine 0.5L with glass on white table professional food photography restaurant',P],
  ['likersko-vino/keros-rdece-005','Small glass of sweet red dessert wine 0.05L on white table professional food photography restaurant',P],
  ['likersko-vino/keros-rdece-050','Bottle of sweet red dessert wine 0.5L with glass on white table professional food photography restaurant',P],
  ['likersko-vino/sladki-refosk-050','Bottle of sweet refosk dessert wine 0.5L with glass on white table professional food photography restaurant',P],
  ['likersko-vino/sladki-refosk-kozarec','Glass of sweet refosk dessert wine dark red on white table professional food photography restaurant',P],
  // OMAKE
  ['omake/bbq-omaka','BBQ sauce in small white bowl professional food photography restaurant warm lighting',P],
  ['omake/cesnova-omaka','Garlic sauce in small white bowl professional food photography restaurant warm lighting',P],
  // PRILOGE
  ['priloge/pecen-krompir','Baked potatoes with rosemary and salt white plate professional food photography restaurant warm lighting',L],
  ['priloge/pomfri','French fries golden crispy in paper cone white plate professional food photography restaurant warm lighting',L],
  // OTROSKE JEDI
  ['otroske-jedi/otroški-burger','Kids burger with small fries and ketchup colorful plate professional food photography restaurant warm lighting',L],
  ['otroske-jedi/otroški-cevapcici','Kids cevapcici meat fingers with fries colorful plate professional food photography restaurant warm lighting',L],
  // MALICE
  ['malice/dnevna-malica','Daily lunch special plate with meat potatoes vegetables salad white plate professional food photography restaurant warm lighting',L],
  // ROSE VINO
  ['rose-vino/rose-verstovsek-steklenica','Bottle of pink rose wine Verstovsek with glass on white table professional food photography restaurant warm lighting',P],
  // BURGERJI
  ['burgerji/big-smash','Big smash burger with double patty melted cheese pickles in brioche bun professional food photography restaurant warm lighting',L],
];

async function main() {
  const zai = await ZAI.create();
  let ok = 0, fail = 0, skip = 0;
  for (let i = 0; i < items.length; i++) {
    const [relPath, prompt, size] = items[i];
    const fullPath = `public/menu-images/${relPath}.png`;
    // Check if already professional
    if (existsSync(fullPath) && statSync(fullPath).size > MIN_SIZE) {
      console.log(`[${i+1}/${items.length}] SKIP: ${relPath}`);
      skip++;
      continue;
    }
    console.log(`[${i+1}/${items.length}] GEN: ${relPath}`);
    const success = await gen(zai, `Professional food photography of ${prompt} overhead shot high quality`, fullPath, size);
    if (success) ok++; else fail++;
  }
  console.log(`\nDone! OK:${ok} FAIL:${fail} SKIP:${skip}`);
}
main();
