// Starter template: GOSTILNA (issue #114) — slovenska tradicionalna ponudba.
// Cene so PRIMERNE začetne vrednosti (issue #114 §11), ne priporočeni cenik.
import type { StarterCatalogTemplate } from '../types'

export const gostilnaTemplate: StarterCatalogTemplate = {
  id: 'gostilna',
  label: 'Gostilna',
  icon: '🏠',
  description: 'Slovenska tradicionalna ponudba: juhe, mesne jedi, sladice, pijače.',
  locationType: 'restaurant',
  menuName: 'Gostilna',
  categories: [
    {
      name: 'Juhe',
      icon: '🍲',
      color: '#d97706',
      sortOrder: 0,
      items: [
        { name: 'Goveja juha z rezanci', price: 2.9, vatRate: 22, allergens: '1,3', sortOrder: 0 },
        { name: 'Gobova juha', price: 3.5, vatRate: 22, allergens: '1,7', sortOrder: 1 },
        { name: 'Domača zimnica', price: 3.2, vatRate: 22, allergens: '1,9', sortOrder: 2 },
      ],
    },
    {
      name: 'Glavne jedi',
      icon: '🍽️',
      color: '#ef4444',
      sortOrder: 1,
      items: [
        { name: 'Kranjska klobasa z kislo repo', description: 'Domača gorčica', price: 9.5, vatRate: 9.5, allergens: '1,10', sortOrder: 0 },
        { name: 'Svinjska pečenka s pečenim krompirjem', price: 12.5, vatRate: 9.5, allergens: '1,7', sortOrder: 1 },
        { name: 'Grilovana postrv z blitvino', price: 14.5, vatRate: 9.5, allergens: '4,1', sortOrder: 2 },
        { name: 'Ajdovi žganci z ocvirki', price: 7.9, vatRate: 9.5, allergens: '1,7', sortOrder: 3 },
        { name: 'Pirova kaša z zelenjavo (vegetarijanska)', price: 9.9, vatRate: 9.5, allergens: '1,7', sortOrder: 4 },
      ],
    },
    {
      name: 'Sladice',
      icon: '🍰',
      color: '#ec4899',
      sortOrder: 2,
      items: [
        { name: 'Jablčni zavitek', price: 3.5, vatRate: 9.5, allergens: '1,3,7', sortOrder: 0 },
        { name: 'Palačinke z marmelado', price: 3.9, vatRate: 9.5, allergens: '1,3,7', sortOrder: 1 },
        { name: 'Potica (rezina)', price: 2.8, vatRate: 9.5, allergens: '1,3,7,8', sortOrder: 2 },
      ],
    },
    {
      name: 'Pijače',
      icon: '🍺',
      color: '#f59e0b',
      sortOrder: 3,
      items: [
        { name: 'Točeno pivo 0,5 l', price: 3.3, vatRate: 22, sortOrder: 0 },
        { name: 'Kozarec belega vina', price: 2.8, vatRate: 22, allergens: '12', sortOrder: 1 },
        { name: 'Mineralna voda 0,5 l', price: 2.2, vatRate: 22, sortOrder: 2 },
        { name: 'Espresso', price: 1.5, vatRate: 22, sortOrder: 3 },
      ],
    },
  ],
  modifierGroups: [
    {
      name: 'Priloga',
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      modifiers: [
        { name: 'Pečen krompir', price: 0 },
        { name: 'Dušeno zelje', price: 0 },
        { name: 'Riž', price: 0 },
        { name: 'Brez priloge', price: 0 },
      ],
      attachToItems: ['Svinjska pečenka s pečenim krompirjem'],
    },
  ],
}
