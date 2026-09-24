// Starter template: KAVARNA (issue #114) — kave, pecivo, zajtrk.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const kavarnaTemplate: StarterCatalogTemplate = {
  id: 'kavarna',
  label: 'Kavarna',
  icon: '☕',
  description: 'Kave, topli napitki, sladice, pecivo in zajtrk.',
  locationType: 'restaurant',
  menuName: 'Kavarna',
  categories: [
    {
      name: 'Kave',
      icon: '☕',
      color: '#8B4513',
      sortOrder: 0,
      items: [
        { name: 'Espresso', price: 1.5, vatRate: 22, sortOrder: 0 },
        { name: 'Macchiato', price: 1.7, vatRate: 22, allergens: '7', sortOrder: 1 },
        { name: 'Cappuccino', price: 2.0, vatRate: 22, allergens: '7', sortOrder: 2 },
        { name: 'Bela kava', price: 2.2, vatRate: 22, allergens: '7', sortOrder: 3 },
        { name: 'Mocha', price: 2.6, vatRate: 22, allergens: '7', sortOrder: 4 },
        { name: 'Ledena kava', price: 2.8, vatRate: 22, allergens: '7', sortOrder: 5 },
      ],
    },
    {
      name: 'Ostali topli napitki',
      icon: '🫖',
      color: '#d97706',
      sortOrder: 1,
      items: [
        { name: 'Čaj', price: 2.3, vatRate: 22, sortOrder: 0 },
        { name: 'Kakao s smetano', price: 2.5, vatRate: 22, allergens: '7', sortOrder: 1 },
        { name: 'Kuhan vinček', price: 2.8, vatRate: 22, allergens: '12', sortOrder: 2 },
      ],
    },
    {
      name: 'Hladne pijače',
      icon: '🥤',
      color: '#0891b2',
      sortOrder: 2,
      items: [
        { name: 'Svež sok', price: 3.2, vatRate: 22, sortOrder: 0 },
        { name: 'Coca-Cola 0,33 l', price: 2.5, vatRate: 22, sortOrder: 1 },
        { name: 'Mineralna voda 0,5 l', price: 2.2, vatRate: 22, sortOrder: 2 },
        { name: 'Limonada domača', price: 3.0, vatRate: 22, sortOrder: 3 },
      ],
    },
    {
      name: 'Sladice in pecivo',
      icon: '🍰',
      color: '#ec4899',
      sortOrder: 3,
      items: [
        { name: 'Croissant maslen', price: 1.8, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Cheesecake', price: 3.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 1 },
        { name: 'Sacherjeva torta (rezina)', price: 3.9, vatRate: 9.5, allergens: '1,3,7,12', sortOrder: 2 },
        { name: 'Krof', price: 1.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 3 },
      ],
    },
    {
      name: 'Zajtrk',
      icon: '🍳',
      color: '#22c55e',
      sortOrder: 4,
      items: [
        { name: 'Zajtrk kavarna (jajca, toast, maslo)', price: 6.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Ovsena kaša s sadjem', price: 5.5, vatRate: 9.5, allergens: '1,7', sortOrder: 1 },
        { name: 'Toast s šunko in sirom', price: 3.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 2 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Mleko',
      required: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 0,
      modifiers: [
        { name: 'Navadno mleko', price: 0 },
        { name: 'Sojino mleko', price: 0.3 },
        { name: 'Ovseno mleko', price: 0.3 },
      ],
      attachToItems: ['Cappuccino', 'Bela kava', 'Mocha', 'Ledena kava'],
    },
  ],
}
