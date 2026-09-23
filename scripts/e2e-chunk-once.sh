#!/bin/bash
# E2E chunk-ONCE — poženi TOČNO določene spec-e (1 klic = 1-2 spec-a).
#
# Kanon (4GB sandbox OOM mitigation):
#   Faza 1 (COMPILE server): init-db + dev + warm-up VSEH rut spec-a.
#     Turbopack kompajla rute v TEM procesu (RSS vrh ~3GB — nehote, a tu je
#     prostor, ker testi ne tečejo). Kompilirani chunki se persistirajo v
#     .next/dev/build → disk cache.
#   Faza 2 (TEST server): init-db (sveži podatki; .next cache OSTANE) + dev +
#     hitri warm-up (reload iz diska: +30-100MB/ruto namesto +1-2GB kompilacije)
#     + playwright run. RSS ostane pod OOM linijo.
#
# Rezultati se ZBIERAJO v /tmp/e2e-chunk-results.txt (persist čez klice).
# PLAYWRIGHT_GREP: opcijski --grep filter (razdelitev velikih specov).
cd /home/z/my-project
RESULT_FILE=/tmp/e2e-chunk-results.txt

kill_all() {
  pkill -9 -f 'next dev' 2>/dev/null
  pkill -9 -f processChild 2>/dev/null
  pkill -9 -f 'next-server' 2>/dev/null
  sleep 4
  P=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$P" ] && kill -9 "$P" 2>/dev/null
  sleep 1
}

start_server() {
  # SIGKILL pusti PGlite dir dirty (WASM crash-recovery abort) — VEDNO init
  # pred startom (wipe + DDL + seed; .next turbopack cache ni v data dir-u).
  PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data NEXTAUTH_SECRET=e2e-test-secret-only node scripts/init-e2e-db.mjs > /tmp/e2e-init.log 2>&1
  (NODE_OPTIONS=--max-old-space-size=1536 DATABASE_URL='' PGLITE_DATA_DIR=/home/z/my-project/pglite-e2e-data FURS_ENV=test FURS_ALLOW_SIMULATION=true NEXTAUTH_SECRET=e2e-test-secret-only WS_BROADCAST_SECRET=e2e-test-secret-only API_RATE_LIMIT_MAX=600 LOGIN_RATE_LIMIT_MAX=200 WEBAUTHN_ENABLED=true bun run dev > /tmp/e2e-dev.log 2>&1 &)
  ok=0
  for i in $(seq 1 14); do
    sleep 5
    h=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/api/health)
    [ "$h" = "200" ] && ok=1 && break
  done
  [ "$ok" = "1" ]
}

# Warm-up: GET na vsako statično pot iz spec-a (brez auth → 401, a route se
# VSEENO kompajla/reloada; 405 za POST-only). BREZ mutacije stanja.
# Pokriva API rute („${API_BASE}/x") IN UI strani (request.get('/qr-menu')).
warm_routes() {
  local spec="$1"
  local warm_paths
  warm_paths=$({
    # R114: `${id}` → `_warm` (prej je bilo odstranjeno) — dinamične [id] rute se
    # ZDAJ tudi kompajlajo v warm-up fazi (prej je PATCH/PUT na [id] rutah
    # kompajlal šele test → RSS burst → OOM kill → "socket hang up" v runu).
    rg -o '\$\{API_BASE\}/[a-zA-Z0-9/_{}.$-]+' "$spec" 2>/dev/null | sed 's|\${API_BASE}/||; s|\${[^}]*}|_warm|g' | grep -v '_warm/_warm' | grep -v '^$' | sed 's|^|api/|'
    rg -o "request\.(get|post|put|delete|patch)\('[^']+'" "$spec" 2>/dev/null | sed "s|.*('\(/\?[^']*\)'.*|\1|; s|^/||" | grep -v '^$\|^?' | sed 's|^|page/|'
  } | sort -u | head -60)
  [ -n "$warm_paths" ] || return 0
  while IFS= read -r p; do
    case "$p" in
      api/*)  curl -s -o /dev/null -m 90 "http://localhost:3000/api/${p#api/}" ;;
      page/*) curl -s -o /dev/null -m 90 "http://localhost:3000/${p#page/}" ;;
    esac
    sleep 0.3
  done <<< "$warm_paths"
  sleep 1
}

for name in "$@"; do
  spec="tests/e2e/$name"
  if [ ! -f "$spec" ]; then
    echo "[$name] MISSING SPEC"
    continue
  fi
  # ── FAZA 1: COMPILE server ──
  kill_all
  if ! start_server; then
    echo "[$name] SERVER FAILED — retry once"
    kill_all
    if ! start_server; then
      echo "[$name] SERVER FAILED TO START"
      echo "$name SERVER-FAIL" >> "$RESULT_FILE"
      continue
    fi
  fi
  warm_routes "$spec"
  kill_all

  # ── FAZA 2: TEST server ──
  if ! start_server; then
    echo "[$name] TEST SERVER FAILED"
    echo "$name SERVER-FAIL" >> "$RESULT_FILE"
    continue
  fi
  warm_routes "$spec"   # reload iz diska (cenejše) — zagotovi, da so vse rute
                        # naložene PRED testi (noben compile burst sredi teka)

  if [ -n "$PLAYWRIGHT_GREP" ]; then
    out=$(bun run test:e2e -- "$spec" --grep "$PLAYWRIGHT_GREP" 2>&1 | tail -40)
  else
    out=$(bun run test:e2e -- "$spec" 2>&1 | tail -40)
  fi
  p=$(echo "$out" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
  f=$(echo "$out" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
  p=${p:-0}; f=${f:-0}
  if [ "$f" = "0" ]; then
    echo "[$name] OK ($p passed)"
    echo "$name OK ($p passed)" >> "$RESULT_FILE"
  else
    echo "[$name] FAILED ($f failed, $p passed)"
    echo "$name FAILED ($f failed, $p passed)" >> "$RESULT_FILE"
    echo "$out" | grep -B1 -A10 'Error:' | head -30
  fi
  kill_all
done
