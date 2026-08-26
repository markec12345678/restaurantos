// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Analitika obračuna miz — skupne tipi in konstante
// Toast POS + OpenTable standard
// ═══════════════════════════════════════════════════════════════

export interface TableData {
  id: string
  number: number
  name?: string
  capacity: number
  status: string
  locationId?: string
  currentOrder?: {
    id: string
    orderNumber: number
    customerName?: string
    createdAt: string
    total: number
    partySize?: number
    type: string
  }
}

export interface OrderHistory {
  id: string
  orderNumber: number
  tableId: string
  createdAt: string
  updatedAt: string
  total: number
  type: string
  status: string
}

export interface OccupancyInfo {
  tableId: string
  tableNumber: number
  minutes: number
  customer?: string
  total: number
}

export interface AnalyticsData {
  totalTables: number
  occupiedTables: number
  availableTables: number
  reservedTables: number
  occupancyRate: number
  capacityUtilization: number
  avgOccupancyTime: number
  turnoverRate: number
  avgSpendPerTable: number
  slowTables: OccupancyInfo[]
  slowTableRate: number
  occupancyTimes: OccupancyInfo[]
  totalCapacity: number
  occupiedCapacity: number
}

export interface KpiCardsProps {
  analytics: AnalyticsData
}

export interface OccupiedTablesCardProps {
  analytics: AnalyticsData
}

export interface VisualOverviewProps {
  tables: TableData[]
  analytics: AnalyticsData
}

export interface RecommendationsCardProps {
  analytics: AnalyticsData
}
