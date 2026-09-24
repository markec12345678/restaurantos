// Starter template: BAR (issue #114) — pijače v ospredju + prigrizki.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const barTemplate: StarterCatalogTemplate = {
  id: 'bar',
  label: 'Bar',
  icon: '🍸',
  description: 'Piva, vina, koktajli, brezalkoholne pijače in prigrizki.',
  locationType: 'bar',
  menuName: 'Bar',
  categories: [
    {
      name: 'Piva',
      icon: '🍺',
      color: '#f59e0b',
      sortOrder: 0,
      items: [
        { name: 'Točeno pivo 0,3 l', price: 2.4, vatRate: 22, sortOrder: 0 },
        { name: 'Točeno pivo 0,5 l', price: 3.3, vatRate: 22, sortOrder: 1 },
        { name: 'Stekleničeno pivo 0,33 l', price: 3.0, vatRate: 22, sortOrder: 2 },
        { name: 'Nealkoholno pivo', price: 3.2, vatRate: 22, sortOrder: 3 },
      ],
    },
    {
      name: 'Vina',
      icon: '🍷',
      color: '#7c3aed',
      sortOrder: 1,
      items: [
        { name: 'Kozarec belega vina', price: 2.8, vatRate: 22, allergens: '12', sortOrder: 0 },
        { name: 'Kozarec rdečega vina', price: 2.8, vatRate: 22, allergens: '12', sortOrder: 1 },
        { name: 'Špricer 0,5 l', price: 4.5, vatRate: 22, allergens: '12', sortOrder: 2 },
      ],
    },
    {
      name: 'Žgane pijače in koktajli',
      icon: '🥃',
      color: '#b91c1c',
      sortOrder: 2,
      items: [
        { name: 'Viski 4 cl', price: 5.5, vatRate: 22, sortOrder: 0 },
        { name: 'Vodka 4 cl', price: 4.5, vatRate: 22, sortOrder: 1 },
        { name: 'Gin tonic', price: 6.5, vatRate: 22, sortOrder: 2 },
        { name: 'Aperol spritz', price: 6.0, vatRate: 22, allergens: '12', sortOrder: 3 },
      ],
    },
    {
      name: 'Brezalkoholne pijače',
      icon: '🥤',
      color: '#0891b2',
      sortOrder: 3,
      items: [
        { name: 'Espresso', price: 1.5, vatRate: 22, sortOrder: 0 },
        { name: 'Cappuccino', price: 2.0, vatRate: 22, allergens: '7', sortOrder: 1 },
        { name: 'Coca-Cola 0,33 l', price: 2.5, vatRate: 22, sortOrder: 2 },
        { name: 'Mineralna voda 0,25 l', price: 1.8, vatRate: 22, sortOrder: 3 },
        { name: 'Svež pomarančni sok', price: 3.2, vatRate: 22, sortOrder: 4 },
      ],
    },
    {
      name: 'Prigrizki',
      icon: '🥜',
      color: '#78716c',
      sortOrder: 4,
      items: [
        { name: 'Mešani oreščki', price: 3.0, vatRate: 9.5, allergens: '8', sortOrder: 0 },
        { name: 'Krompirjev čips', price: 2.2, vatRate: 9.5, sortOrder: 1 },
        { name: 'Toast s šunko in sirom', price: 3.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 2 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Led',
      required: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 0,
      modifiers: [
        { name: 'Z ledom', price: 0 },
        { name: 'Brez ledu', price: 0 },
      ],
      attachToItems: ['Viski 4 cl', 'Vodka 4 cl', 'Gin tonic'],
    },
  ],
}
