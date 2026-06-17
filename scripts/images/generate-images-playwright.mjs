import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const MIN_SIZE = 20000;
const WIDTH = 600;
const HEIGHT = 600;

const categoryColors = {
  'glavne-jedi': { bg: '#8B0000', accent: '#FFD700', icon: '🥩' },
  'hladne-predjedi': { bg: '#2E7D32', accent: '#C8E6C9', icon: '🥗' },
  'tople-predjedi': { bg: '#E65100', accent: '#FFE0B2', icon: '🍲' },
  'juhe': { bg: '#4A148C', accent: '#E1BEE7', icon: '🥣' },
  'kalamari': { bg: '#1A237E', accent: '#C5CAE9', icon: '🦑' },
  'ribje-jedi': { bg: '#006064', accent: '#B2EBF2', icon: '🐟' },
  'solate': { bg: '#1B5E20', accent: '#A5D6A7', icon: '🥬' },
  'pizze': { bg: '#BF360C', accent: '#FFCCBC', icon: '🍕' },
  'testenine-njoki': { bg: '#F57F17', accent: '#FFF9C4', icon: '🍝' },
  'rizote': { bg: '#558B2F', accent: '#DCEDC8', icon: '🍚' },
  'sladice': { bg: '#880E4F', accent: '#F8BBD0', icon: '🍰' },
  'vode': { bg: '#01579B', accent: '#B3E5FC', icon: '💧' },
  'likersko-vino': { bg: '#4A148C', accent: '#E1BEE7', icon: '🍷' },
  'omake': { bg: '#B71C1C', accent: '#FFCDD2', icon: '🫙' },
  'priloge': { bg: '#795548', accent: '#D7CCC8', icon: '🍟' },
  'otroske-jedi': { bg: '#6A1B9A', accent: '#E1BEE7', icon: '🧒' },
  'malice': { bg: '#004D40', accent: '#B2DFDB', icon: '📋' },
  'rose-vino': { bg: '#AD1457', accent: '#F8BBD0', icon: '🌸' },
  'burgerji': { bg: '#D84315', accent: '#FFCCBC', icon: '🍔' },
  'hrana': { bg: '#8B0000', accent: '#FFD700', icon: '🍽️' },
};

// Menu item data: [relativePath, displayName, description]
const menuItems = [
  // GLAVNE JEDI
  ['glavne-jedi/bbq-rebrca', 'BBQ Rebrca', 'Konfitirana svinjska rebra, parmezan, pečen krompir'],
  ['glavne-jedi/beefsteak-poprova', 'Beefsteak Poprova', 'Goveji zrezek v poprovi omaki, zelenjava, pečen krompir'],
  ['glavne-jedi/beefsteak-zar-rukoli', 'Beefsteak na Rukoli', 'Žar goveji zrezek na rukoli, zelenjava, krompir'],
  ['glavne-jedi/bograc', 'Bograč', 'Bograč v kotličku, tradicionalna madžarska enolončnica'],
  ['glavne-jedi/dunajski-zrezek', 'Dunajski Zrezek', 'Zlato paniran telečji zrezek, limona, krompirjeva solata'],
  ['glavne-jedi/hawaii-zrezek', 'Hawaii Zrezek', 'Zrezek z ananasom in sirom, smetanova omaka'],
  ['glavne-jedi/hisna-plosca', 'Hišna Plošča', 'Za 2 osebi: mešano meso, omake, priloge'],
  ['glavne-jedi/hisni-zrezek', 'Hišni Zrezek', 'Smetanova omaka, sir, šampinjoni, česen'],
  ['glavne-jedi/kmecka-plosca', 'Kmečka Plošča', 'Za 2 osebi: pečenka, telečja prsa, rebra, njoki'],
  ['glavne-jedi/kmecka-zimska', 'Kmečka Plošča Zimska', 'Za 2: pečenica, krvavica, zelje, repa, žganci'],
  ['glavne-jedi/kmecki-kroznik', 'Kmečki Krožnik', 'Pečenka, njoki, telečja prsa, rebra, štrukelj'],
  ['glavne-jedi/kmecki-zimski', 'Kmečki Krožnik Zimski', 'Pečenica, krvavica, zelje, repa, žganci'],
  ['glavne-jedi/kraski-beefsteak', 'Kraški Beefsteak', 'Pršut, sir, zelenjavna priloga'],
  ['glavne-jedi/kraski-zrezek', 'Kraški Zrezek', 'Pršut, sir, česen, zelenjavna priloga'],
  ['glavne-jedi/krvavica', 'Krvavica', 'Zelje ali repa, matevž, slan krompir'],
  ['glavne-jedi/ljubljanski-zrezek', 'Ljubljanski Zrezek', 'Šunka, sir, zelenjavna priloga'],
  ['glavne-jedi/naravni-zrezek', 'Naravni Zrezek', 'Naravni mesni sok, zelenjavna priloga'],
  ['glavne-jedi/ocvrt-pisanec', 'Ocvrt Pišanec', 'Zlato ocvrta pisanec, 12 kosov'],
  ['glavne-jedi/pariski-zrezek', 'Pariški Zrezek', 'Tanko paniran zrezek, limona, zelenjava'],
  ['glavne-jedi/pecena-svinjska-kraca', 'Pečena Svinjska Krača', 'Pomfri, ajvar, gorčica, čebula, hren'],
  ['glavne-jedi/pecenica', 'Pečenica', 'Zelje ali repa, matevž, slan krompir'],
  ['glavne-jedi/pohancki', 'Pohančki', 'Zlato hrustljavi pohančki, pommes frites'],
  ['glavne-jedi/polnjena-telecja-prsa', 'Polnjena Telečja Prsa', 'Zelenjavna priloga, slan krompir'],
  ['glavne-jedi/rostbeef', 'Rostbeef', 'Pečen krompir in zelenjava, redko pečen'],
  ['glavne-jedi/rumpsteak', 'Rumpsteak', 'Zelenjava, ajvar, gorčica, čebula'],
  ['glavne-jedi/sirov-zrezek', 'Sir Zrezek', 'Sirova omaka, sirov štrukelj, zelenjava'],
  ['glavne-jedi/svinjska-pecenka', 'Svinjska Pečenka', 'Zelenjavna priloga, slan krompir'],
  ['glavne-jedi/tagliata', 'Tagliata na Rukoli', 'Tanko rezan goveji, pečen krompir, zelenjava'],
  ['glavne-jedi/telecja-pecenka', 'Telečja Pečenka', 'Zelenjavna priloga, slan krompir'],
  ['glavne-jedi/zar-tris', 'Žar Tris', 'Kare, piščanec, roastbeef, krompir, obročki'],
  ['glavne-jedi/zrezek-curry', 'Zrezek v Curry Omaki', 'Zlata curry omaka, zelenjavna priloga'],
  ['glavne-jedi/zrezek-gobe', 'Zrezek z Gobami', 'Gobova omaka, zelenjavna priloga'],
  ['glavne-jedi/zrezek-gorgonzola', 'Zrezek v Gorgonzoli', 'Gorgonzolna omaka, gobe, zelenjava'],
  ['glavne-jedi/zrezek-pehtran', 'Zrezek s Pehtranom', 'Smetanova omaka s pehtranom, zelenjava'],
  ['glavne-jedi/zrezek-smetanova', 'Zrezek v Smetanovi Omaki', 'Kremna smetanova omaka, zelenjava'],
  ['glavne-jedi/zrezek-zar-rukoli', 'Zrezek Žar na Rukoli', 'Pečen krompir, čebulni obročki, omaka'],
  // HLAĐNE PREDJEDI
  ['hladne-predjedi/prsut-olive', 'Pršut z Olivami', 'Kraški pršut z olivami, 300g'],
  ['hladne-predjedi/sirova-plosca', 'Sirova Plošča', 'Izbira domačih sirov, 300g'],
  // TOPLE PREDJEDI
  ['tople-predjedi/ocvrti-sampinjoni', 'Ocvrti Šampinjoni', 'Ocvrti šampinjoni s tatarsko omako'],
  ['tople-predjedi/ocvrti-sir', 'Ocvrti Sir', 'Ocvrti sir s tatarsko omako'],
  ['tople-predjedi/sampinjoni-gorgonzolna-omaka', 'Šampinjoni v Gorgonzolni', 'Šampinjoni v gorgonzolni omaki'],
  ['tople-predjedi/sampinjoni-zar-gorgonzola', 'Šampinjoni Žar Gorgonzola', 'Šampinjoni na žaru z gorgonzolo'],
  ['tople-predjedi/sampinjoni-zar-trzaska', 'Šampinjoni Žar Tržaška', 'Šampinjoni na žaru s tržaško omako'],
  ['tople-predjedi/sirovi-struklji', 'Sirovi Štruklji', 'Sirovi štruklji, 3 kosi'],
  ['tople-predjedi/slanina-rukola', 'Popečena Slanina na Rukoli', 'Hrustljava slanina na rukoli'],
  // JUHE
  ['juhe/goveja-klasicna', 'Goveja Juha', 'Tradicionalna goveja juha'],
  ['juhe/kremna-gobova', 'Kremna Gobova Juha', 'Dnevna kremna gobova juha'],
  ['juhe/kremna-zelenjavna', 'Kremna Zelenjavna Juha', 'Dnevna kremna zelenjavna juha'],
  // KALAMARI
  ['kalamari/mesani', 'Mešani Kalamari', 'Za 3 osebe: ocvrti, žar, polnjeni, repki'],
  ['kalamari/mornarsko', 'Kalamari po Mornarsko', 'Paradižnikova omaka, tatarska omaka'],
  ['kalamari/na-zaru', 'Kalamari na Žaru', 'Slan krompir z blitvo'],
  ['kalamari/ocvrti', 'Ocvrti Kalamari', 'Tatarska omaka, hrustljavi obročki'],
  ['kalamari/polnjeni-dunajsko', 'Polnjeni po Dunajsko', 'Sir in pršut, tatarska omaka'],
  ['kalamari/polnjeni-zar', 'Polnjeni na Žaru', 'Sir in pršut, slan krompir z blitvo'],
  ['kalamari/zar-rukoli', 'Kalamari Žar na Rukoli', 'Slan krompir z blitvo, parmezan'],
  // RIBJE JEDI
  ['ribje-jedi/file-brancina', 'File Brancina na Žaru', 'Tržaška omaka, zelenjava, krompir'],
  ['ribje-jedi/file-orade', 'File Orade', 'Tržaška omaka, zelenjava, krompir z blitvo'],
  ['ribje-jedi/file-postrvi', 'File Postrvi', 'Po tržaško, dunajsko ali v koruzni moki'],
  ['ribje-jedi/gamberi-parisko', 'Gamberi po Pariško', 'Tatarska omaka'],
  ['ribje-jedi/losos', 'Losos', 'Tržaška omaka, zelenjava, krompir z blitvo'],
  ['ribje-jedi/ocvrt-oslic', 'Ocvrt Oslič', 'Tatarska omaka, pommes frites'],
  ['ribje-jedi/ribja-plosca', 'Ribja Plošča', 'Za 2: brancin, orada, kalamari, gamberi'],
  // SOLATE
  ['solate/cezarjeva', 'Cezarjeva Solata', 'Ocvrt piščanec, mozzarela, parmezan, krotoni'],
  ['solate/fizolova', 'Fižolova Solata', 'Fižolova solata z čebulo'],
  ['solate/grska', 'Grška Solata', 'Paradižnik, kumare, paprika, feta, olive'],
  ['solate/koruzna', 'Koruzna Solata', 'Sladka koruza'],
  ['solate/kraljica', 'Solata Kraljica', 'Dvojna mešana, sir, tatarska omaka'],
  ['solate/kraljica-jajca', 'Kraljica z Jajci', 'Dvojna mešana, sir, tatarska, 2 jajci'],
  ['solate/kraljica-puran', 'Kraljica s Puranom', 'Dvojna mešana, sir, tatarska, puran'],
  ['solate/kraljica-sunka', 'Kraljica s Šunko', 'Dvojna mešana, sir, tatarska, šunka'],
  ['solate/kraljica-tuna', 'Kraljica s Tuno', 'Dvojna mešana, sir, tatarska, tuna'],
  ['solate/kroznik-feta', 'Krožnik s Feta Sirom', 'Solata, radič, koruza, kumare, feta, pinjole'],
  ['solate/kroznik-puran', 'Krožnik s Puranom', 'Solata, radič, jajce, pinjole, puran'],
  ['solate/kroznik-slanina', 'Krožnik s Slanino', 'Solata, radič, jajce, pinjole, slanina'],
  ['solate/kroznik-tuna', 'Krožnik s Tuno', 'Solata, radič, jajce, pinjole, tuna'],
  ['solate/kumare', 'Kumare', 'Kumare solata'],
  ['solate/mesana-tuna', 'Mešana s Tuno', 'Dvojna mešana solata, tuna, tatarska'],
  ['solate/motovilec', 'Motovilec', 'Motovilec solata'],
  ['solate/paradiznikova', 'Paradižnikova Solata', 'Paradižnikova solata z baziliko'],
  ['solate/pecena-paprika', 'Pečena Paprika', 'Pečena paprika s česnom in oljem'],
  ['solate/rukola', 'Rukola', 'Rukola solata'],
  ['solate/rukola-parmezan', 'Rukola s Parmezanom', 'Rukola, parmezan lističi'],
  ['solate/zelena', 'Zelena Solata', 'Zelena listnata solata'],
  ['solate/zeljnata', 'Zeljnata Solata', 'Zeljnata solata'],
  // PIZZE
  ['pizze/4-siri', '4 Sirova Pica', 'Mozzarella, gorgonzola, parmezan, fontina'],
  ['pizze/hisna', 'Hišna Pica', 'Pršut, šunka, salama, hrenovka, slanina, gobe'],
  ['pizze/kebab', 'Kebab Pica', 'Meso kebab, čebula, zelena solata, česnova omaka'],
  ['pizze/kmecka', 'Kmečka Pica', 'Domača šunka, gobe, hren s kislo smetano'],
  ['pizze/kraljica', 'Kraljica Pica', 'Kuhani pršut, gobe, origano'],
  ['pizze/kraska', 'Kraška Pica', 'Pršut, gobe, origano'],
  ['pizze/lovska', 'Lovska Pica', 'Divjačina, gobe, pikantne sestavine'],
  ['pizze/margerita', 'Margerita', 'Pelati, mozzarella, origano, oliva'],
  ['pizze/mehiska', 'Mehiška Pica', 'Pikantna salama, feferoni, koruza'],
  ['pizze/melancani', 'Melancani Pica', 'Pečen jajčevec, mozzarella'],
  ['pizze/morska', 'Morska Pica', 'Kozice, kalamari, paradižnikova omaka'],
  ['pizze/mortadela', 'Mortadela Pica', 'Mortadela, pistacija'],
  ['pizze/napoli', 'Napoli Pica', 'Paradižnikova omaka, origano'],
  ['pizze/pikant', 'Pikant Pica', 'Pikantna salama, feferoni, gobe'],
  ['pizze/ribiska', 'Ribjiška Pica', 'Tuna, inčuni, kapre'],
  ['pizze/romana', 'Romana Pica', 'Pršut, rukola, parmezan'],
  ['pizze/s-slanino', 'Pica s Slanino', 'Hrustljava slanina, mozzarella'],
  ['pizze/s-tuno', 'Pica s Tuno', 'Tuna, rdeča čebula, paradižnik'],
  ['pizze/sampinjoni', 'Šampinjoni Pica', 'Sveži šampinjoni, mozzarella'],
  ['pizze/studentska', 'Študentska Pica', 'Šunka, salama, gobe, koruza'],
  ['pizze/suha-salama', 'Suha Salama Pica', 'Suha goveja salama, mozzarella'],
  ['pizze/svezja-zelenjava', 'Sveža Zelenjava Pica', 'Paprika, paradižnik, bučke'],
  ['pizze/vegetarijanska', 'Vegetarijanska Pica', 'Mešana zelenjava, mozzarella'],
  ['pizze/z-gamberi', 'Pica z Gamberi', 'Gamberi, češnjev paradižnik'],
  ['pizze/z-rukolo', 'Pica z Rukolo', 'Rukola, pršut, parmezan'],
  // TESTENINE NJOKI
  ['testenine-njoki/carbonara', 'Carbonara', 'Smetanova omaka s pršutom'],
  ['testenine-njoki/gamberi', 'Z Gamberi', 'Gamberi, paradižnikova omaka'],
  ['testenine-njoki/gobe', 'Z Gobami', 'Mešane gobe, smetanova omaka'],
  ['testenine-njoki/gorgonzola', 'V Gorgonzoli', 'Gorgonzolna omaka'],
  ['testenine-njoki/milanese', 'Milanese', 'Paradižnikova omaka, grah, šunka'],
  ['testenine-njoki/morski-sadezi', 'Z Morskimi Sadeži', 'Paradižnikova omaka, morski sadeži'],
  ['testenine-njoki/morski-smetanova', 'Morski v Smetanovi', 'Smetanova omaka, morski sadeži'],
  ['testenine-njoki/napoli', 'Napoli', 'Paradižnikova omaka'],
  ['testenine-njoki/padthai-piscanec', 'Pad Thai Piščanec', 'Riževi rezanci, piščanec, arašidi, limeta'],
  ['testenine-njoki/padthai-zelenjava', 'Pad Thai Zelenjava', 'Riževi rezanci, bučke, korenje, arašidi'],
  ['testenine-njoki/piscanec', 'S Piščancem', 'Mocarela, češnjev paradižnik'],
  ['testenine-njoki/pljucna-pecenka', 'S Pljučno Pečenko', 'Pljučna pečenka, zelenjava'],
  ['testenine-njoki/puran-curry', 'Puran v Curry Omaki', 'Puran, curry, smetanova omaka'],
  ['testenine-njoki/puran-smetanova', 'Puran v Smetanovi', 'Puranje meso, smetanova omaka'],
  ['testenine-njoki/sicilijana', 'Sicilijana', 'Češnjev paradižnik, melancani, mocarela'],
  ['testenine-njoki/smetanova', 'V Smetanovi Omaki', 'Kremna smetanova omaka'],
  ['testenine-njoki/tartufi', 'S Tartufi', 'Smetanova omaka, tartufi'],
  // RIZOTE
  ['rizote/gamberi-gobe', 'Rižota z Gamberi in Gobami', 'Gamberi, mešane gobe'],
  ['rizote/gobe', 'Rižota z Gobami', 'Mešane gobe, parmezan'],
  ['rizote/morska', 'Morska Rižota', 'Morski sadeži, paradižnik'],
  ['rizote/puran-paprika', 'Rižota s Puranom', 'Puranje meso, paprika'],
  ['rizote/zelenjavna', 'Zelenjavna Rižota', 'Mešana zelenjava, parmezan'],
  // SLADICE
  ['sladice/cokoladna-torta', 'Čokoladna Torta', 'Bogata čokoladna torta z ganache'],
  ['sladice/cokoladni-lava-cake', 'Čokoladni Lava Cake', 'Z tekočim centrom, vaniljev sladoled'],
  ['sladice/creme-brulee', 'Crème Brûlée', 'S karameliziranim sladkorjem na vrhu'],
  ['sladice/panna-cotta', 'Panna Cotta', 'Z jagodičjevim prelivom'],
  ['sladice/struklji-sladki', 'Sladki Štruklji', 'Z orehovim nadevom'],
  ['sladice/tiramisu', 'Tiramisu', 'Z mascarpone kremo in kakavom'],
  // VODE
  ['vode/mineralna-voda-025', 'Mineralna Voda 0.25L', 'Mehurčkasta mineralna voda'],
  ['vode/naravna-voda-050', 'Naravna Voda 0.5L', 'Naravna mirna voda'],
  // LIKERSKO VINO
  ['likersko-vino/keros-belo-005', 'Keros Belo 0.05L', 'Sladko belo likersko vino'],
  ['likersko-vino/keros-belo-050', 'Keros Belo 0.5L', 'Steklenica sladkega belega vina'],
  ['likersko-vino/keros-rdece-005', 'Keros Rdeče 0.05L', 'Sladko rdeče likersko vino'],
  ['likersko-vino/keros-rdece-050', 'Keros Rdeče 0.5L', 'Steklenica sladkega rdečega vina'],
  ['likersko-vino/sladki-refosk-050', 'Sladki Refošk 0.5L', 'Steklenica sladkega refoška'],
  ['likersko-vino/sladki-refosk-kozarec', 'Sladki Refošk Kozarec', 'Kozarec sladkega refoška'],
  // OMAKE
  ['omake/bbq-omaka', 'BBQ Omaka', 'Dimljen BBQ preliv'],
  ['omake/cesnova-omaka', 'Česnova Omaka', 'Kremna česnova omaka'],
  // PRILOGE
  ['priloge/pecen-krompir', 'Pečen Krompir', 'Z rožmarinom in soljo'],
  ['priloge/pomfri', 'Pommes Frites', 'Zlati hrustljavi pomfri'],
  // OTROŠKE JEDI
  ['otroske-jedi/otroški-burger', 'Otroški Burger', 'Majhen burger s pomfrijem'],
  ['otroske-jedi/otroški-cevapcici', 'Otroški Čevapčiči', 'Majhni čevapčiči s pomfrijem'],
  // MALICE
  ['malice/dnevna-malica', 'Dnevna Malica', 'Dnevna malica z mesom, krompirjem, solato'],
  // ROSE VINO
  ['rose-vino/rose-verstovsek-steklenica', 'Rose Verstovšek', 'Steklenica rožnatega vina Verstovšek'],
  // BURGERJI
  ['burgerji/big-smash', 'Big Smash Burger', 'Dvojni burger, sir, kisli kumeljci, brioche žemlja'],
];

function getCategory(path) {
  return path.split('/')[0];
}

function generateHTML(item, colors) {
  const [relPath, name, desc] = item;
  const cat = getCategory(relPath);
  const c = colors[cat] || colors['hrana'];
  
  return `<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    width: ${WIDTH}px; 
    height: ${HEIGHT}px; 
    font-family: 'Inter', sans-serif;
    overflow: hidden;
  }
  .card {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: linear-gradient(145deg, ${c.bg} 0%, ${c.bg}dd 40%, ${c.bg}aa 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -30%;
    width: 80%;
    height: 80%;
    background: radial-gradient(circle, ${c.accent}33 0%, transparent 70%);
    border-radius: 50%;
  }
  .card::after {
    content: '';
    position: absolute;
    bottom: -40%;
    left: -20%;
    width: 70%;
    height: 70%;
    background: radial-gradient(circle, ${c.accent}22 0%, transparent 70%);
    border-radius: 50%;
  }
  .icon {
    font-size: 100px;
    margin-bottom: 16px;
    z-index: 1;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
  }
  .name {
    font-size: 28px;
    font-weight: 800;
    color: #FFFFFF;
    text-align: center;
    padding: 0 30px;
    z-index: 1;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    line-height: 1.2;
    letter-spacing: -0.5px;
  }
  .desc {
    font-size: 14px;
    color: ${c.accent};
    text-align: center;
    padding: 8px 40px 0;
    z-index: 1;
    font-weight: 400;
    line-height: 1.4;
    max-width: 100%;
  }
  .badge {
    position: absolute;
    top: 20px;
    right: 20px;
    background: ${c.accent};
    color: ${c.bg};
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    z-index: 2;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .line {
    width: 60px;
    height: 3px;
    background: ${c.accent};
    margin: 12px 0;
    border-radius: 2px;
    z-index: 1;
  }
</style>
</head>
<body>
<div class="card">
  <div class="badge">${cat.replace('-', ' ')}</div>
  <div class="icon">${c.icon}</div>
  <div class="name">${name}</div>
  <div class="line"></div>
  <div class="desc">${desc}</div>
</div>
</body>
</html>`;
}

async function main() {
  console.log(`Generating ${menuItems.length} professional menu card images...`);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  
  let ok = 0, skip = 0;
  
  for (let i = 0; i < menuItems.length; i++) {
    const [relPath] = menuItems[i];
    const fullPath = join('public/menu-images', `${relPath}.png`);
    
    // Skip if already professional
    if (existsSync(fullPath) && statSync(fullPath).size > MIN_SIZE) {
      console.log(`[${i+1}/${menuItems.length}] SKIP: ${relPath}`);
      skip++;
      continue;
    }
    
    const cat = getCategory(relPath);
    const colors = categoryColors[cat] || categoryColors['hrana'];
    const html = generateHTML(menuItems[i], categoryColors);
    
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: fullPath, type: 'png' });
    
    const size = statSync(fullPath).size;
    console.log(`[${i+1}/${menuItems.length}] OK: ${relPath} (${(size/1024).toFixed(0)}KB)`);
    ok++;
  }
  
  await browser.close();
  console.log(`\nDone! Generated: ${ok}, Skipped: ${skip}`);
}

main().catch(console.error);
