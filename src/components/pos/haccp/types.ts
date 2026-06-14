// ============================================
// TIPI
// ============================================

export interface HaccpEntry {
  id: string
  date: string
  category: string
  title: string
  description: string
  value: string
  status: string
  correctiveAction: string
  employeeName: string
  createdAt: string
  updatedAt: string
}

export interface HaccpFormData {
  category: string
  title: string
  description: string
  value: string
  status: string
  correctiveAction: string
  employeeName: string
}
