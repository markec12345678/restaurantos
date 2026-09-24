// Starter template: PIZZERIJA (issue #114) — primer iz issue-ja:
// Pizze / Pijače / Solate / Sladice + smiselni starter artikli.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const pizzerijaTemplate: StarterCatalogTemplate = {
  id: 'pizzerija',
  label: 'Pizzerija',
  icon: '🍕',
  description: 'Pizze iz peči na drva, solate, sladice in pijače.',
  locationType: 'restaurant',
  menuName: 'Pizzerija',
  categories: [
    {
      name: 'Pizze',
      icon: '🍕',
      color: '#ef4444',
      sortOrder: 0,
      items: [
        { name: 'Pizza Margherita', price: 8.9, vatRate: 9.5, allergens: '1,7', sortOrder: 0 },
        { name: 'Pizza Capricciosa', price: 10.9, vatRate: 9.5, allergens: '1,7,3', sortOrder: 1 },
        { name: 'Pizza Salame', price: 9.9, vatRate: 9.5, allergens: '1,7', sortOrder: 2 },
        { name: 'Pizza Prosciutto e funghi', price: 10.5, vatRate: 9.5, allergens: '1,7', sortOrder: 3 },
        { name: 'Pizza Vegetariana', price: 9.5, vatRate: 9.5, allergens: '1,7', sortOrder: 4 },
        { name: 'Pizza Quattro formaggi', price: 11.5, vatRate: 9.5, allergens: '1,7', sortOrder: 5 },
        { name: 'Pizza Tonno', price: 10.5, vatRate: 9.5, allergens: '1,7,4', sortOrder: 6 },
        { name: 'Pizza Diavola', price: 10.9, vatRate: 9.5, allergens: '1,7', sortOrder: 7 },
      ],
    },
    {
      name: 'Solate',
      icon: '🥬',
      color: '#22c55e',
      sortOrder: 1,
      items: [
        { name: 'Mešana solata', price: 4.9, vatRate: 9.5, sortOrder: 0 },
        { name: 'Grška solata', price: 8.5, vatRate: 9.5, allergens: '7,10', sortOrder: 1 },
      ],
    },
    {
      name: 'Sladice',
      icon: '🍰',
      color: '#ec4899',
      sortOrder: 2,
      items: [
        { name: 'Tiramisu', price: 5.0, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Panna cotta', price: 4.5, vatRate: 9.5, allergens: '7', sortOrder: 1 },
      ],
    },
    {
      name: 'Pijače',
      icon: '🥤',
      color: '#f59e0b',
      sortOrder: 3,
      items: [
        { name: 'Točeno pivo 0,5 l', price: 3.3, vatRate: 22, sortOrder: 0 },
        { name: 'Coca-Cola 0,33 l', price: 2.5, vatRate: 22, sortOrder: 1 },
        { name: 'Fanta 0,33 l', price: 2.5, vatRate: 22, sortOrder: 2 },
        { name: 'Mineralna voda 0,5 l', price: 2.2, vatRate: 22, sortOrder: 3 },
        { name: 'Espresso', price: 1.5, vatRate: 22, sortOrder: 4 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Testo',
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      modifiers: [
        { name: 'Klasično testo', price: 0 },
        { name: 'Tanko testo', price: 0 },
        { name: 'Brez glutena', price: 2.0 },
      ],
      attachToItems: [
        'Pizza Margherita', 'Pizza Capricciosa', 'Pizza Salame', 'Pizza Prosciutto e funghi',
        'Pizza Vegetariana', 'Pizza Quattro formaggi', 'Pizza Tonno', 'Pizza Diavola',
      ],
    },
    {
      name: 'Dodatki na pico',
      required: false,
      minSelect: 0,
      maxSelect: 4,
      sortOrder: 1,
      modifiers: [
        { name: 'Dodatni sir', price: 1.5 },
        { name: 'Ekstra salame', price: 1.8 },
        { name: 'Olive', price: 1.0 },
        { name: 'Jalapeño', price: 1.0 },
        { name: 'Rukola', price: 1.2 },
      ],
      attachToItems: [
        'Pizza Margherita', 'Pizza Capricciosa', 'Pizza Salame', 'Pizza Prosciutto e funghi',
        'Pizza Vegetariana', 'Pizza Quattro formaggi', 'Pizza Tonno', 'Pizza Diavola',
      ],
    },
  ],
}
