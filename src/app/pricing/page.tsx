'use client'

import { useState } from 'react'

// =====================================================================
// RESTAURANTOS PRICING PAGE — Javna stran s ceniki
// Za trženje SaaS naročnine restavracijam
// =====================================================================

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    description: 'Za manjše restavracije in gostilne',
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
      { text: 'E-poštna podpora', included: true },
      { text: 'Online naročanje', included: false },
      { text: 'Integracije', included: false },
      { text: 'AI napovedi', included: false },
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 49,
    description: 'Za rastoče restavracije z več lokacijami',
    icon: '⭐',
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-300',
    popular: true,
    features: [
      { text: 'Vse iz Starter', included: true },
      { text: '3 lokacije', included: true },
      { text: 'Online naročanje z dostavo', included: true },
      { text: 'Integracije (e-Računi, Wolt, Glovo)', included: true },
      { text: 'AI napovedi prodaje', included: true },
      { text: 'Do 1.000 artiklov', included: true },
      { text: 'Multi-izmena blagajna', included: true },
      { text: 'Priority podpora', included: true },
      { text: 'Neomejene lokacije', included: false },
      { text: 'API dostop', included: false },
      { text: 'Custom integracije', included: false },
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 99,
    description: 'Za verige restavracij in velike operacije',
    icon: '👑',
    color: 'from-purple-600 to-indigo-700',
    borderColor: 'border-purple-300',
    popular: false,
    features: [
      { text: 'Vse iz Professional', included: true },
      { text: 'Neomejene lokacije', included: true },
      { text: 'Neomejeni artikli', included: true },
      { text: 'API dostop', included: true },
      { text: 'Stripe plačilna integracija', included: true },
      { text: 'Custom integracije', included: true },
      { text: 'Dedicated podpora', included: true },
      { text: 'SLA 99.9% razpoložljivost', included: true },
      { text: 'Multi-tenant upravljanje', included: true },
      { text: 'White-label možnost', included: true },
      { text: 'On-site namestitev', included: true },
    ],
  },
]

const testimonials = [
  { name: 'Gostilna pri Jožetu', location: 'Ljubljana', text: 'FURS potrjevanje deluje brezhibno. Končno imamo POS, ki razume slovenske predpise.', rating: 5 },
  { name: 'Restavracija Primorska', location: 'Koper', text: 'Online naročanje nam je povečalo prihodek za 30%. Zelo enostavna namestitev.', rating: 5 },
  { name: 'Picerija La Dolce', location: 'Maribor', text: 'AI napovedi nam pomagajo optimizirati zalogo. Nič več zaloge, ki se pokvari.', rating: 5 },
]

const features = [
  { icon: '🇸🇮', title: 'FURS potrjevanje', desc: 'Edini POS na svetu z vgrajenim FURS potrjevanjem. ZOI, EOR, QR koda — vse avtomatsko.' },
  { icon: '📱', title: 'QR meni + online', desc: 'Gosti naročijo direktno iz telefona. QR meni ali online naročanje z dostavo na dom.' },
  { icon: '🤖', title: 'AI napovedi', desc: 'Napovedi prodaje, zaloge in osebja. Pametni predlogi za upselling in optimizacijo.' },
  { icon: '📊', title: 'Poročila 2.0', desc: 'DDV razčlenitev, napitnine po zaposlenih, toplotna karta, izpiski za knjiženje.' },
  { icon: '🔒', title: 'Offline PWA', desc: 'Deluje tudi brez interneta. Service Worker zagotavlja neprekinjeno poslovanje.' },
  { icon: '🌍', title: '5 jezikov', desc: 'Slovenščina, angleščina, italijanščina, hrvaščina, nemščina — za turistične kraje.' },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">R</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RestaurantOS</h1>
              <p className="text-xs text-gray-500">POS za slovenske restavracije</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/order" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Online naročanje</a>
            <a href="/qr-menu" className="text-sm text-gray-600 hover:text-gray-800 font-medium">QR meni</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-6">
          🇸🇮 Edini POS z vgrajenim FURS potrjevanjem
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          POS sistem, ki razume<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">slovenske predpise</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Od FURS potrjevanja do HACCP dnevnikov, od QR menija do AI napovedi — vse v enem sistemu.
          10-15x cenejše od Toast ali Square, z lokalno podporo.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setAnnual(!annual)}
            className="flex items-center gap-3 text-sm"
          >
            <span className={!annual ? 'font-bold text-gray-900' : 'text-gray-500'}>Mesečno</span>
            <div className={`w-12 h-6 rounded-full transition-colors ${annual ? 'bg-green-500' : 'bg-gray-300'} relative`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
            <span className={annual ? 'font-bold text-gray-900' : 'text-gray-500'}>
              Letno <span className="text-green-600 text-xs font-medium">-20%</span>
            </span>
          </button>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const monthlyPrice = annual ? Math.round(plan.price * 0.8) : plan.price
            return (
              <div key={plan.key} className={`relative bg-white rounded-2xl border-2 ${plan.popular ? plan.borderColor : 'border-gray-100'} shadow-lg ${plan.popular ? 'shadow-amber-200/50 scale-105' : ''} overflow-hidden`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    NAJPOPULARNEJE
                  </div>
                )}
                <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{plan.icon}</span>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">€{monthlyPrice}</span>
                    <span className="text-gray-500 text-sm">/mesec</span>
                    {annual && <p className="text-xs text-green-600 mt-1">Prihranek €{(plan.price * 12 - monthlyPrice * 12).toFixed(0)}/leto</p>}
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {f.included ? (
                          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0">—</span>
                        )}
                        <span className={f.included ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-3 rounded-xl font-semibold transition ${
                    plan.popular
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    Začni 14-dnevni preizkus
                  </button>
                  <p className="text-xs text-center text-gray-400 mt-2">Brez kreditne kartice • Prekliči kadarkoli</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Zakaj RestaurantOS?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition">
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h4 className="font-bold text-lg mb-2">{f.title}</h4>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Kaj pravijo uporabniki</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(t.rating)].map((_, j) => (
                  <span key={j} className="text-amber-400">★</span>
                ))}
              </div>
              <p className="text-sm text-gray-700 mb-4 italic">"{t.text}"</p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-gray-500">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">Pripravljeni na začetek?</h3>
          <p className="text-lg mb-6 text-amber-100">14-dnevni brezplačni preizkus. Brez kreditne kartice.</p>
          <button className="bg-white text-amber-700 px-8 py-3 rounded-xl font-bold text-lg hover:bg-amber-50 transition shadow-lg">
            Začni zdaj →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© 2026 RestaurantOS — POS sistem za slovenske restavracije</p>
          <p className="mt-1">FURS potrjevanje • HACCP dnevniki • DDV 22%/9.5%/0% • PWA offline</p>
        </div>
      </footer>
    </div>
  )
}
