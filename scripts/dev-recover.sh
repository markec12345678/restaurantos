#!/bin/bash
# ============================================
# RestaurantOS — DEV OKREVANJE (recovery script)
# QA 2026-09-17, runda 4
# ============================================
# Požene celoten cikel重建 razvojne baze in strežnika po OOM/pokvari PGlite:
#   1. Ustavi dev strežnik (SIGTERM, nato SIGKILL)
#   2. Re-inicializira PGlite (deterministični E2E seed — admin PIN 1111)
#   3. seed-admin.mjs (pinLookup s sandbox NEXTAUTH_SECRET iz .env!)
#   4. Zažene strežnik in SEKVENČNO segreje rute
#      (vzporedne zahtevke = vzporedne Turbopack kompilacije = OOM!)
#   5. Požene polni /api/seed (437 artiklov, demo naročila)
#
# Uporaba:  bash scripts/dev-recover.sh [--minimal]
#   --minimal : brez polnega 437-artikelnega seeda (samo E2E baza)
# ============================================
set -u
cd "$(dirname "$0")/.."
PORT=3001
MINIMAL=false
[ "${1:-}" = "--minimal" ] && MINIMAL=true

log() { echo "[recover $(date +%H:%M:%S)] $*"; }

# ── 1. Ustavi strežnik ──────────────────────────────────────────
log "Ustavljam obstoječi strežnik..."
pkill -f "next dev -p $PORT" 2>/dev/null
sleep 2
pkill -9 -f "next dev -p $PORT" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 1

# ── 2. Sveža baza (deterministični E2E seed) ────────────────────
log "Re-inicializiram PGlite bazo (init-e2e-db)..."
PGLITE_DATA_DIR="/home/z/restaurantos/pglite-data" node scripts/init-e2e-db.mjs 2>&1 | grep -E "✅|⚠|Error|error" | tail -6

# ── 3. Admin pinLookup z PRAVIM secretom ───────────────────────
# init-e2e-db uporablja privzeti NEXTAUTH_SECRET, strežnik pa bere .env
# (sandbox-test-secret-...) — pinLookup HMAC mora biti enak!
log "Seed admin PIN 1111 (sandbox secret)..."
node seed-admin.mjs 2>&1 | tail -1

# ── 4. Zaženi strežnik + sekvenčno segrevanje ──────────────────
log "Začenjam dev strežnik na portu $PORT..."
PGLITE_DATA_DIR="/home/z/restaurantos/pglite-data" LOGIN_RATE_LIMIT_MAX=30 \
  setsid nohup bunx next dev -p $PORT > dev-restaurantos.log 2>&1 < /dev/null &
disown

start_wait() {
  for _ in $(seq 1 40); do
    sleep 2
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$PORT/" 2>/dev/null)" = "200" ] && return 0
  done
  return 1
}
start_wait || { log "FATAL: strežnik se ni zagnal — glej dev-restaurantos.log"; exit 1; }
log "Strežnik teče. Sekvenčno segrevam rute (NE vzporedno — OOM!)..."

TOKEN=""
for route in / /api/setup/status /api/auth /api/menu-items /api/categories /api/menus /api/tables /api/orders /api/kitchen /api/inventory /api/dashboard /api/reports/popular /api/food-cost /api/notifications; do
  if [ -z "$TOKEN" ] && [ "$route" = "/api/auth" ]; then
    TOKEN=$(curl -s --max-time 90 -X POST "http://localhost:$PORT/api/auth" -H "Content-Type: application/json" -d '{"pin":"1111"}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
    log "/api/auth → login $([ -n '$TOKEN' ] && echo OK || echo FAIL)"
    continue
  fi
  AUTH=()
  [ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 110 "${AUTH[@]}" "http://localhost:$PORT$route" 2>/dev/null)
  if [ -z "$code" ] || [ "$code" = "000" ]; then
    log "$route → STREŽNIK UMRL — ponovni zagon..."
    pkill -f "next dev -p $PORT" 2>/dev/null; sleep 3
    PGLITE_DATA_DIR="/home/z/restaurantos/pglite-data" LOGIN_RATE_LIMIT_MAX=30 \
      setsid nohup bunx next dev -p $PORT > dev-restaurantos.log 2>&1 < /dev/null &
    disown
    start_wait || { log "FATAL: ponovni zagon ni uspel"; exit 1; }
    # Po restartu je token (in-memory seje) ponavadi še veljaven (SQLite seje)
    TOKEN=$(curl -s --max-time 90 -X POST "http://localhost:$PORT/api/auth" -H "Content-Type: application/json" -d '{"pin":"1111"}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 110 -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT$route" 2>/dev/null)
  fi
  log "$route → $code"
done

# ── 5. Polni seed (437 artiklov) ───────────────────────────────
if [ "$MINIMAL" = "false" ] && [ -n "$TOKEN" ]; then
  log "Poženem polni /api/seed (437 artiklov, demo podatki)..."
  code=$(curl -s -o /tmp/seed-result.json -w "%{http_code}" --max-time 280 \
    -X POST "http://localhost:$PORT/api/seed" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" 2>/dev/null)
  log "/api/seed → $code ($(head -c 120 /tmp/seed-result.json 2>/dev/null))"
else
  log "--minimal: preskočim polni seed"
fi

log "OKREVANJE DOKONČANA ✓  (prijava: PIN 1111)"
