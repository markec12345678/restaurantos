// ============================================
// TIPI za dnevni kontrolni seznam
// ============================================

export interface ChecklistItem {
  id: string
  task: string
  category: string
  completed: boolean
  completedBy?: string
  completedAt?: string
  notes?: string
}
