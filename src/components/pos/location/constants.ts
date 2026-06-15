// DELJENI TIPI IN KONSTANTE ZA LOCATION MANAGER
import type { SyncResultRow, DeliveryZoneRow } from '@/lib/types'

// Tip lokacijskih podatkov
export interface LocationData {
  id: string
  name: string
  code: string
  type: string
  address: string
  city: string
  postCode: string
  country: string
  phone: string
  email: string
  businessId: string
  taxId: string
  registerNumber: string
  premisesId: string
  timezone: string
  currency: string
  locale: string
  isOpen: boolean
  isActive: boolean
  latitude: number | null
  longitude: number | null
  createdAt: string
  _count?: {
    orders: number
    tables: number
    employees: number
    inventoryItems: number
  }
}

// Tip za potrditev brisanja
export interface DeleteConfirmState {
  type: 'zone' | 'location'
  id: string
  name: string
}

// Tip za obrazec lokacije
export interface LocationFormState {
  name: string
  code: string
  type: string
  address: string
  city: string
  postCode: string
  country: string
  phone: string
  email: string
  businessId: string
  taxId: string
  registerNumber: string
  premisesId: string
  timezone: string
  currency: string
  locale: string
  latitude: string
  longitude: string
}

// Tip za obrazec cone dostave
export interface ZoneFormState {
  name: string
  postCodes: string
  cities: string
  deliveryFee: string
  minOrderAmount: string
  freeDeliveryAbove: string
  estimatedMinutes: string
  locationId: string
}

// Privzeta vrednost obrazca lokacije
export const defaultLocationForm: LocationFormState = {
  name: '', code: '', type: 'restaurant', address: '', city: '', postCode: '',
  country: 'SI', phone: '', email: '', businessId: '', taxId: '', registerNumber: '',
  premisesId: '', timezone: 'Europe/Ljubljana', currency: 'EUR', locale: 'sl-SI',
  latitude: '', longitude: '',
}

// Privzeta vrednost obrazca cone dostave
export const defaultZoneForm: ZoneFormState = {
  name: '', postCodes: '', cities: '', deliveryFee: '2.50', minOrderAmount: '10.00',
  freeDeliveryAbove: '0', estimatedMinutes: '30', locationId: '',
}

// Oznake tipov lokacij
export const typeLabels: Record<string, string> = {
  restaurant: 'Restavracija',
  bar: 'Bar',
  food_truck: 'Food Truck',
  pop_up: 'Pop-up',
  cloud_kitchen: 'Cloud Kitchen',
}

// VMESNIKI ZA PROPS PODKOMPONENT
export interface LocationStatsProps {
  total: number
  active: number
  open: number
}

export interface MenuSyncSectionProps {
  showSync: boolean
  syncSource: string
  syncing: boolean
  syncResult: SyncResultRow | null
  locations: LocationData[]
  onSyncSourceChange: (_e: React.ChangeEvent<HTMLSelectElement>) => void
  onSync: () => void
  onCloseSync: () => void
}

export interface DeliveryZonesSectionProps {
  showZones: boolean
  zonesLoading: boolean
  zonesData: { deliveryZones?: DeliveryZoneRow[] } | DeliveryZoneRow[] | null
  showZoneForm: boolean
  zoneForm: ZoneFormState
  locations: LocationData[]
  createZonePending: boolean
  onSetZoneForm: (_updater: (_prev: ZoneFormState) => ZoneFormState) => void
  onShowZoneForm: (_show: boolean) => void
  onZoneFormSubmit: () => void
  onDeleteZone: (_zone: DeliveryZoneRow) => void
}

export interface LocationFormProps {
  showForm: boolean
  form: LocationFormState
  createPending: boolean
  onSetForm: (_updater: (_prev: LocationFormState) => LocationFormState) => void
  onFormTypeChange: (_e: React.ChangeEvent<HTMLSelectElement>) => void
  onSubmit: () => void
  onCancel: () => void
}

export interface LocationsListProps {
  locations: LocationData[]
  expandedId: string | null
  onToggleLocationActive: (_loc: LocationData) => void
  onToggleExpanded: (_locId: string) => void
  onDeleteLocation: (_loc: LocationData) => void
}

export interface DeleteDialogProps {
  deleteConfirm: DeleteConfirmState | null
  onOpenChange: (_open: boolean) => void
  onConfirmDelete: () => void
}

// Re-export ikone
export { typeIcons } from './icons'
