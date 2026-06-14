// ============================================
// ZAPOSLENI — Skupne konstante in tipi
// ============================================

// --- TIPI ---

export interface EmployeeFormData {
  name: string
  email: string
  phone: string
  role: string
  status: string
  hireDate: string
}

export interface ShiftFormData {
  employeeId: string
  date: string
  startTime: string
  endTime: string
}

// --- KONSTANTE ---

export const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  staff: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  chef: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export const roleLabels: Record<string, string> = {
  admin: 'Skrbnik',
  manager: 'Vodja',
  staff: 'Osebje',
  chef: 'Kuhar',
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface EmployeeHeaderProps {
  onOpenCreate: () => void
  onOpenShiftDialog: () => void
}

export interface EmployeeListProps {
  employees: Record<string, unknown>[]
  isLoading: boolean
  search: string
  filterRole: string
  onSearchChange: (_value: string) => void
  onFilterRoleChange: (_value: string) => void
  onEdit: (_emp: Record<string, unknown>) => void
  onToggleStatus: (_emp: Record<string, unknown>) => void
  onDelete: (_emp: Record<string, unknown>) => void
  shifts: Record<string, unknown>[] | undefined
}

export interface EmployeeDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingEmployee: Record<string, unknown> | null
  formData: EmployeeFormData
  onFormDataChange: (_data: EmployeeFormData) => void
  onSubmit: () => void
}

export interface ShiftDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  shiftForm: ShiftFormData
  onShiftFormChange: (_data: ShiftFormData) => void
  employees: Record<string, unknown>[]
  onSubmit: () => void
}

export interface DeleteDialogProps {
  open: boolean
  deleteTarget: Record<string, unknown> | null
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}
