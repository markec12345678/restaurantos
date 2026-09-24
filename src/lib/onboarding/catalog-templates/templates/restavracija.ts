// Starter template: RESTAVRACIJA (issue #114) — sodobna restavracija.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const restavracijaTemplate: StarterCatalogTemplate = {
  id: 'restavracija',
  label: 'Restavracija',
  icon: '🍽️',
  description: 'A la carte restavracija: predjedi, glavne jedi, solate, sladice.',
  locationType: 'restaurant',
  menuName: 'Restavracija',
  categories: [
    {
      name: 'Predjedi',
      icon: '🥗',
      color: '#10b981',
      sortOrder: 0,
      items: [
        { name: 'Bruschetta s paradižnikom', price: 5.5, vatRate: 9.5, allergens: '1,7', sortOrder: 0 },
        { name: 'Goveji carpaccio', price: 9.9, vatRate: 9.5, allergens: '1,7,10', sortOrder: 1 },
        { name: 'Kremna bučna juha', price: 4.5, vatRate: 22, allergens: '7', sortOrder: 2 },
      ],
    },
    {
      name: 'Glavne jedi',
      icon: '🍝',
      color: '#ef4444',
      sortOrder: 1,
      items: [
        { name: 'Goveji file v poprovi omaki', price: 19.9, vatRate: 9.5, allergens: '1,7', sortOrder: 0 },
        { name: 'Losos na žaru z zelenjavo', price: 17.5, vatRate: 9.5, allergens: '4', sortOrder: 1 },
        { name: 'Rižota z belimi gobami', price: 12.9, vatRate: 9.5, allergens: '1,7', sortOrder: 2 },
        { name: 'Špageti Bolognese', price: 11.9, vatRate: 9.5, allergens: '1,3', sortOrder: 3 },
        { name: 'Rižota z zelenjavo (vegetarijanska)', price: 11.5, vatRate: 9.5, allergens: '1,7,6', sortOrder: 4 },
      ],
    },
    {
      name: 'Solate',
      icon: '🥬',
      color: '#22c55e',
      sortOrder: 2,
      items: [
        { name: 'Cezarjeva solata s piščancem', price: 10.9, vatRate: 9.5, allergens: '1,3,7,10', sortOrder: 0 },
        { name: 'Mešana solata', price: 4.9, vatRate: 9.5, sortOrder: 1 },
      ],
    },
    {
      name: 'Sladice',
      icon: '🍰',
      color: '#ec4899',
      sortOrder: 3,
      items: [
        { name: 'Cheesecake', price: 4.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Lava cake', price: 5.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 1 },
      ],
    },
    {
      name: 'Pijače',
      icon: '🥤',
      color: '#f59e0b',
      sortOrder: 4,
      items: [
        { name: 'Espresso', price: 1.5, vatRate: 22, sortOrder: 0 },
        { name: 'Cappuccino', price: 2.0, vatRate: 22, allergens: '7', sortOrder: 1 },
        { name: 'Coca-Cola 0,33 l', price: 2.5, vatRate: 22, sortOrder: 2 },
        { name: 'Mineralna voda 0,5 l', price: 2.2, vatRate: 22, sortOrder: 3 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Stopnja pečenja',
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      modifiers: [
        { name: 'Rare', price: 0 },
        { name: 'Medium', price: 0 },
        { name: 'Well done', price: 0 },
      ],
      attachToItems: ['Goveji file v poprovi omaki'],
    },
    {
      name: 'Dodatki',
      required: false,
      minSelect: 0,
      maxSelect: 3,
      sortOrder: 1,
      modifiers: [
        { name: 'Dodatni sir', price: 1.5 },
        { name: 'Grilovana zelenjava', price: 2.5 },
        { name: 'Pommes frites', price: 2.9 },
      ],
      attachToItems: ['Goveji file v poprovi omaki', 'Losos na žaru z zelenjavo', 'Rižota z belimi gobami'],
    },
  ],
}
