#!/bin/bash
# Generate 54 missing menu images
# Run with: bash gen_missing_images.sh
set -e

mkdir -p "public/menu-images"
echo "Generating: Svinjska rebra z žara"
z-ai-generate -p "Professional food photography of Svinjska rebra z žara (Slovenian Glavne jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/svinjska-rebra-z-zara.png" -s 864x1152 2>/dev/null || echo "FAILED: Svinjska rebra z žara"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Medaljoni iz govedine"
z-ai-generate -p "Professional food photography of Medaljoni iz govedine (Slovenian Glavne jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/medaljoni-iz-govedine.png" -s 864x1152 2>/dev/null || echo "FAILED: Medaljoni iz govedine"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Piščančji file v parmezani"
z-ai-generate -p "Professional food photography of Piščančji file v parmezani (Slovenian Glavne jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/piscancji-file-v-parmezani.png" -s 864x1152 2>/dev/null || echo "FAILED: Piščančji file v parmezani"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Tagliatelle s tartufi"
z-ai-generate -p "Professional food photography of Tagliatelle s tartufi (Slovenian Testenine), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/tagliatelle-s-tartufi.png" -s 864x1152 2>/dev/null || echo "FAILED: Tagliatelle s tartufi"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Penne s piščancem in curryjem"
z-ai-generate -p "Professional food photography of Penne s piščancem in curryjem (Slovenian Testenine), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/penne-s-piscancem-in-curryjem.png" -s 864x1152 2>/dev/null || echo "FAILED: Penne s piščancem in curryjem"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Rezanci z gobami"
z-ai-generate -p "Professional food photography of Rezanci z gobami (Slovenian Testenine), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/rezanci-z-gobami.png" -s 864x1152 2>/dev/null || echo "FAILED: Rezanci z gobami"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Štirje siri"
z-ai-generate -p "Professional food photography of Štirje siri (Slovenian Pica), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/stirje-siri.png" -s 864x1152 2>/dev/null || echo "FAILED: Štirje siri"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Tunina pica"
z-ai-generate -p "Professional food photography of Tunina pica (Slovenian Pica), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/tunina-pica.png" -s 864x1152 2>/dev/null || echo "FAILED: Tunina pica"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Havajska pica"
z-ai-generate -p "Professional food photography of Havajska pica (Slovenian Pica), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/havajska-pica.png" -s 864x1152 2>/dev/null || echo "FAILED: Havajska pica"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Kmečka pica"
z-ai-generate -p "Professional food photography of Kmečka pica (Slovenian Pica), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/kmecka-pica.png" -s 864x1152 2>/dev/null || echo "FAILED: Kmečka pica"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: BBQ burger"
z-ai-generate -p "Professional food photography of BBQ burger (Slovenian Burgerji), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/bbq-burger.png" -s 864x1152 2>/dev/null || echo "FAILED: BBQ burger"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Chili burger"
z-ai-generate -p "Professional food photography of Chili burger (Slovenian Burgerji), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/chili-burger.png" -s 864x1152 2>/dev/null || echo "FAILED: Chili burger"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Burger z jajcem in slanino"
z-ai-generate -p "Professional food photography of Burger z jajcem in slanino (Slovenian Burgerji), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/burger-z-jajcem-in-slanino.png" -s 864x1152 2>/dev/null || echo "FAILED: Burger z jajcem in slanino"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Šopska solata"
z-ai-generate -p "Professional food photography of Šopska solata (Slovenian Solate), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/sopska-solata.png" -s 864x1152 2>/dev/null || echo "FAILED: Šopska solata"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Caprese solata"
z-ai-generate -p "Professional food photography of Caprese solata (Slovenian Solate), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/caprese-solata.png" -s 864x1152 2>/dev/null || echo "FAILED: Caprese solata"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Solata z grilanim sirom"
z-ai-generate -p "Professional food photography of Solata z grilanim sirom (Slovenian Solate), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/solata-z-grilanim-sirom.png" -s 864x1152 2>/dev/null || echo "FAILED: Solata z grilanim sirom"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Solata z avokadom in kozicami"
z-ai-generate -p "Professional food photography of Solata z avokadom in kozicami (Slovenian Solate), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/solata-z-avokadom-in-kozicami.png" -s 864x1152 2>/dev/null || echo "FAILED: Solata z avokadom in kozicami"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Cezarjeva solata s kozicami"
z-ai-generate -p "Professional food photography of Cezarjeva solata s kozicami (Slovenian Solate), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/cezarjeva-solata-s-kozicami.png" -s 864x1152 2>/dev/null || echo "FAILED: Cezarjeva solata s kozicami"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Krvavica s kislim zeljem"
z-ai-generate -p "Professional food photography of Krvavica s kislim zeljem (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/krvavica-s-kislim-zeljem.png" -s 864x1152 2>/dev/null || echo "FAILED: Krvavica s kislim zeljem"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Idrijski žlikrofi"
z-ai-generate -p "Professional food photography of Idrijski žlikrofi (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/idrijski-zlikrofi.png" -s 864x1152 2>/dev/null || echo "FAILED: Idrijski žlikrofi"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Prekmurska gibanica"
z-ai-generate -p "Professional food photography of Prekmurska gibanica (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/prekmurska-gibanica.png" -s 864x1152 2>/dev/null || echo "FAILED: Prekmurska gibanica"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Kmečki krožnik"
z-ai-generate -p "Professional food photography of Kmečki krožnik (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/kmecki-kroznik.png" -s 864x1152 2>/dev/null || echo "FAILED: Kmečki krožnik"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Obara z ajdovo kašo"
z-ai-generate -p "Professional food photography of Obara z ajdovo kašo (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/obara-z-ajdovo-kaso.png" -s 864x1152 2>/dev/null || echo "FAILED: Obara z ajdovo kašo"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Domače pečenice s kislim zeljem"
z-ai-generate -p "Professional food photography of Domače pečenice s kislim zeljem (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/domace-pecenice-s-kislim-zeljem.png" -s 864x1152 2>/dev/null || echo "FAILED: Domače pečenice s kislim zeljem"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Potica"
z-ai-generate -p "Professional food photography of Potica (Slovenian Slovenske Jedi), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/potica.png" -s 864x1152 2>/dev/null || echo "FAILED: Potica"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Krofi s pomarančno marmelado"
z-ai-generate -p "Professional food photography of Krofi s pomarančno marmelado (Slovenian Sladice), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/krofi-s-pomarancno-marmelado.png" -s 864x1152 2>/dev/null || echo "FAILED: Krofi s pomarančno marmelado"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Ledeni desert"
z-ai-generate -p "Professional food photography of Ledeni desert (Slovenian Sladice), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/ledeni-desert.png" -s 864x1152 2>/dev/null || echo "FAILED: Ledeni desert"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Domino kocke"
z-ai-generate -p "Professional food photography of Domino kocke (Slovenian Sladice), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/domino-kocke.png" -s 864x1152 2>/dev/null || echo "FAILED: Domino kocke"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Sladoled tri okuse"
z-ai-generate -p "Professional food photography of Sladoled tri okuse (Slovenian Sladice), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/sladoled-tri-okuse.png" -s 864x1152 2>/dev/null || echo "FAILED: Sladoled tri okuse"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Njoki"
z-ai-generate -p "Professional food photography of Njoki (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/njoki.png" -s 864x1152 2>/dev/null || echo "FAILED: Njoki"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Mlinci"
z-ai-generate -p "Professional food photography of Mlinci (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/mlinci.png" -s 864x1152 2>/dev/null || echo "FAILED: Mlinci"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Krompirjevi kroketi"
z-ai-generate -p "Professional food photography of Krompirjevi kroketi (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/krompirjevi-kroketi.png" -s 864x1152 2>/dev/null || echo "FAILED: Krompirjevi kroketi"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Ocvrtki"
z-ai-generate -p "Professional food photography of Ocvrtki (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/ocvrtki.png" -s 864x1152 2>/dev/null || echo "FAILED: Ocvrtki"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Ajdova kaša"
z-ai-generate -p "Professional food photography of Ajdova kaša (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/ajdova-kasa.png" -s 864x1152 2>/dev/null || echo "FAILED: Ajdova kaša"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Žar zelenjava"
z-ai-generate -p "Professional food photography of Žar zelenjava (Slovenian Priloge), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/zar-zelenjava.png" -s 864x1152 2>/dev/null || echo "FAILED: Žar zelenjava"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: File lososa z žara"
z-ai-generate -p "Professional food photography of File lososa z žara (Slovenian Morski Sadeži), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/file-lososa-z-zara.png" -s 864x1152 2>/dev/null || echo "FAILED: File lososa z žara"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: File brancina"
z-ai-generate -p "Professional food photography of File brancina (Slovenian Morski Sadeži), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/file-brancina.png" -s 864x1152 2>/dev/null || echo "FAILED: File brancina"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Ocvrti lignji s tartarsko omako"
z-ai-generate -p "Professional food photography of Ocvrti lignji s tartarsko omako (Slovenian Morski Sadeži), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/ocvrti-lignji-s-tartarsko-omako.png" -s 864x1152 2>/dev/null || echo "FAILED: Ocvrti lignji s tartarsko omako"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Hrenovke na žaru"
z-ai-generate -p "Professional food photography of Hrenovke na žaru (Slovenian Žara in Grill), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/hrenovke-na-zaru.png" -s 864x1152 2>/dev/null || echo "FAILED: Hrenovke na žaru"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Klobase na žaru"
z-ai-generate -p "Professional food photography of Klobase na žaru (Slovenian Žara in Grill), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/klobase-na-zaru.png" -s 864x1152 2>/dev/null || echo "FAILED: Klobase na žaru"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Piščančji file na žaru"
z-ai-generate -p "Professional food photography of Piščančji file na žaru (Slovenian Žara in Grill), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/piscancji-file-na-zaru.png" -s 864x1152 2>/dev/null || echo "FAILED: Piščančji file na žaru"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Pikantne klobase"
z-ai-generate -p "Professional food photography of Pikantne klobase (Slovenian Žara in Grill), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/pikantne-klobase.png" -s 864x1152 2>/dev/null || echo "FAILED: Pikantne klobase"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Žar deska za dve"
z-ai-generate -p "Professional food photography of Žar deska za dve (Slovenian Žara in Grill), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/zar-deska-za-dve.png" -s 864x1152 2>/dev/null || echo "FAILED: Žar deska za dve"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Rižota s tartufi"
z-ai-generate -p "Professional food photography of Rižota s tartufi (Slovenian Rižote), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/rizota-s-tartufi.png" -s 864x1152 2>/dev/null || echo "FAILED: Rižota s tartufi"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Rižota s šparglji"
z-ai-generate -p "Professional food photography of Rižota s šparglji (Slovenian Rižote), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/rizota-s-sparglji.png" -s 864x1152 2>/dev/null || echo "FAILED: Rižota s šparglji"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Rižota z bučkami in feto"
z-ai-generate -p "Professional food photography of Rižota z bučkami in feto (Slovenian Rižote), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/rizota-z-buckami-in-feto.png" -s 864x1152 2>/dev/null || echo "FAILED: Rižota z bučkami in feto"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Francoski toast"
z-ai-generate -p "Professional food photography of Francoski toast (Slovenian Zajtrk in Brunch), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/francoski-toast.png" -s 864x1152 2>/dev/null || echo "FAILED: Francoski toast"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Jajčni benedikt"
z-ai-generate -p "Professional food photography of Jajčni benedikt (Slovenian Zajtrk in Brunch), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/jajcni-benedikt.png" -s 864x1152 2>/dev/null || echo "FAILED: Jajčni benedikt"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Granola z jogurtom"
z-ai-generate -p "Professional food photography of Granola z jogurtom (Slovenian Zajtrk in Brunch), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/granola-z-jogurtom.png" -s 864x1152 2>/dev/null || echo "FAILED: Granola z jogurtom"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Kava in krof"
z-ai-generate -p "Professional food photography of Kava in krof (Slovenian Zajtrk in Brunch), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/kava-in-krof.png" -s 864x1152 2>/dev/null || echo "FAILED: Kava in krof"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Piščančji nugeti s pomfri"
z-ai-generate -p "Professional food photography of Piščančji nugeti s pomfri (Slovenian Dječji Meni), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/piscancji-nugeti-s-pomfri.png" -s 864x1152 2>/dev/null || echo "FAILED: Piščančji nugeti s pomfri"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Mini burger s pomfri"
z-ai-generate -p "Professional food photography of Mini burger s pomfri (Slovenian Dječji Meni), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/mini-burger-s-pomfri.png" -s 864x1152 2>/dev/null || echo "FAILED: Mini burger s pomfri"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Sladoled za otroke"
z-ai-generate -p "Professional food photography of Sladoled za otroke (Slovenian Dječji Meni), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/sladoled-za-otroke.png" -s 864x1152 2>/dev/null || echo "FAILED: Sladoled za otroke"
sleep 3

mkdir -p "public/menu-images"
echo "Generating: Club sendvič s piščancem"
z-ai-generate -p "Professional food photography of Club sendvič s piščancem (Slovenian Sendviči in Tost), restaurant dish, warm lighting, white plate, elegant presentation, high quality, 4k --no text, no logo, no watermark" -o "public/menu-images/club-sendvic-s-piscancem.png" -s 864x1152 2>/dev/null || echo "FAILED: Club sendvič s piščancem"
sleep 3

