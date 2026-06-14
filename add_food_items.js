/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Category IDs
const CAT = {
  Predjedi: 'cmowus36y0003o1ajceonoxzk',
  Pica: 'cmowus371000bo1ajs4lowe13',
  Burgerji: 'cmowus371000do1ajt9g22k06',
  Sladice: 'cmowus372000fo1ajzbgbm1ug',
  Priloge: 'cmowus372000ho1aj9rtdh9vb',
  GlavneJedi: 'cmowus36z0007o1ajon2q3ltv',
  Juhe: 'cmowus36z0005o1ajj7mmid7w',
  Testenine: 'cmowus36z0009o1aj6u89w6pd',
  Solate: 'cmp1g49780001npfma1u3m4gs',
  Sendvici: 'cmp1g497h0009npfmgjpmjazr',
  Djecji: 'cmp1g497i000bnpfmilnftpsh',
  Zajtrk: 'cmp1g497i000dnpfmvcf6y1v1',
  Morski: 'cmp1g497j000fnpfmnyt4j7r3',
  Slovenske: 'cmp1g49780005npfmxti7bsf9',
  Rizote: 'cmp1g49780004npfmhtsn6uqn',
  Zara: 'cmp1g49780007npfmm8kxkj5g',
};

// All new items to add - based on web research from Slovenian restaurants
const newItems = [
  // === PREDJEDI (adding 8) ===
  { name: 'Goveji tatar', price: 19.90, category: CAT.Predjedi, vat: 22 },
  { name: 'Caprese', price: 13.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Tartar iz lososa', price: 16.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Mesna deska s sirom', price: 18.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Ocvrti kalamari', price: 11.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Tartar iz govedine z žarem', price: 15.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Brusketa s paradižnikom in baziliko', price: 7.90, category: CAT.Predjedi, vat: 9.5 },
  { name: 'Domaca pašteta', price: 9.90, category: CAT.Predjedi, vat: 9.5 },

  // === JUHE (adding 5) ===
  { name: 'Kremna gobova juha', price: 7.49, category: CAT.Juhe, vat: 9.5 },
  { name: 'Riževa juha', price: 6.49, category: CAT.Juhe, vat: 9.5 },
  { name: 'Goveja juha s potrebušnino', price: 8.49, category: CAT.Juhe, vat: 9.5 },
  { name: 'Čemaževa juha', price: 7.99, category: CAT.Juhe, vat: 9.5 },
  { name: 'Minestra', price: 6.99, category: CAT.Juhe, vat: 9.5 },

  // === GLAVNE JEDI (adding 12) ===
  { name: 'Svinjski zrezek po dunajsko', price: 13.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Svinjski zrezek po ljubljansko', price: 14.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Telečji zrezek v gobovi omaki', price: 22.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Puranji zrezek po dunajsko', price: 15.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Goveja jetra s čebulo', price: 12.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Goveji stroganov', price: 18.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Piščančji zrezek v smetanovi omaki', price: 14.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Svinjska pečenka', price: 16.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Svinjska rebra z žara', price: 19.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Medaljoni iz govedine', price: 26.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Piščančji file v parmezani', price: 16.90, category: CAT.GlavneJedi, vat: 9.5 },
  { name: 'Dunajski zrezek s pomfri', price: 15.90, category: CAT.GlavneJedi, vat: 9.5 },

  // === TESTENINE (adding 8) ===
  { name: 'Špageti bolognese', price: 14.49, category: CAT.Testenine, vat: 9.5 },
  { name: 'Tagliatelle s tartufi', price: 19.90, category: CAT.Testenine, vat: 9.5 },
  { name: 'Penne s piščancem in curryjem', price: 15.49, category: CAT.Testenine, vat: 9.5 },
  { name: 'Ravioli s špinačo in skuto', price: 16.90, category: CAT.Testenine, vat: 9.5 },
  { name: 'Špageti s kozicami', price: 18.90, category: CAT.Testenine, vat: 9.5 },
  { name: 'Fuži s tartufi', price: 18.90, category: CAT.Testenine, vat: 9.5 },
  { name: 'Rezanci z gobami', price: 14.90, category: CAT.Testenine, vat: 9.5 },
  { name: 'Špageti frutti di mare', price: 17.90, category: CAT.Testenine, vat: 9.5 },

  // === PICA (adding 10) ===
  { name: 'Štirje siri', price: 16.99, category: CAT.Pica, vat: 9.5 },
  { name: 'Gobova pica', price: 15.99, category: CAT.Pica, vat: 9.5 },
  { name: 'Diavolo', price: 16.49, category: CAT.Pica, vat: 9.5 },
  { name: 'Prosciutto e rucola', price: 17.49, category: CAT.Pica, vat: 9.5 },
  { name: 'Tunina pica', price: 16.99, category: CAT.Pica, vat: 9.5 },
  { name: 'Kraška pica', price: 16.49, category: CAT.Pica, vat: 9.5 },
  { name: 'Havajska pica', price: 16.49, category: CAT.Pica, vat: 9.5 },
  { name: 'Kmečka pica', price: 17.49, category: CAT.Pica, vat: 9.5 },
  { name: 'Pica s pršutom', price: 17.99, category: CAT.Pica, vat: 9.5 },
  { name: 'Bianca pica', price: 15.49, category: CAT.Pica, vat: 9.5 },

  // === BURGERJI (adding 4) ===
  { name: 'BBQ burger', price: 16.99, category: CAT.Burgerji, vat: 9.5 },
  { name: 'Double cheeseburger', price: 18.49, category: CAT.Burgerji, vat: 9.5 },
  { name: 'Chili burger', price: 16.49, category: CAT.Burgerji, vat: 9.5 },
  { name: 'Burger z jajcem in slanino', price: 17.49, category: CAT.Burgerji, vat: 9.5 },

  // === SOLATE (adding 5) ===
  { name: 'Šopska solata', price: 8.99, category: CAT.Solate, vat: 9.5 },
  { name: 'Caprese solata', price: 9.99, category: CAT.Solate, vat: 9.5 },
  { name: 'Solata z grilanim sirom', price: 11.99, category: CAT.Solate, vat: 9.5 },
  { name: 'Solata z avokadom in kozicami', price: 14.99, category: CAT.Solate, vat: 9.5 },
  { name: 'Cezarjeva solata s kozicami', price: 14.49, category: CAT.Solate, vat: 9.5 },

  // === SLOVENSKE JEDI (adding 10) ===
  { name: 'Bograč', price: 14.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Segedin', price: 11.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Krvavica s kislim zeljem', price: 10.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Idrijski žlikrofi', price: 12.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Prekmurska gibanica', price: 5.99, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Kmečki krožnik', price: 14.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Mlinci s puranom', price: 11.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Obara z ajdovo kašo', price: 10.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Domače pečenice s kislim zeljem', price: 11.90, category: CAT.Slovenske, vat: 9.5 },
  { name: 'Potica', price: 4.99, category: CAT.Slovenske, vat: 9.5 },

  // === SLADICE (adding 7) ===
  { name: 'Panna cotta', price: 6.99, category: CAT.Sladice, vat: 9.5 },
  { name: 'Krofi s pomarančno marmelado', price: 4.99, category: CAT.Sladice, vat: 9.5 },
  { name: 'Ledeni desert', price: 5.99, category: CAT.Sladice, vat: 9.5 },
  { name: 'Sadna skleda', price: 5.49, category: CAT.Sladice, vat: 9.5 },
  { name: 'Domino kocke', price: 4.49, category: CAT.Sladice, vat: 9.5 },
  { name: 'Palačinke z marmelado', price: 5.49, category: CAT.Sladice, vat: 9.5 },
  { name: 'Sladoled tri okuse', price: 4.99, category: CAT.Sladice, vat: 9.5 },

  // === PRILOGE (adding 10) ===
  { name: 'Njoki', price: 4.49, category: CAT.Priloge, vat: 9.5 },
  { name: 'Polenta', price: 3.99, category: CAT.Priloge, vat: 9.5 },
  { name: 'Mlinci', price: 3.99, category: CAT.Priloge, vat: 9.5 },
  { name: 'Krompirjev pire', price: 3.99, category: CAT.Priloge, vat: 9.5 },
  { name: 'Krompirjevi kroketi', price: 4.49, category: CAT.Priloge, vat: 9.5 },
  { name: 'Ocvrtki', price: 3.99, category: CAT.Priloge, vat: 9.5 },
  { name: 'Ajdova kaša', price: 3.49, category: CAT.Priloge, vat: 9.5 },
  { name: 'Bučke na žaru', price: 4.49, category: CAT.Priloge, vat: 9.5 },
  { name: 'Žar zelenjava', price: 4.99, category: CAT.Priloge, vat: 9.5 },
  { name: 'Kuhana zelenjava', price: 3.49, category: CAT.Priloge, vat: 9.5 },

  // === MORSKI SADEŽI (adding 5) ===
  { name: 'File lososa z žara', price: 22.90, category: CAT.Morski, vat: 9.5 },
  { name: 'File brancina', price: 21.90, category: CAT.Morski, vat: 9.5 },
  { name: 'Ocvrti lignji s tartarsko omako', price: 14.90, category: CAT.Morski, vat: 9.5 },
  { name: 'Hobotnica z žara', price: 19.90, category: CAT.Morski, vat: 9.5 },
  { name: 'Ribja pašteta', price: 11.90, category: CAT.Morski, vat: 9.5 },

  // === ŽARA IN GRILL (adding 5) ===
  { name: 'Hrenovke na žaru', price: 9.90, category: CAT.Zara, vat: 9.5 },
  { name: 'Klobase na žaru', price: 11.90, category: CAT.Zara, vat: 9.5 },
  { name: 'Piščančji file na žaru', price: 15.90, category: CAT.Zara, vat: 9.5 },
  { name: 'Pikantne klobase', price: 12.90, category: CAT.Zara, vat: 9.5 },
  { name: 'Žar deska za dve', price: 39.90, category: CAT.Zara, vat: 9.5 },

  // === RIŽOTE (adding 4) ===
  { name: 'Rižota s tartufi', price: 17.90, category: CAT.Rizote, vat: 9.5 },
  { name: 'Rižota z jurčki', price: 15.90, category: CAT.Rizote, vat: 9.5 },
  { name: 'Rižota s šparglji', price: 15.49, category: CAT.Rizote, vat: 9.5 },
  { name: 'Rižota z bučkami in feto', price: 13.90, category: CAT.Rizote, vat: 9.5 },

  // === ZAJTRK IN BRUNCH (adding 5) ===
  { name: 'Francoski toast', price: 8.49, category: CAT.Zajtrk, vat: 9.5 },
  { name: 'Jajčni benedikt', price: 11.99, category: CAT.Zajtrk, vat: 9.5 },
  { name: 'Sladke palačinke z jagodami', price: 8.99, category: CAT.Zajtrk, vat: 9.5 },
  { name: 'Granola z jogurtom', price: 7.49, category: CAT.Zajtrk, vat: 9.5 },
  { name: 'Kava in krof', price: 5.99, category: CAT.Zajtrk, vat: 9.5 },

  // === DJEČJI MENI (adding 4) ===
  { name: 'Piščančji nugeti s pomfri', price: 7.49, category: CAT.Djecji, vat: 9.5 },
  { name: 'Mini burger s pomfri', price: 7.99, category: CAT.Djecji, vat: 9.5 },
  { name: 'Krompirček s piščancem', price: 6.99, category: CAT.Djecji, vat: 9.5 },
  { name: 'Sladoled za otroke', price: 3.99, category: CAT.Djecji, vat: 9.5 },

  // === SENDVIČI IN TOST (adding 4) ===
  { name: 'Toast s sirom na žaru', price: 6.99, category: CAT.Sendvici, vat: 9.5 },
  { name: 'Panini s pršutom in mocarelo', price: 10.49, category: CAT.Sendvici, vat: 9.5 },
  { name: 'Club sendvič s piščancem', price: 11.49, category: CAT.Sendvici, vat: 9.5 },
  { name: 'Wrap s piščancem in zelenjavo', price: 9.99, category: CAT.Sendvici, vat: 9.5 },
];

async function main() {
  console.log('Adding ' + newItems.length + ' new food items...');
  
  let added = 0;
  for (const item of newItems) {
    // Check if already exists
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name, categoryId: item.category }
    });
    if (existing) {
      console.log('  SKIP (exists): ' + item.name);
      continue;
    }
    
    const slug = item.name.toLowerCase()
      .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    await prisma.menuItem.create({
      data: {
        name: item.name,
        price: item.price,
        vatRate: item.vat,
        categoryId: item.category,
        image: '/menu-images/' + slug + '.png',
        isAvailable: true,
        sortOrder: added,
      }
    });
    added++;
    console.log('  ADDED: ' + item.name + ' - €' + item.price);
  }
  
  console.log('\nTotal added: ' + added + ' items');
  
  // Count total
  const totalHrana = await prisma.menuItem.count({
    where: { category: { menu: { name: 'Hrana' } } }
  });
  const totalAll = await prisma.menuItem.count();
  console.log('Total HRANA items now: ' + totalHrana);
  console.log('Total ALL items now: ' + totalAll);
}

main().catch(console.error).finally(() => prisma.$disconnect());
