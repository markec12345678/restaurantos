// Starter template: FAST FOOD (issue #114) — burgerji, priloge, pijače.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const fastFoodTemplate: StarterCatalogTemplate = {
  id: 'fast_food',
  label: 'Fast food',
  icon: '🍔',
  description: 'Burgerji, sendviči, priloge in pijače za hiter vnos.',
  locationType: 'restaurant',
  menuName: 'Fast food',
  categories: [
    {
      name: 'Burgerji',
      icon: '🍔',
      color: '#ef4444',
      sortOrder: 0,
      items: [
        { name: 'Hamburger', price: 4.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Cheeseburger', price: 5.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 1 },
        { name: 'Chicken burger', price: 6.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 2 },
        { name: 'Veggie burger', price: 6.2, vatRate: 9.5, allergens: '1,7,6', sortOrder: 3 },
        { name: 'Dvojni cheeseburger', price: 8.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 4 },
      ],
    },
    {
      name: 'Sendviči in wrapi',
      icon: '🌯',
      color: '#d97706',
      sortOrder: 1,
      items: [
        { name: 'Kebab v lepinji', price: 6.9, vatRate: 9.5, allergens: '1', sortOrder: 0 },
        { name: 'Chicken wrap', price: 6.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 1 },
        { name: 'Gyros v lepinji', price: 6.9, vatRate: 9.5, allergens: '1,7', sortOrder: 2 },
      ],
    },
    {
      name: 'Priloge',
      icon: '🍟',
      color: '#f59e0b',
      sortOrder: 2,
      items: [
        { name: 'Krompirček (veliki)', price: 2.9, vatRate: 9.5, sortOrder: 0 },
        { name: 'Piščančji nageti (6 kos)', price: 4.5, vatRate: 9.5, allergens: '1,3', sortOrder: 1 },
        { name: 'Cebulni obročki', price: 3.2, vatRate: 9.5, allergens: '1', sortOrder: 2 },
      ],
    },
    {
      name: 'Pijače',
      icon: '🥤',
      color: '#0891b2',
      sortOrder: 3,
      items: [
        { name: 'Coca-Cola 0,5 l', price: 2.8, vatRate: 22, sortOrder: 0 },
        { name: 'Fanta 0,5 l', price: 2.8, vatRate: 22, sortOrder: 1 },
        { name: 'Sprite 0,5 l', price: 2.8, vatRate: 22, sortOrder: 2 },
        { name: 'Mineralna voda 0,5 l', price: 2.2, vatRate: 22, sortOrder: 3 },
        { name: 'Mlečni shake', price: 3.5, vatRate: 22, allergens: '7', sortOrder: 4 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Dodatki za burger',
      required: false,
      minSelect: 0,
      maxSelect: 4,
      sortOrder: 0,
      modifiers: [
        { name: 'Dodatni cheddar', price: 0.8 },
        { name: 'Slanina', price: 1.2 },
        { name: 'Jajce', price: 0.9 },
        { name: 'Jalapeño', price: 0.7 },
      ],
      attachToItems: ['Hamburger', 'Cheeseburger', 'Chicken burger', 'Veggie burger', 'Dvojni cheeseburger'],
    },
    {
      name: 'Omaka',
      required: false,
      minSelect: 0,
      maxSelect: 2,
      sortOrder: 1,
      modifiers: [
        { name: 'Ketchup', price: 0.4 },
        { name: 'Majoneza', price: 0.4 },
        { name: 'BBQ omaka', price: 0.5 },
      ],
      attachToItems: ['Krompirček (veliki)', 'Piščančji nageti (6 kos)', 'Cebulni obročki'],
    },
  ],
}
