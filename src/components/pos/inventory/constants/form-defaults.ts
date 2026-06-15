import type { ItemFormData, RestockFormData, WriteOffFormData } from './types'

// ============================================
// PRAZNE OBLIKE ZA OBRAZCE
// ============================================

// Prazna oblika za nov artikel
export const emptyItemForm: ItemFormData = {
  name: '', description: '', image: '', unit: 'pcs', quantity: '', minQuantity: '10', costPerUnit: '',
  supplier: '', category: 'general', expiryDate: '', menuItemId: '',
  servingsPerUnit: '1', servingSize: '', costPerServing: '',
}

// Prazna oblika za nabavo
export const emptyRestockForm: RestockFormData = {
  quantity: '', costPerUnit: '', supplierDoc: '', employeeName: '', note: '',
}

// Prazna oblika za razknjižbo
export const emptyWriteOffForm: WriteOffFormData = {
  quantity: '', type: 'write-off', reason: '', note: '', employeeName: '',
}
