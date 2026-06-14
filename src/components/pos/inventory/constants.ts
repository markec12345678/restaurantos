// ============================================
// TIPI, KONSTANTE IN POMOŽNE FUNKCIJE
// za podkomponente upravljanja zalog
// ============================================

// --- Tipi ---

export interface InventoryItemData {
  id: string
  name: string
  description: string
  image: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  supplier: string
  category: string
  expiryDate: string | null
  servingsPerUnit: number
  servingSize: string
  costPerServing: number
  menuItemId: string | null
  menuItem?: { id: string; name: string; price: number; image: string } | null
  lastRestocked: string
}

export interface TransactionData {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  costPerUnit: number
  totalCost: number
  reason: string
  note: string
  supplierDoc: string
  employeeName: string
  orderId: string | null
  createdAt: string
  inventoryItem: { name: string; unit: string; category: string }
}

export interface TransactionSummary {
  type: string
  count: number
  totalQuantity: number
  totalCost: number
}

export interface TransactionsResponse {
  transactions: TransactionData[]
  total: number
  summary: TransactionSummary[]
}

export interface ItemFormData {
  name: string
  description: string
  image: string
  unit: string
  quantity: string
  minQuantity: string
  costPerUnit: string
  supplier: string
  category: string
  expiryDate: string
  menuItemId: string
  servingsPerUnit: string
  servingSize: string
  costPerServing: string
}

export interface RestockFormData {
  quantity: string
  costPerUnit: string
  supplierDoc: string
  employeeName: string
  note: string
}

export interface WriteOffFormData {
  quantity: string
  type: string
  reason: string
  note: string
  employeeName: string
}

// Prazna oblika za nov artikel
export const emptyItemForm: ItemFormData = {
  name: '', description: '', image: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '',
  supplier: '', category: 'general', expiryDate: '', menuItemId: '',
  servingsPerUnit: '1', servingSize: '', costPerServing: '',
}

// Prazna oblika za nabavo
export const emptyRestockForm: RestockFormData = {
  quantity: '', costPerUnit: '', supplierDoc: '', employeeName: '', note: '',
}

// Prazna oblika za razknjižbo
export const emptyWriteOffForm: WriteOffFormData = {
  quantity: '', type: 'write-off', reason: '', note: '', employeeName: '',
}

// --- Konstante ---

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

// --- Pomožne funkcije ---

export const stockLevelColor = (quantity: number, minQuantity: number): 'destructive' | 'secondary' | 'default' => {
  if (quantity <= 0) return 'destructive'
  if (quantity <= minQuantity) return 'secondary'
  return 'default'
}

export const stockLevelText = (quantity: number, minQuantity: number): string => {
  if (quantity <= 0) return 'Ni na zalogi'
  if (quantity <= minQuantity * 0.5) return 'Kritično'
  if (quantity <= minQuantity) return 'Nizko'
  return 'Na zalogi'
}

export function formatDateTimeSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
