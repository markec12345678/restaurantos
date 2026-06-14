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
}

/** Props za MenusTab podkomponento */
export interface MenusTabProps {
  menus: MenuData[] | undefined
  categories: CategoryData[] | undefined
  onAddMenu: () => void
}

/** Props za ModifiersTab podkomponento */
export interface ModifiersTabProps {
  modifierGroups: ModifierGroupData[] | undefined
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
  modifierGroups: { id: string; name: string; required: boolean }[] | undefined
  onSubmit: () => void
}

/** Props za CategoryDialog podkomponento */
export interface CategoryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  catForm: CategoryFormState
  onCatFormChange: (_form: CategoryFormState) => void
  menus: MenuData[] | undefined
  onSubmit: () => void
}

/** Props za MenuDialog podkomponento */
export interface MenuDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  menuForm: MenuFormState
  onMenuFormChange: (_form: MenuFormState) => void
  onSubmit: () => void
}
