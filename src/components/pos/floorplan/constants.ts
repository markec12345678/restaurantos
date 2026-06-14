// ============================================
// DELJENI TIPI IN KONSTANTE ZA VIZUALNI TLORIS
// ============================================

// Tip mize na tlorisu
export interface FloorTable {
  id: string
  number: number
  capacity: number
  status: string
  area: string
  posX: number
  posY: number
  width: number
  height: number
  shape: string
  rotation: number
  revenueCenterId: string | null
}

// Barve po statusu mize
export const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  available: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-400 dark:border-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  occupied: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-400 dark:border-red-600',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
  reserved: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-400 dark:border-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  cleaning: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    border: 'border-gray-400 dark:border-gray-600',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
}

// Oznake statusov v slovenščini
export const statusLabels: Record<string, string> = {
  available: 'Prosta',
  occupied: 'Zasedena',
  reserved: 'Rezervirana',
  cleaning: 'Čiščenje',
}

// Oznake območij v slovenščini
export const areaLabels: Record<string, string> = {
  main: 'Glavna dvorana',
  patio: 'Terasa',
  bar: 'Bar',
  private: 'Zasebni prostor',
}

// Tip za stanje vlečenja
export interface DragState {
  id: string
  startX: number
  startY: number
  origX: number
  origY: number
}

// Tip za obrazec mize
export interface TableFormState {
  number: string
  capacity: string
  area: string
  status: string
  shape: string
  width: string
  height: string
}

// Privzeta vrednost obrazca mize
export const defaultTableForm: TableFormState = {
  number: '', capacity: '4', area: 'main', status: 'available',
  shape: 'round', width: '8', height: '10',
}

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface FloorTableItemProps {
  table: FloorTable
  onDragStart: (_id: string, _e: React.MouseEvent) => void
  onDragEnd: () => void
  onDrag: (_id: string, _deltaX: number, _deltaY: number) => void
  onClick: (_table: FloorTable) => void
  isDragging: boolean
  isSelected: boolean
  zoom: number
}

export interface FloorPlanCanvasProps {
  tables: FloorTable[]
  isLoading: boolean
  dragState: DragState | null
  selectedTableId: string | null
  zoom: number
  groupedByArea: Record<string, FloorTable[]>
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragStart: (_id: string, _e: React.MouseEvent) => void
  onDragEnd: () => void
  onDrag: (_id: string, _deltaX: number, _deltaY: number) => void
  onTableClick: (_table: FloorTable) => void
  onOpenCreate: () => void
}

export interface SelectedTableFooterProps {
  tables: FloorTable[]
  selectedTableId: string | null
  onOpenEdit: (_table: FloorTable) => void
  onRotateTable: (_table: FloorTable) => void
  onDeleteTable: (_id: string) => void
  onDeselect: () => void
}

export interface TableDialogProps {
  dialogOpen: boolean
  editingTable: FloorTable | null
  formData: TableFormState
  onOpenChange: (_open: boolean) => void
  onSetFormData: (_updater: (_prev: TableFormState) => TableFormState) => void
  onSubmit: () => void
  onAreaChange: (_value: string) => void
  onShapeChange: (_value: string) => void
  onStatusChange: (_value: string) => void
}
