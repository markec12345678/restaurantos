// Paketi in ceniki

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    features: ['1 lokacija', 'FURS potrjevanje', 'QR meni', 'Poročila', 'Zaloga', 'HACCP dnevniki', 'E-poštna podpora'],
    maxLocations: 1,
    maxMenuItems: 200,
  },
  professional: {
    name: 'Professional',
    price: 49,
    features: ['Vse iz Starter', '3 lokacije', 'Online naročanje', 'Integracije (e-Računi, Wolt, Glovo)', 'AI napovedi', 'Multi-izmena', 'Priority podpora'],
    maxLocations: 3,
    maxMenuItems: 1000,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    features: ['Vse iz Professional', 'Neomejene lokacije', 'API dostop', 'Stripe plačila', 'Custom integracije', 'Dedicated podpora', 'SLA 99.9%'],
    maxLocations: -1,
    maxMenuItems: -1,
  },
} as const

export type PlanKey = keyof typeof PLANS
