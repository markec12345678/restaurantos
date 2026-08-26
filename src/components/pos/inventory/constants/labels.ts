// ============================================
// KONSTANTE IN OZNAKE za upravljanje zalog
// ============================================

// Slovenski prevodi znanih kategorij
export const categoryLabels: Record<string, string> = {
  all: 'Vse kategorije',
  general: 'Splošno',
  produce: 'Sveže',
  meat: 'Meso',
  dairy: 'Mlečno',
  beverages: 'Pijače',
  'dry-goods': 'Suho blago',
  'suho blago': 'Suho blago',
  zivila: 'Živila',
  pijace: 'Pijače',
  meso: 'Meso',
  'sveze zelenjave': 'Sveža zelenjava',
  mlencni: 'Mlečni',
  zmrznjeno: 'Zmrznjeno',
  zacimbe: 'Začimbe',
  pijače: 'Pijače',
  alkohol: 'Alkohol',
  kava: 'Kava',
  condiments: 'Pripravki',
  packaging: 'Embalaža',
  cleaning: 'Čistilna sredstva',
}

export const transactionTypeLabels: Record<string, string> = {
  procurement: 'Nabava',
  sale: 'Prodaja',
  'write-off': 'Odpis',
  adjustment: 'Popravek',
  return: 'Vrnitev',
}

export const transactionTypeColors: Record<string, string> = {
  procurement: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sale: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'write-off': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  return: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

export const writeOffReasons = [
  'Kvar - rok uporabe',
  'Kvar - poškodba',
  'Razbitje',
  'Izguba',
  'Kraja',
  'Napaka pri vnosu',
  'Popravek inventorja',
  'Vrnitev dobavitelju',
  'Drugo',
]

// Seznam kategorij za obrazec (statičen)
export const formCategoryOptions = ['general', 'produce', 'meat', 'dairy', 'beverages', 'dry-goods']
