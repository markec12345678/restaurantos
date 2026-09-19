// ============================================
// TIPI ZA MENI UPRAVLJANJE
// ============================================

/** Podatki menija */
export interface MenuData {
  id: string
  name: string
  icon: string
  color: string
  isActive: boolean
  categories: { id: string }[]
}

/** Podatki kategorije */
export interface CategoryData {
  id: string
  name: string
  icon: string
  color: string
  menuId?: string
  menu?: { id: string; name: string }
  menuItems?: unknown[]
  sortOrder?: number
}

/** Podatki artikla */
export interface MenuItemData {
  id: string
  name: string
  description?: string
  price: number
  categoryId: string
  isAvailable: boolean
  image?: string
  modifierGroups: { modifierGroup: { id: string; name: string } }[]
}

/** Podatki skupine dodatkov */
export interface ModifierGroupData {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number | null
  modifiers: { id: string; name: string; price: number }[]
  menuItems: { menuItem: { id: string; name: string } }[]
}

/** Stanje obrazca za artikel */
export interface ItemFormState {
  name: string
  description: string
  price: string
  categoryId: string
  isAvailable: boolean
  image: string
  modifierGroupIds: string[]
}

/** RUNDA 68: vrsta modifikatorja v obrazcu skupine dodatkov (dinamične vrstice) */
export interface ModifierRowState {
  name: string
  price: string
}

/** RUNDA 68: stanje obrazca za skupino dodatkov */
export interface ModifierGroupFormState {
  name: string
  required: boolean
  minSelect: string
  maxSelect: string
  /** prazno maxSelect = neomejeno */
  modifiers: ModifierRowState[]
  /** RUNDA 70: group-side attach — artikli pripeti skupini (menuItemIds) */
  menuItemIds: string[]
}

/** Stanje obrazca za kategorijo */
export interface CategoryFormState {
  name: string
  icon: string
  color: string
  menuId: string
}

/** Stanje obrazca za meni */
export interface MenuFormState {
  name: string
  icon: string
  color: string
  // RUNDA 67: aktivnost menija (PUT podporo že ima; UI stikalo v urejanju)
  isActive: boolean
}

// ============================================
// PROPS INTERFACES ZA PODKOMPONENTE
// ============================================

/** Props za ItemsTab podkomponento */
export interface ItemsTabProps {
  search: string
  onSearchChange: (_value: string) => void
  filterMenu: string
  onFilterMenuChange: (_value: string) => void
  filterCategory: string
  onFilterCategoryChange: (_value: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (_mode: 'grid' | 'list') => void
  filteredItems: Record<string, unknown>[]
  categories: CategoryData[] | undefined
  menus: MenuData[] | undefined
  isLoading: boolean
  onEditItem: (_item: Record<string, unknown>) => void
  onDeleteItem: (_id: string) => void
  onToggleAvailability: (_id: string, _isAvailable: boolean) => void
}

/** Props za CategoriesTab podkomponento */
export interface CategoriesTabProps {
  menus: MenuData[] | undefined
  categories: CategoryData[] | undefined
  onAddCategory: () => void
  /** RUNDA 66: odpri urejanje kategorije */
  onEditCategory: (_cat: Record<string, unknown>) => void
  /** RUNDA 66: POTRJEN izbris kategorije (po AlertDialog potrditvi) */
  onConfirmDelete: (_id: string) => void
}

/** Props za MenusTab podkomponento */
export interface MenusTabProps {
  menus: MenuData[] | undefined
  categories: CategoryData[] | undefined
  onAddMenu: () => void
  /** RUNDA 67: odpri urejanje menija */
  onEditMenu: (_menu: Record<string, unknown>) => void
  /** RUNDA 67: POTRJEN izbris menija (po AlertDialog potrditvi) */
  onConfirmDelete: (_id: string) => void
}

/** Props za ModifiersTab podkomponento */
export interface ModifiersTabProps {
  modifierGroups: ModifierGroupData[] | undefined
  /** RUNDA 68: odpri dialog za NOVO skupino dodatkov */
  onAddGroup: () => void
  /** RUNDA 68: odpri urejanje skupine dodatkov */
  onEditGroup: (_group: Record<string, unknown>) => void
  /** RUNDA 68: POTRJEN izbris skupine (po AlertDialog potrditvi) */
  onConfirmDelete: (_id: string) => void
}

/** Props za ItemDialog podkomponento */
export interface ItemDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingItem: Record<string, unknown> | null
  itemForm: ItemFormState
  onItemFormChange: (_form: ItemFormState) => void
  menus: MenuData[] | undefined
  categories: CategoryData[] | undefined
  /** RUNDA 70: polni podatki skupin (opcije za predogled + števec) */
  modifierGroups: ModifierGroupData[] | undefined
  onSubmit: () => void
}

/** Props za CategoryDialog podkomponento */
export interface CategoryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  catForm: CategoryFormState
  onCatFormChange: (_form: CategoryFormState) => void
  menus: MenuData[] | undefined
  /** RUNDA 66: null = ustvarjanje, objekt = urejanje (naslov/gumb se spremenita) */
  editingCategory: Record<string, unknown> | null
  onSubmit: () => void
}

/** Props za MenuDialog podkomponento */
export interface MenuDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  menuForm: MenuFormState
  onMenuFormChange: (_form: MenuFormState) => void
  /** RUNDA 67: null = ustvarjanje, objekt = urejanje (naslov/gumb se spremenita) */
  editingMenu: Record<string, unknown> | null
  onSubmit: () => void
}

/** RUNDA 68: Props za ModifierDialog podkomponento (skupine dodatkov) */
export interface ModifierDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  modGroupForm: ModifierGroupFormState
  onModGroupFormChange: (_form: ModifierGroupFormState) => void
  /** null = ustvarjanje, objekt = urejanje (naslov/gumb se spremenita) */
  editingModifierGroup: Record<string, unknown> | null
  /** RUNDA 70: artikli za group-side attach (iskalni seznam) */
  menuItems: Record<string, unknown>[] | undefined
  onSubmit: () => void
}
