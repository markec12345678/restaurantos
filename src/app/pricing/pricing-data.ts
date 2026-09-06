// =====================================================================
// RESTAURANTOS PRICING — Data & Types
// =====================================================================

export interface PlanFeature {
  text: string
  included: boolean
}

export interface Plan {
  key: string
  name: string
  price: number
  description: string
  icon: string
  color: string
  borderColor: string
  popular: boolean
  features: PlanFeature[]
}

export interface Testimonial {
  name: string
  location: string
  text: string
  rating: number
}

export interface Feature {
  icon: string
  title: string
  desc: string
}

export const plans: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 0,
    description: 'Brezplačno za prvo lokacijo (AGPL-3.0 open source)',
    icon: '🚀',
    color: 'from-blue-500 to-blue-600',
    borderColor: 'border-blue-200',
    popular: false,
    features: [
      { text: '1 lokacija', included: true },
      { text: 'FURS davčno potrjevanje', included: true },
      { text: 'QR meni za goste', included: true },
      { text: 'Poročila in izpiski', included: true },
      { text: 'Upravljanje zaloge', included: true },
      { text: 'HACCP dnevniki', included: true },
      { text: 'Do 200 artiklov', included: true },
      { text: 'Community podpora (GitHub)', included: true },
      { text: 'AGPL-3.0 (source disclosure required)', included: true },
      { text: 'Online naročanje', included: false },
      { text: 'Integracije', included: false },
      { text: 'AI napovedi', included: false },
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 200,
    description: 'Commercial license — €200/location/month',
    icon: '⭐',
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-300',
    popular: true,
    features: [
      { text: 'Vse iz Starter', included: true },
      { text: 'Commercial license (no AGPL)', included: true },
      { text: 'Online naročanje z dostavo', included: true },
      { text: 'Integracije (e-Računi, Wolt, Glovo)', included: true },
      { text: 'AI napovedi prodaje', included: true },
      { text: 'Do 1.000 artiklov', included: true },
      { text: 'Multi-izmena blagajna', included: true },
      { text: 'Priority email podpora (24h)', included: true },
      { text: 'White-label odstranitev', included: false },
      { text: 'API dostop', included: false },
      { text: 'Custom integracije', included: false },
    ],
  },
  {
    key: 'chain',
    name: 'Chain',
    price: 2000,
    description: 'Do 20 lokacij — €2.000/mesec',
    icon: '🏢',
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-300',
    popular: false,
    features: [
      { text: 'Vse iz Professional', included: true },
      { text: 'Do 20 lokacij', included: true },
      { text: 'Centralizirano upravljanje', included: true },
      { text: 'Cross-location poročila', included: true },
      { text: 'API dostop', included: true },
      { text: 'Slack podpora (Priority tier)', included: true },
      { text: 'SLA 99.5% uptime', included: true },
      { text: 'White-label odstranitev', included: true },
      { text: 'Dedicated account manager', included: false },
      { text: 'Custom development', included: false },
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: -1,
    description: '50+ lokacij — Custom pricing (volume discounts)',
    icon: '👑',
    color: 'from-purple-600 to-indigo-700',
    borderColor: 'border-purple-300',
    popular: false,
    features: [
      { text: 'Vse iz Chain', included: true },
      { text: 'Neomejene lokacije', included: true },
      { text: 'Neomejeni artikli', included: true },
      { text: 'Stripe plačilna integracija', included: true },
      { text: 'Custom integracije', included: true },
      { text: 'Dedicated podpora (24/7 P1)', included: true },
      { text: 'SLA 99.9% razpoložljivost', included: true },
      { text: 'Multi-tenant upravljanje', included: true },
      { text: 'White-label možnost', included: true },
      { text: 'On-site namestitev + usposabljanje', included: true },
      { text: 'Custom development (quarterly)', included: true },
    ],
  },
]

export const testimonials: Testimonial[] = [
  { name: 'Gostilna pri Jožetu', location: 'Ljubljana', text: 'FURS potrjevanje deluje brezhibno. Končno imamo POS, ki razume slovenske predpise.', rating: 5 },
  { name: 'Restavracija Primorska', location: 'Koper', text: 'Online naročanje nam je povečalo prihodek za 30%. Zelo enostavna namestitev.', rating: 5 },
  { name: 'Picerija La Dolce', location: 'Maribor', text: 'AI napovedi nam pomagajo optimizirati zalogo. Nič več zaloge, ki se pokvari.', rating: 5 },
]

export const features: Feature[] = [
  { icon: '🇸🇮', title: 'FURS potrjevanje', desc: 'Edini POS na svetu z vgrajenim FURS potrjevanjem. ZOI, EOR, QR koda — vse avtomatsko.' },
  { icon: '📱', title: 'QR meni + online', desc: 'Gosti naročijo direktno iz telefona. QR meni ali online naročanje z dostavo na dom.' },
  { icon: '🤖', title: 'AI napovedi', desc: 'Napovedi prodaje, zaloge in osebja. Pametni predlogi za upselling in optimizacijo.' },
  { icon: '📊', title: 'Poročila 2.0', desc: 'DDV razčlenitev, napitnine po zaposlenih, toplotna karta, izpiski za knjiženje.' },
  { icon: '🔒', title: 'Offline PWA', desc: 'Deluje tudi brez interneta. Service Worker zagotavlja neprekinjeno poslovanje.' },
  { icon: '🌍', title: '5 jezikov', desc: 'Slovenščina, angleščina, italijanščina, hrvaščina, nemščina — za turistične kraje.' },
]
