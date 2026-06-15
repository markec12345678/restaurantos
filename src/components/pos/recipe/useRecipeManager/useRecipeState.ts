'use client'

import { useState } from 'react'
import type { RecipeItemData, AddFormState, EditFormState } from '../constants'

// ============================================
// STANJA — Dialogi in filtri
// ============================================

export function useRecipeState() {
  const [activeTab, setActiveTab] = useState('recipes')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterMenu, setFilterMenu] = useState('all')

  // Dodajanje sestavine dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>({
    menuItemId: '', inventoryItemId: '', quantityPerServing: '', unit: '', notes: ''
  })

  // Urejanje sestavine dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<RecipeItemData | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ quantityPerServing: '', unit: '', notes: '' })

  return {
    activeTab, setActiveTab,
    selectedMenuItemId, setSelectedMenuItemId,
    search, setSearch,
    filterMenu, setFilterMenu,
    addDialogOpen, setAddDialogOpen,
    addForm, setAddForm,
    editDialogOpen, setEditDialogOpen,
    editItem, setEditItem,
    editForm, setEditForm,
  }
}
