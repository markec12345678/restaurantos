#!/bin/bash
# ============================================
# ensure-dev.sh — poskrbi, da dev strežnik TEČE
# (sandbox reapa ozadnje procese ob pritisku na node;
#  rute so že kompilirane, zato je restart hiter)
# NOTE runda 12: TESTIRANO — zagon prek server.js (custom server) v devu NE
# deluje (Next 16.3.4: RSC hidracija se ne zaključi, stran zataki na loading).
# Dev ostane na `bunx next dev`; WS ostane produkciski-only (glej server.js NOTE).
# Uporaba: bash scripts/ensure-dev.sh   → izpiše HTTP status + shrani token v /tmp/rtoken
# ============================================
cd "$(dirname "$0")/.."
PORT=3001

alive() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "http://localhost:$PORT/" 2>/dev/null)" = "200" ]
}

if ! alive; then
  pkill -9 -f "next dev -p $PORT" 2>/dev/null
  pkill -9 -f "node server.js" 2>/dev/null
  pkill -9 -f next-server 2>/dev/null
  sleep 1
  PGLITE_DATA_DIR="$(pwd)/pglite-data" LOGIN_RATE_LIMIT_MAX=30 \
    nohup bunx next dev -p $PORT > dev-restaurantos.log 2>&1 &
  for _ in $(seq 1 30); do
    sleep 2
    alive && break
  done
fi

if alive; then
  TOKEN=$(curl -s --max-time 60 -X POST "http://localhost:$PORT/api/auth" \
    -H "Content-Type: application/json" -d '{"pin":"1111"}' \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
  [ -n "$TOKEN" ] && echo "$TOKEN" > /tmp/rtoken
  echo "OK status=200 token=$([ -n "$TOKEN" ] && echo yes || echo no)"
else
  echo "FATAL: strežnik ne teče — glej dev-restaurantos.log"
  tail -5 dev-restaurantos.log
  exit 1
fi
