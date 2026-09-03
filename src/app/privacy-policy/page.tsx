export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Politika zasebnosti — RestaurantOS',
  description: 'GDPR politika zasebnosti za RestaurantOS',
  robots: 'index, follow',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politika zasebnosti (GDPR)</h1>
        <p className="text-sm text-gray-500 mb-8">Velja od: 1. september 2026 | RestaurantOS | SI12345678</p>
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Uvod</h2>
            <p className="text-sm">Ta politika zasebnosti opisuje kako RestaurantOS zbira, uporablja in varuje vaše osebne podatke v skladu z GDPR (Uredba (EU) 2016/679) in ZVOP-1.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Osebni podatki</h2>
            <p className="text-sm"><strong>Stranke:</strong> ime, telefon, e-pošta, zgodovina naročil, podatki o zvestobi.</p>
            <p className="text-sm mt-1"><strong>Zaposleni:</strong> ime, e-pošta, PIN (bcrypt hashirana), vloga, IP naslov.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Pravna osnova</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Izvedba naročila: Pogodba (Art. 6(1)(b))</li>
              <li>Varnost in audit: Legitimni interes (Art. 6(1)(f))</li>
              <li>FURS davčno potrjevanje: Zakonska obveznost (Art. 6(1)(c))</li>
              <li>Program zvestobe: Privolitev (Art. 6(1)(a))</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Čas hrambe</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Računi in FURS: 10 let (ZDDV-1)</li>
              <li>Audit log: 10 let (PCI DSS)</li>
              <li>Zgodovina naročil: 2 leti</li>
              <li>Podatki zaposlenih: 5 let po prekinitvi</li>
              <li>Session: 8 ur</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Delitev s tretjimi osebami</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>FURS (ZDDV-1 obveznost)</li>
              <li>Neon PostgreSQL (EU Frankfurt)</li>
              <li>Vercel (EU Frankfurt)</li>
              <li>Sentry (EU Deutschland)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Vaše pravice (GDPR)</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Dostop (Art. 15)</li>
              <li>Popravek (Art. 16)</li>
              <li>Izbris (Art. 17) — z omejitvami za FURS</li>
              <li>Omejitev (Art. 18)</li>
              <li>Prenosljivost (Art. 20)</li>
              <li>Ugovor (Art. 21)</li>
              <li>Preklic privolitve (Art. 7(3))</li>
            </ul>
            <p className="text-sm mt-2">Kontakt: <a href="mailto:privacy@restaurantos.app" className="text-amber-600 underline">privacy@restaurantos.app</a></p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Varnost</h2>
            <p className="text-sm">TLS 1.3, bcrypt, HMAC-SHA256, rate limiting, CSP, HSTS, chain hash audit log, multi-tenant isolation.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Piškotki</h2>
            <p className="text-sm"><strong>Nujni:</strong> NEXT_LOCALE, pos_auth_token (brez privolitve)</p>
            <p className="text-sm"><strong>Analitski:</strong> Sentry Replay (1%), Vercel Analytics (s privolitvom)</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Kontakt</h2>
            <p className="text-sm">E-pošta: privacy@restaurantos.app</p>
            <p className="text-sm">DPO: dpo@restaurantos.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
