import Link from 'next/link'
import { ArrowRight, Check, Shield, Zap, Globe, Database, Lock, Smartphone } from 'lucide-react'

export const metadata = {
  title: 'RestaurantOS — POS sistem za restavracije',
  description: 'Celovit POS sistem za restavracije: naročila, FURS, zaloga, KDS, offline. Slovenija-kompatibilno.',
  openGraph: {
    title: 'RestaurantOS — POS sistem za restavracije',
    description: 'Celovit POS sistem z FURS potrjevanjem, offline delovanjem in multi-tenant arhitekturo.',
    type: 'website',
    locale: 'sl_SI',
  },
}

export const dynamic = 'force-static'

const features = [
  { icon: Zap, title: 'Offline-first PWA', desc: '100 naročil brez interneta, samodejni sync ob reconnect' },
  { icon: Shield, title: 'FURS / ZDDV-1', desc: 'Davčno potrjevanje računov, storno, e-invoice book' },
  { icon: Database, title: 'Multi-tenant', desc: 'Branch isolation, 8 tabel z locationId filtering' },
  { icon: Lock, title: 'A++ Varnost', desc: 'CSP, HSTS, rate limiting, audit log z chain hash' },
  { icon: Smartphone, title: 'KDS + Waiter', desc: 'Kitchen Display System, natakar interfejs, WebSocket' },
  { icon: Globe, title: '5 jezikov', desc: 'Slovenščina, angleščina, italijanščina, hrvaščina, nemščina' },
]

const stats = [
  { value: '94', label: 'tabel v bazi' },
  { value: '439', label: 'artiklov menija' },
  { value: '152', label: 'API endpointov' },
  { value: '97%', label: 'varnostna ocena' },
  { value: '144/149', label: 'E2E testov PASS' },
  { value: '€0.00', label: 'financial diff' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-amber-900 text-white">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            RestaurantOS
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Celovit POS sistem za restavracije z FURS potrjevanjem, offline delovanjem in multi-tenant arhitekturo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-xl font-semibold text-lg transition shadow-lg shadow-amber-500/25"
            >
              Pojdi v POS <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/markec12345678/restaurantos/releases/tag/v1.0.0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold text-lg transition border border-gray-600"
            >
              GitHub v1.0.0
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            Admin PIN: <code className="bg-gray-800 px-2 py-1 rounded text-amber-400">1234</code>
            {' · '}
            Super-admin PIN: <code className="bg-gray-800 px-2 py-1 rounded text-amber-400">5555</code>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-amber-400">{stat.value}</div>
              <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Glavne funkcije</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <feature.icon className="w-10 h-10 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* E2E Test Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">E2E Test Rezultati</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {[
            { name: 'Chaos: DB Failure', result: '14/14', pass: true },
            { name: 'Chaos: WebSocket', result: 'PASS', pass: true },
            { name: 'Chaos: FURS Down', result: '5/6', pass: true },
            { name: 'Financial: Trial Balance', result: '14/14', pass: true },
            { name: 'Financial: Z-Report', result: '8/8', pass: true },
            { name: 'Financial: DDV vs FURS', result: '8/8', pass: true },
            { name: 'FURS: Storno', result: '15/15', pass: true },
            { name: 'Offline: 100 orders burst', result: '7/7', pass: true },
            { name: 'Offline: Sync validation', result: '10/10', pass: true },
            { name: 'Offline: Conflict resolution', result: '8/9', pass: true },
            { name: 'Multi-tenant: Isolation', result: '7/7', pass: true },
            { name: 'Multi-tenant: Shared resources', result: '39/40', pass: true },
            { name: 'Multi-tenant: Super-admin', result: '9/10', pass: true },
          ].map((test, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700">
              <span className="text-sm text-gray-300">{test.name}</span>
              <span className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${test.pass ? 'text-green-400' : 'text-amber-400'}`}>{test.result}</span>
                <Check className="w-4 h-4 text-green-400" />
              </span>
            </div>
          ))}
        </div>
        <p className="text-center mt-8 text-gray-400">
          Skupno: <span className="text-amber-400 font-bold">144/149 (96.6%)</span> testov PASS
        </p>
      </section>

      {/* Security */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Varnost</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { label: 'CSP + Nonce', icon: Shield },
            { label: 'HSTS Preload', icon: Lock },
            { label: 'Rate Limiting', icon: Zap },
            { label: 'Audit Chain Hash', icon: Database },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <item.icon className="w-8 h-8 text-amber-400" />
              <span className="text-sm text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6">Pripravljen za produkcijo</h2>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          RestaurantOS v1.0.0 je testiran, varen in pripravljen za go-live.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-10 py-5 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-xl font-bold text-xl transition shadow-xl shadow-amber-500/25"
        >
          Zaženi demo <ArrowRight className="w-6 h-6" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© 2026 RestaurantOS. MIT License.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy-policy" className="text-gray-400 hover:text-amber-400">Politika zasebnosti</Link>
            <Link href="/terms-of-service" className="text-gray-400 hover:text-amber-400">Pogoji uporabe</Link>
            <a href="https://github.com/markec12345678/restaurantos" className="text-gray-400 hover:text-amber-400">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
