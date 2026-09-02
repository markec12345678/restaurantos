# Chaos Engineering Test 3.1 — Database Failure med Peak Hour

**Cilj:** Preveri ali sistem preživi padec baze med obremenitvijo in se pravilno obnovi.

## Predpogoji

1. **Vercel Production deployment** z najnovejšim commit-om (trenutno `0b9f4322`)
2. **Neon PostgreSQL** dashboard dostop (https://console.neon.tech)
3. **k6** nameščen lokalno:
   ```bash
   # macOS
   brew install k6
   # Linux
   sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A36442D57D5114F0934D9A4C2
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt update && sudo apt install k6
   ```
4. **Node.js 18+** za verification skripto

## Koraki testa

### 1. Zaženi load test (terminal 1)

```bash
k6 run \
  --env BASE_URL=https://restaurantos-7pqmhtubw-robertpezdirc12-designs-projects.vercel.app \
  --env PIN=1234 \
  /home/z/my-project/scripts/chaos/load-test.js
```

Skripta simulira **ramping load**:
- 0–10s:  10 → 30 req/s (warmup)
- 10–30s: 30 → 50 req/s (peak hour doseže)
- 30–90s: 50 req/s hold (TU SUSPENDIRAJ DB po 30s od starta!)
- 90–120s: 50 → 20 req/s (ramp-down po resume)
- 120–140s: 20 → 0 req/s (zaključi)

**Skupna dolžina:** ~140 sekund.

### 2. Po 30 sekundah suspendiraj Neon DB

**Ročno v Neon dashboard:**
1. Odpri https://console.neon.tech
2. Izberi projekt (povezan z RestaurantOS)
3. Pojdi na **Branches** → `main`
4. Klikni **Suspend** (database se ustavi, idle scale-to-zero)

**Ali preko Neon API-ja** (če imaš API key):
```bash
# Pridobi project_id in branch_id iz Neon dashboard
NEON_API_KEY=...
PROJECT_ID=...
BRANCH_ID=...

# Suspend
curl -X POST "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$BRANCH_ID/suspend" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### 3. Opazuj 60 sekund

Medtem ko je DB suspendirana, **k6 še vedno pošilja requeste**. Pričakujemo:

| Kaj | Pričakovan rezultat |
|-----|---------------------|
| HTTP status codes | 500, 502, 503 (DB nedosegljiva) |
| Error messages | `P1001`, `connection refused`, `ECONNREFUSED` |
| Latency | hitri error-ji (< 1s) |
| Outbox | nove events ostanejo `pending` (DB fail) |

k6 bo štela kot `db_errors` vse odgovore ki vsebujejo te error patterns.

### 4. Po 60 sekundah resume Neon DB

**Ročno v Neon dashboard:**
1. Klikni **Resume** (ali **Restart**) na isti branch
2. Počakaj da status postane `Active` (~10–20s)

**Ali preko API:**
```bash
curl -X POST "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$BRANCH_ID/restore" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

### 5. Počakaj da k6 konča (še ~30s)

k6 bo samodejno zaključil po ~140s. Pusti ga da konča — v tem času se bo sistem obnovil in pričakujemo da:
- Latency se povrne pod 5s P95
- HTTP req_failed rate pade pod 5%
- DB errors se ustavijo

### 6. Poženi verification skripto

```bash
node /home/z/my-project/scripts/chaos/verify-after-chaos.js \
  --base-url=https://restaurantos-7pqmhtubw-robertpezdirc12-designs-projects.vercel.app \
  --pin=1234
```

Skripta preverja:

1. **System Health** — ali `/api/health` in `/api/cron/outbox` delujeta
2. **Outbox Queue** — ali pending events čakajo na retry
3. **Journal Entries** — ali double-entry pravilo velja (debit == credit)
4. **Payments** — ali so vsa plačila konsistentna (idempotencyKey unikatni)
5. **Orders** — ali so plačani orderji v statusu `completed`

## Pass/Fail kriteriji

### CRITICAL (0 dovoljenih)
- [ ] SQL injection (preverjeno v security testih, ne chaos)
- [ ] Auth bypass (če session preživi DB restart — POMEMBNO!)
- [ ] XSS (ni relevantno za chaos)

### HIGH (< 3 dovoljenih)
- [ ] Rate limiting še vedno deluje po resume
- [ ] CSRF zaščita še vedno aktivna
- [ ] Session invalidation za terminated employees

### MEDIUM (< 10 dovoljenih)
- [ ] Information disclosure v error messages (Prisma stack traces)
- [ ] Verbose error messages razkrivajo DB strukturo
- [ ] Console.log statements v produkciji

### Chaos-specifično
- [ ] **OutboxQueue** ima < 50 pending events (po cron retry-jih)
- [ ] **Journal entries** so vsi balanced (debit == credit)
- [ ] **No duplicate payments** (idempotencyKey unikatni)
- [ ] **No orphan orders** (paid ampak ne completed)

## Pričakovani rezultati

### Če sistem DELA pravilno (PASS):

```
=== LOAD TEST SUMMARY ===

HTTP Duration:
  avg: 1.20s
  p(95): 3.80s
  p(99): 8.50s
  max: 9.95s

Failed requests: 28.45% (1,420 failed / 5,000 total)  ← pričakovano med DB down
DB errors: 1,180                                       ← pričakovano

=== THRESHOLDS ===
  ✓ PASS  http_req_failed: rate<0.05                  ← NAPAČNO! bo fail-al
  ✓ PASS  http_req_duration: p(95)<5000
  ✓ PASS  db_errors: count<100                        ← NAPAČNO! bo fail-al
```

> **Note:** Thresholds `http_req_failed<0.05` in `db_errors<100` bodo FAIL-ali med chaos testom, ker je to namerno. To je OK — chaos test NE sme pass-ati thresholdov, ker gre za namerno perturbacijo. Glavni pass/fail je verification skripta.

### Če sistem NE deluje pravilno (FAIL):

- Outbox queue poln dead_letter events (max 5 poskusov preseženih)
- Journal entries niso balanced (drift v debit/credit)
- Duplicate payments (idempotencyKey ne deluje)
- Orderji ostanejo v napačnem statusu (paid ampak ne completed)

## Known Limitations (RestaurantOS)

### 1. Outbox se trenutno NE uporablja za Order/Payment
Orders in Payments API-ji ne kličejo `createOutboxEvent`. To pomeni da:
- Če DB pade med `POST /api/orders` → request fail-a, naročilo se ne shrani nikjer
- Ni "offline queue" za naročila (samo FURS receipts imajo IndexedDB queue)

**Priporočilo za future:** dodati `createOutboxEvent` v Order/Payment API-je.

### 2. Vercel Cron outbox worker
`/api/cron/outbox` je definiran v `vercel.json` ampak **manjka v crons array**:

```json
{
  "crons": [
    { "path": "/api/scheduled-emails/process", "schedule": "0 2 * * *" }
    // MANJKA: { "path": "/api/cron/outbox", "schedule": "*/5 * * * *" }
  ]
}
```

Outbox se torej ne procesira avtomatsko. Ročno ga lahko prožiš z:
```bash
curl -X POST https://restaurantos-...vercel.app/api/cron/outbox \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 3. Neon free plan auto-suspend
Neon free plan samodejno suspendira DB po 5 minutah nedejavnosti. To je normalno in ni chaos test — pravi chaos test zahteva da **ročno** suspendiraš med loadom.

### 4. Vercel Hobby function timeout (10s)
Katera koli API funkcija ki traja > 10s bo Vercel ubil. K6 timeout je zato 10s.

## Recovery strategija

Če verification skripta pokaže FAIL:

1. **Outbox poln dead_letter events:**
   ```bash
   # Ročno retry vseh dead_letter events
   curl -X POST https://...vercel.app/api/outbox/retry-all \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Unbalanced journal entries:**
   ```bash
   # Poišči najnovejši payment brez journal entry-ja
   # in ga ročno generiraj
   curl -X POST https://...vercel.app/api/accounting/journal/regenerate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"referenceType":"payment","afterDate":"2026-09-01"}'
   ```

3. **Duplicate payments:**
   - Poišči payments z istim `idempotencyKey` ali `checkId + amount + createdAt` v istem oknu
   - Vendi (void) duplikate preko `/api/payments/[id]/void`

## Arhiviranje rezultatov

Po testu shrani rezultate v:
- `tests/chaos/results/load-test-YYYYMMDD.json` — k6 raw output
- `tests/chaos/results/verify-YYYYMMDD.txt` — verification output
- `docs/E2E-TEST-RESULTS.md` — dodaj sekcijo "Chaos Test 3.1"
