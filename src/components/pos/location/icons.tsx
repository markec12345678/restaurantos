// ============================================
// IKONE PO TIPU LOKACIJE
// ============================================

import { UtensilsCrossed, Wine, Truck, Coffee, ShoppingBag } from 'lucide-react'

// Ikone po tipu lokacije
export const typeIcons: Record<string, React.ReactNode> = {
  restaurant: <UtensilsCrossed className="h-4 w-4" />,
  bar: <Wine className="h-4 w-4" />,
  food_truck: <Truck className="h-4 w-4" />,
  pop_up: <Coffee className="h-4 w-4" />,
  cloud_kitchen: <ShoppingBag className="h-4 w-4" />,
}
