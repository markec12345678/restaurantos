export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pogoji uporabe — RestaurantOS',
  description: 'Terms of Service za RestaurantOS',
  robots: 'index, follow',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pogoji uporabe (Terms of Service)</h1>
        <p className="text-sm text-gray-500 mb-8">Velja od: 1. september 2026 | RestaurantOS | SI12345678</p>
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Definicije</h2>
            <p className="text-sm">RestaurantOS — SaaS za upravljanje restavracij (POS, KDS, FURS, zaloga). Uporabnik — pravna ali fizična oseba, ki uporablja RestaurantOS.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Predmet pogodbe</h2>
            <p className="text-sm">RestaurantOS omogoča: sprejemanje naročil, FURS potrjevanje, upravljanje zalog, računovodska poročila, multi-lokacijsko upravljanje, offline delovanje.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Registracija in dostop</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Prijava z osebnim PIN-om (bcrypt + HMAC-SHA256)</li>
              <li>Seja poteče po 8 urah (24h absolutni maksimum)</li>
              <li>5 neuspelih poskusov → 15 min blokada</li>
              <li>Audit log zabeleži vsako dejanje (chain hash)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. FURS skladnost (ZDDV-1)</h2>
            <p className="text-sm">Avtomatsko pošiljanje računov FURS-u. Offline queue (IndexedDB) z 48h rokom. Storno z referenco na original.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Plačila in cenik</h2>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Starter: €0/mesec (Hobby plan)</li>
              <li>Pro: €20/mesec (1-min cron, 60s timeout)</li>
              <li>Enterprise: po dogovoru</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Podatki in lastnina</h2>
            <p className="text-sm">Poslovni podatki so last uporabnika. Izvoz podatkov (JSON/CSV) kadarkoli. Po prekinitvi: 30-dnevni grace period.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Omejitev odgovornosti</h2>
            <p className="text-sm">RestaurantOS ni odgovoren za izgubo dobička, kazni FURS zaradi nepravilne konfiguracije, ali izgubo podatkov zaradi sile višje. Največja odgovornost: znesek zadnje mesečne naročnine.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Prekinitev</h2>
            <p className="text-sm">Uporabnik: 30-dnevni notice. RestaurantOS: 7-dnevni notice pri kršitvi. 30-dnevni grace period za izvoz podatkov.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Pravo</h2>
            <p className="text-sm">Slovensko pravo. Pristojno sodišče: Okrožno sodišče Ljubljana.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Kontakt</h2>
            <p className="text-sm">E-pošta: <a href="mailto:legal@restaurantos.app" className="text-amber-600 underline">legal@restaurantos.app</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
