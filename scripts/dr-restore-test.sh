#!/usr/bin/env bash
# ============================================================
# scripts/dr-restore-test.sh — PERIODIČNI RESTORE DRILL (DR preskus)
# Epic #115 P0-6 sprejemni dokaz:
#   backup → clean environment → restore → login → menu →
#   → order/inventory → reports → integrity → RTO meritev
# ============================================================
# To je dokumentiran, ponovljiv drill (docs/DISASTER-RECOVERY.md §7).
# Priporočeni urnik: MESAČNO + po vsaki večji shematski spremembi.
#
# FAZE (vsaka logira PASS/FAIL; prvi FAIL = prekinitev):
#   1. BACKUP    — GET /api/backup?mode=full (CRON_SECRET) → artefakt + counts.txt
#   2. CLEAN ENV — rm -rf PGLITE_DATA_DIR + node scripts/init-pglite.mjs
#                  (+ APP_RESTART_CMD) → čakanje /api/health → manifest == 0
#                  (preskoči se z --skip-clean / SKIP_CLEAN_ENV=1)
#   3. RESTORE   — PIN prijava (admin) → POST /api/backup/restore?confirm=true
#                  → zahtevana matched=true + totalRestored == vsota backupa
#   4. VERIFY    — sveža PIN prijava (restore TRUNCATE-a tudi Session!) →
#                  /api/menus, /api/inventory, /api/z-report, /api/orders
#   5. INTEGRITY — POST /api/backup/restore?confirm=true&verifyOnly=true
#   6. POROČILO  — meritve RTO/RPO + primerjava s ciljem < 3600 s (SLA.md §8.2)
#
# Uporaba:
#   CRON_SECRET="..." ADMIN_PIN="..." LOCATION_ID="..." ./scripts/dr-restore-test.sh
#   CRON_SECRET="..." ADMIN_PIN="..." LOCATION_ID="..." ./scripts/dr-restore-test.sh --skip-clean
#   ./scripts/dr-restore-test.sh --help
#
# Okoljske spremenljivke:
#   RESTAURANTOS_URL   cilj aplikacije              (privzeto http://localhost:3000)
#   CRON_SECRET        OBVEZEN — backup GET auth    (brez njega exit 2)
#   ADMIN_PIN          OBVEZEN — PIN admin zaposlenega za restore sejo (exit 2)
#   LOCATION_ID        OBVEZEN — id AKTIVNE lokacije (exit 2). Kje ga najti:
#                      GET /api/locations z admin sejo → { locations: [{ id, name }] },
#                      ali v aplikaciji (Nastavitve → Lokacije).
#                      GET /api/auth/employees zahteva točno ta id.
#   WORKDIR            delovna mapa drila (privzeto /tmp/restaurantos-dr-<ts>;
#                      artefakti se OHRANIJO — pot se izpiše na koncu)
#   PGLITE_DATA_DIR    podatkovna mapa PGlite       (privzeto /tmp/pglite-data)
#   REPO_DIR           repozitorij z scripts/init-pglite.mjs (privzeto: mapo
#                      nad to skripto)
#   SKIP_CLEAN_ENV     1 = faza 2 preskočena (preverjanje proti živemu okolju;
#                      privzeto 0). Alias ukazne vrstice: --skip-clean
#   APP_STOP_CMD       opcijski ukaz za GRACIOZNO ustavitev app PRED brisanjem
#                      podatkovne mape (skripta sama NE ubija procesov)
#   APP_RESTART_CMD    opcijski ukaz za zagon app PO re-init baze (npr.
#                      "pm2 restart restaurantos" ali dev zagon)
#   CLEAN_WAIT_TIMEOUT koliko sekund čakamo na /api/health (privzeto 120)
#   CURL_TIMEOUT       curl --max-time za backup/restore (privzeto 900)
#
# POMENBNO:
#   * UNIČUJOČE korake (rm podatkovne mape) izvaja SAMO faza 2 in SAMO nad
#     $PGLITE_DATA_DIR + $WORKDIR — nič drugega. Vsak uničujoč korak je
#     izrazito zalogiran.
#   * Faza 2 PREDPOSTAVLJA LOKALNO PGlite namestitev (strežnik MORA biti
#     ugasnjen med rm + init — PGlite multiproces dostop = korupcija, lekcija
#     R126). Za zunanji Postgres (Neon) pripravi čisto okolje ročno
#     (createdb + pg_restore, glej docs/DISASTER-RECOVERY.md §5) in poženi
#     z --skip-clean.
#   * Login PRED restoreom je potreben (restore sprejema IZKLJUČNO admin
#     sejo — CRON_SECRET je namenoma zavrnjen), a ta seja umre s TRUNCATE
#     Session — zato faza 4 dela SVEŽO prijavo (hkrati dokaz, da so PIN
#     bcrypt hash-i pravilno preživeli backup/restore).
#
# Izhodne kode: 0 = vse faze PASS; 2 = konfiguracijska napaka; 1 = FAIL faze
# ali nepričakovana napaka (artefakti ostajajo v WORKDIR za forenziko).
# ============================================================
set -euo pipefail

RESTAURANTOS_URL="${RESTAURANTOS_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
ADMIN_PIN="${ADMIN_PIN:-}"
LOCATION_ID="${LOCATION_ID:-}"
WORKDIR="${WORKDIR:-/tmp/restaurantos-dr-$(date +%s)}"
PGLITE_DATA_DIR="${PGLITE_DATA_DIR:-/tmp/pglite-data}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_CLEAN_ENV="${SKIP_CLEAN_ENV:-0}"
APP_STOP_CMD="${APP_STOP_CMD:-}"
APP_RESTART_CMD="${APP_RESTART_CMD:-}"
CLEAN_WAIT_TIMEOUT="${CLEAN_WAIT_TIMEOUT:-120}"
CURL_TIMEOUT="${CURL_TIMEOUT:-900}"

usage() { sed -n '2,60p' "$0" | grep -E '^#( |$)' | sed 's/^# \{0,1\}//'; }

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
pass() { log "PASS: $*"; }
fail() { log "FAIL: $*"; exit 1; }
die()  { log "NAPAKA: $1"; exit "${2:-1}"; }

CURRENT_PHASE="INICIALIZACIJA"
# Kontekst ob NEPRIČAKOVANI napaki (set -e + ERR trap); fail() izpiše svoje sporočilo
trap 'log "FAIL: nepričakovana napaka v fazi [$CURRENT_PHASE] — artefakti ostajajo v ${WORKDIR:-?} (forenzika)"' ERR

# ── Argumenti ─────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --skip-clean) SKIP_CLEAN_ENV=1 ;;
    -h|--help)    usage; exit 0 ;;
    *)            usage; die "neznani argument: $arg" 2 ;;
  esac
done

# ── Konfiguracija + orodja ────────────────────────────────────
[ -n "$CRON_SECRET" ] || die "CRON_SECRET ni nastavljen (potreben za GET /api/backup — fail-closed). Primer: CRON_SECRET=\"...\" $0" 2
[ -n "$ADMIN_PIN" ]   || die "ADMIN_PIN ni nastavljen (restore sprejema IZKLJUČNO admin sejo — CRON_SECRET NI sprejet)." 2
[ -n "$LOCATION_ID" ] || die "LOCATION_ID ni nastavljen. Najdeš ga z: GET /api/locations (admin seja) → { locations: [{ id, name }] }, ali v aplikaciji (Nastavitve → Lokacije). GET /api/auth/employees zahteva AKTIVNO lokacijo." 2
command -v curl >/dev/null 2>&1 || die "curl ni nameščen" 2
command -v node  >/dev/null 2>&1 || die "node ni nameščen" 2
mkdir -p "$WORKDIR"

AUTH_CRON="Authorization: Bearer $CRON_SECRET"
BACKUP_FILE="$WORKDIR/pre-restore-backup.json"
COUNTS_FILE="$WORKDIR/counts.txt"

BACKUP_DURATION=0
CLEAN_DURATION="preskočeno"
RESTORE_DURATION=0
VERIFY_DURATION=0
INTEGRITY_DURATION=0
DRILL_START="$(date +%s)"

log "=== DR RESTORE DRILL — zagon ==="
log "cilj=$RESTAURANTOS_URL workdir=$WORKDIR pglite=$PGLITE_DATA_DIR skip_clean=$SKIP_CLEAN_ENV"

# ── Pomožne funkcije ──────────────────────────────────────────
# OPOMBA (R127 fix): curl z -w '%{http_code}' izpiše 000 TUDI ob napaki
# povezave — `|| echo 000` bi zato izpisal 000 DVAKRAT ("000\n000") in
# primerjava [ "$(health_code)" = "000" ] bi NIKOLI ne uspela (lažni FAIL
# "app še vedno odgovarja"). `|| true` le poglasi curl-ov exit code.
health_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$RESTAURANTOS_URL/api/health" 2>/dev/null || true; }

wait_for_health() {
  local deadline=$(( $(date +%s) + CLEAN_WAIT_TIMEOUT )) code
  while [ "$(date +%s)" -lt "$deadline" ]; do
    code="$(health_code)"
    if [ "$code" = "200" ]; then return 0; fi
    sleep 2
  done
  return 1
}

# verify_endpoint IME POT MODEL OUTFILE
# Pričakuje HTTP 200; če counts.txt vsebuje MODEL > 0, mora odgovor biti NE-PRAZEN.
verify_endpoint() {
  local name="$1" path="$2" model="$3" outfile="$4"
  local code rows req_nonempty="ne"
  code="$(curl -sS -o "$outfile" -w '%{http_code}' --max-time 60 \
    -H "Authorization: Bearer $TOKEN2" "$RESTAURANTOS_URL$path" || echo 000)"
  if [ "$code" != "200" ]; then
    fail "verify [$name]: HTTP $code (pričakovano 200) na $path — odgovor: $outfile"
  fi
  if [ -n "$model" ] && grep -q "^$model [1-9]" "$COUNTS_FILE"; then
    req_nonempty="da"
  fi
  rows="$(VERIFY_FILE="$outfile" node -e '
    let j;
    try { j = JSON.parse(require("fs").readFileSync(process.env.VERIFY_FILE, "utf8")); }
    catch (e) { console.log("-1"); process.exit(0); }
    let n = 0;
    if (Array.isArray(j)) n = j.length;
    else if (j && typeof j === "object") {
      if (Array.isArray(j.items))  n = j.items.length;   // GET /api/inventory → { items }
      else if (Array.isArray(j.orders)) n = j.orders.length; // GET /api/orders → { orders }
    }
    console.log(String(n));
  ')"
  if [ "$rows" = "-1" ]; then fail "verify [$name]: odgovor ni veljaven JSON ($outfile)"; fi
  if [ "$req_nonempty" = "da" ] && [ "$rows" = "0" ]; then
    fail "verify [$name]: backup vsebuje $model > 0, a endpoint po restoreu vrne PRAZEN rezultat (podatki NISO berljivi)"
  fi
  log "PASS: verify [$name] — HTTP 200, vrstic: $rows (zahtevano ne-prazno: $req_nonempty)"
  echo "$name HTTP=200 vrstice=$rows" >> "$WORKDIR/verify-results.txt"
}

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="1/6 BACKUP"
PHASE_START="$(date +%s)"
log "--- faza 1: BACKUP (GET /api/backup?mode=full) ---"
TMP_BAK="$WORKDIR/.tmp-pre-restore-backup.json"
if ! curl -fsS --max-time "$CURL_TIMEOUT" -H "$AUTH_CRON" \
    "$RESTAURANTOS_URL/api/backup?mode=full" -o "$TMP_BAK"; then
  rm -f "$TMP_BAK"
  fail "backup klic ni uspel — preveri CRON_SECRET (401) in dosegljivost $RESTAURANTOS_URL"
fi
mv "$TMP_BAK" "$BACKUP_FILE"

TOTAL_BACKUP="$(BACKUP_FILE="$BACKUP_FILE" COUNTS_OUT="$COUNTS_FILE" node -e '
  const fs = require("fs");
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.BACKUP_FILE, "utf8")); }
  catch (e) { console.error("ni veljaven JSON: " + e.message); process.exit(1); }
  if (j.format !== "restaurantos-backup") { console.error("format ni restaurantos-backup"); process.exit(1); }
  if (j.version !== 1) { console.error("version ni 1"); process.exit(1); }
  if (!j.checksum || typeof j.checksum !== "string" || !j.checksum) { console.error("checksum manjka"); process.exit(1); }
  if (!j.counts || typeof j.counts !== "object" || Array.isArray(j.counts)) { console.error("counts manjkajo"); process.exit(1); }
  const entries = Object.entries(j.counts).map(([m, v]) => [m, Number(v) || 0]);
  const total = entries.reduce((a, kv) => a + kv[1], 0);
  fs.writeFileSync(process.env.COUNTS_OUT, entries.map(kv => kv[0] + " " + kv[1]).join("\n") + "\n", "utf8");
  console.log(String(total));
')" || fail "backup artefakt ni prešel validacije formata v1: $BACKUP_FILE"

if [ "$TOTAL_BACKUP" = "0" ]; then
  log "OPOZORILO: backup vsebuje 0 vrstic (prazna baza) — drill tehnično dela, a ne dokazuje podatkovnega round-tripa"
fi
BACKUP_DURATION=$(( $(date +%s) - PHASE_START ))
pass "BACKUP: $BACKUP_FILE, vsota vrstic=$TOTAL_BACKUP, trajanje=${BACKUP_DURATION}s"

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="2/6 CLEAN ENVIRONMENT"
PHASE_START="$(date +%s)"
if [ "$SKIP_CLEAN_ENV" = "1" ]; then
  CLEAN_DURATION="preskočeno"
  pass "CLEAN ENV preskočen (--skip-clean / SKIP_CLEAN_ENV=1) — restore teče proti ŽIVEMU okolju (pazi: TRUNCATE vseh tabel!)"
else
  log "--- faza 2: CLEAN ENVIRONMENT (lokalna PGlite) ---"

  # Strežnik MORA biti ugasnjen med rm + init (PGlite multiproces = korupcija).
  if [ "$(health_code)" != "000" ]; then
    log "OPOZORILO: na $RESTAURANTOS_URL teče aplikacija — skripta sama NE ubija procesov"
    if [ -n "$APP_STOP_CMD" ]; then
      log "izvajam APP_STOP_CMD (graciozna zaustavitev)..."
      bash -c "$APP_STOP_CMD" || fail "APP_STOP_CMD ni uspel"
      stopped=""
      for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
        if [ "$(health_code)" = "000" ]; then stopped="da"; break; fi
        sleep 2
      done
      [ "$stopped" = "da" ] || fail "app še vedno odgovarja po APP_STOP_CMD — ustavi ročno in ponovi"
      log "app ugasnjena"
    else
      fail "ustavi app ročno (ali nastavi APP_STOP_CMD), nato ponovi drill. PGlite multiproces dostop = korupcija (lekcija R126). APP_RESTART_CMD se uporabi ŠELE za zagon PO re-initu."
    fi
  fi

  # Zaščita pred nesrečnim rm — brišemo IZKLJUČNO konfigurirano podatkovno mapo
  [ -n "$PGLITE_DATA_DIR" ] || fail "PGLITE_DATA_DIR je prazen"
  case "$PGLITE_DATA_DIR" in
    /|/tmp|/home|/var|/etc|/usr|/Users|"$REPO_DIR"|"$WORKDIR")
      fail "PGLITE_DATA_DIR='$PGLITE_DATA_DIR' je nevaren cilj — nastavi eksplicitno podatkovno mapo" ;;
  esac
  [ -f "$REPO_DIR/scripts/init-pglite.mjs" ] || fail "ni $REPO_DIR/scripts/init-pglite.mjs (REPO_DIR?)"

  log "UNIČUJOČE: brišem podatkovno mapo: $PGLITE_DATA_DIR"
  rm -rf "$PGLITE_DATA_DIR"
  log "re-init baze: node scripts/init-pglite.mjs (DDL iz prisma/schema.prisma)"
  if ! (cd "$REPO_DIR" && PGLITE_DATA_DIR="$PGLITE_DATA_DIR" node scripts/init-pglite.mjs) \
      > "$WORKDIR/init-pglite.log" 2>&1; then
    tail -5 "$WORKDIR/init-pglite.log" >&2 || true
    fail "re-init PGlite ni uspel — log: $WORKDIR/init-pglite.log"
  fi

  if [ -n "$APP_RESTART_CMD" ]; then
    log "zaganjam APP_RESTART_CMD..."
    if ! bash -c "$APP_RESTART_CMD"; then
      log "OPOZORILO: APP_RESTART_CMD ni uspel — zaženi aplikacijo ROČNO; drill še vedno čaka na /api/health (${CLEAN_WAIT_TIMEOUT}s)"
    fi
  else
    log "OPOZORILO: APP_RESTART_CMD ni nastavljen — zaženi aplikacijo ROČNO zdaj; drill čaka na /api/health do ${CLEAN_WAIT_TIMEOUT}s"
  fi

  wait_for_health || fail "app ni odgovoril 200 na GET /api/health v ${CLEAN_WAIT_TIMEOUT}s (log: $WORKDIR/init-pglite.log)"
  log "app zdrava (health 200)"

  # Dokaz ČISTOSTI: manifest števec — vsi 0 ALI counts prazen (tolerantno:
  # manifest na prazni bazi lahko vrne {} ali ključe z vrednostmi 0)
  MANIFEST_JSON="$WORKDIR/manifest-clean.json"
  if ! curl -fsS --max-time 60 -H "$AUTH_CRON" \
      "$RESTAURANTOS_URL/api/backup?mode=manifest" -o "$MANIFEST_JSON"; then
    fail "GET /api/backup?mode=manifest ni uspel (čistost čiste baze ni dokazljiva)"
  fi
  MANIFEST_NOTE="$(MANIFEST_FILE="$MANIFEST_JSON" node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.env.MANIFEST_FILE, "utf8")); }
    catch (e) { console.error("manifest ni JSON"); process.exit(1); }
    let c = (j && typeof j === "object" && j.counts && typeof j.counts === "object" && !Array.isArray(j.counts)) ? j.counts : j;
    const keys = Object.keys(c).filter(k => typeof c[k] === "number");
    if (keys.length === 0) { console.log("counts prazen (0 tabel)"); process.exit(0); }
    const nonZero = keys.filter(k => c[k] !== 0);
    if (nonZero.length > 0) {
      console.error("niso vse 0: " + nonZero.slice(0, 10).map(k => k + "=" + c[k]).join(", "));
      process.exit(1);
    }
    console.log("vseh " + keys.length + " števcev = 0");
  ')" || fail "čista baza NI prazna — glej manifest: $MANIFEST_JSON"
  pass "CLEAN: baza prazna ($MANIFEST_NOTE)"
  CLEAN_DURATION=$(( $(date +%s) - PHASE_START ))
fi

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="3/6 RESTORE"
PHASE_START="$(date +%s)"
log "--- faza 3: RESTORE (bootstrap → PIN prijava → POST /api/backup/restore?confirm=true) ---"

# 3a. BOOTSTRAP (samo čisto okolje): čista baza NIMA admina → prijava pred
#     restoreom je nemogoča. Realističen DR potek (docs/DISASTER-RECOVERY.md §5):
#     setup wizard ustvari začasnega admina + lokacijo, prijava pa odpre sejo;
#     restore nato TRUNCATE-a TUDI te bootstrap vrstice in vstavi backup.
#     Na že inicializirani bazi (--skip-clean) setup/init vrže napako → tolerantno.
BOOTSTRAP_JSON="$WORKDIR/bootstrap.json"
BOOTSTRAP_BODY="$(BOOTSTRAP_PIN="$ADMIN_PIN" node -e '
  const pin = process.env.BOOTSTRAP_PIN || "000000";
  process.stdout.write(JSON.stringify({
    restaurantName: "DR Bootstrap",
    adminName: "DR Admin",
    adminEmail: "dr-bootstrap@restaurantos.local",
    adminPin: pin,
    locationName: "DR Bootstrap",
    locationCode: "DRBOOT01",
    catalogMode: "empty",
  }));
')"
BOOT_CODE="$(curl -sS -o "$BOOTSTRAP_JSON" -w '%{http_code}' --max-time 60 \
    -H 'Content-Type: application/json' \
    -d "$BOOTSTRAP_BODY" \
    "$RESTAURANTOS_URL/api/setup/init")"
BOOT_CREATED=0
case "$BOOT_CODE" in
  201|200) BOOT_CREATED=1; log "bootstrap admin ustvarjen (setup/init $BOOT_CODE) — restore ga bo zamenjal" ;;
  *) log "OPOZORILO: bootstrap skok (setup/init $BOOT_CODE) — pričakovano na že inicializirani bazi (--skip-clean)" ;;
esac

# 3b. PIN prijava — dvostopenjski tok (R95-a): najprej seznam zaposlenih.
#     Na čistem okolju se prijavimo na BOOTSTRAP lokacijo (iz setup/init
#     odgovora); na že inicializirani bazi (--skip-clean) na LOCATION_ID.
LOGIN_LOCATION_ID="$LOCATION_ID"
BOOT_LOC_ID="$(node -e '
  try {
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    if (j && j.location && j.location.id) console.log(j.location.id);
  } catch {}
' "$BOOTSTRAP_JSON" 2>/dev/null || true)"
if [ "$BOOT_CREATED" = "1" ] && [ -n "$BOOT_LOC_ID" ]; then
  LOGIN_LOCATION_ID="$BOOT_LOC_ID"
fi
log "prijava na lokacijo: $LOGIN_LOCATION_ID"
EMPLOYEES_JSON="$WORKDIR/employees.json"
if ! curl -fsS --max-time 30 \
    "$RESTAURANTOS_URL/api/auth/employees?locationId=$LOGIN_LOCATION_ID" -o "$EMPLOYEES_JSON"; then
  fail "GET /api/auth/employees ni uspel (404 = lokacija ne obstaja / ni aktivna; preveri LOCATION_ID=$LOCATION_ID)"
fi
LOGIN_BODY="$(EMPLOYEES_FILE="$EMPLOYEES_JSON" ADMIN_PIN="$ADMIN_PIN" node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(process.env.EMPLOYEES_FILE, "utf8"));
  const list = ((j && j.employees) || []).filter(e => e && e.id);
  if (list.length === 0) { console.error("lokacija nima aktivnih zaposlenih s PIN"); process.exit(1); }
  const admin = list.find(e => e.role === "admin") || list[0];
  if (admin.role !== "admin") console.error("OPOZORILO: na lokaciji NI admina — faza 4 (manage_cash/manage_inventory) lahko dobi 403");
  console.error("izbran zaposleni: " + admin.name + " [" + admin.role + "]");
  console.log(JSON.stringify({ employeeId: admin.id, pin: process.env.ADMIN_PIN }));
')" || fail "izbira zaposlenega ni uspela: $EMPLOYEES_JSON"

AUTH1_JSON="$WORKDIR/auth1.json"
if ! curl -fsS --max-time 30 -H 'Content-Type: application/json' \
    -d "$LOGIN_BODY" "$RESTAURANTOS_URL/api/auth" -o "$AUTH1_JSON"; then
  fail "POST /api/auth ni uspel (401 = napačen ADMIN_PIN ali nedejaven uporabnik; 429 = rate-limit/lockout)"
fi
TOKEN1="$(AUTH_FILE="$AUTH1_JSON" node -e '
  const j = JSON.parse(require("fs").readFileSync(process.env.AUTH_FILE, "utf8"));
  if (!j.token || typeof j.token !== "string") { console.error("odgovor brez polja token"); process.exit(1); }
  console.log(j.token);
')" || fail "prijava NI VRNILA sejnega tokena (polje .token): $AUTH1_JSON"
log "admin seja pridobljena (login #1)"

# 3c. Restore — body = backup JSON (nepoškodovano prek --data-binary @file)
RESTORE_JSON="$WORKDIR/restore-response.json"
if ! curl -fsS --max-time "$CURL_TIMEOUT" \
    -H "Authorization: Bearer $TOKEN1" -H 'Content-Type: application/json' \
    --data-binary "@$BACKUP_FILE" \
    "$RESTAURANTOS_URL/api/backup/restore?confirm=true" -o "$RESTORE_JSON"; then
  fail "restore ni uspel (HTTP napaka) — Prisma \$transaction je ATOMARNA: baza ostaja v stanju PRED restoreom; ponovi ali uporabi starejši backup (docs/DISASTER-RECOVERY.md §6)"
fi

TOTAL_RESTORED="$(RESTORE_FILE="$RESTORE_JSON" node -e '
  const fs = require("fs");
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.RESTORE_FILE, "utf8")); }
  catch (e) { console.error("odgovor ni JSON"); process.exit(1); }
  if (j.success !== true) { console.error("success ni true"); process.exit(1); }
  if (j.matched !== true) { console.error("matched ni true (števci/checksum se ne ujemajo)"); process.exit(1); }
  const tr = Number(j.totalRestored), te = Number(j.totalExpected);
  if (!Number.isFinite(tr) || !Number.isFinite(te)) { console.error("totalRestored/totalExpected manjkata"); process.exit(1); }
  const tables = (j.tables && typeof j.tables === "object") ? j.tables : {};
  Object.entries(tables)
    .filter(kv => kv[1] && Number(kv[1].expected) > 0)
    .forEach(kv => console.error("  " + String(kv[0]).padEnd(24) + " expected=" + kv[1].expected + "  restored=" + kv[1].restored + "  matched=" + kv[1].matched));
  if (j.warnings && Array.isArray(j.warnings) && j.warnings.length) console.error("opozorila: " + j.warnings.join(" | "));
  console.log(String(tr));
')" || fail "restore odgovor ni prešel validacije: $RESTORE_JSON"

if [ "$TOTAL_RESTORED" != "$TOTAL_BACKUP" ]; then
  fail "totalRestored ($TOTAL_RESTORED) != vsota vrstic backupa ($TOTAL_BACKUP)"
fi
RESTORE_DURATION=$(( $(date +%s) - PHASE_START ))
pass "RESTORE: matched=true, totalRestored=$TOTAL_RESTORED (= vsota backupa $TOTAL_BACKUP), trajanje=${RESTORE_DURATION}s (jedro RTO)"

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="4/6 VERIFY (login/menu/inventory/reports)"
PHASE_START="$(date +%s)"
log "--- faza 4: VERIFY (sveža prijava + bralni endpointi) ---"

# Restore je TRUNCATE-al VSE tabele, tudi Session → token1 je zagotovo mrtev
# (in bootstrap admin NE OBSTAJA več — restore ga je zamenjal z backupom).
# Sveža prijava gre na ORIGINALNO lokacijo (obnovljeno iz backupa) — hkrati je
# DOKAZ, da so PIN bcrypt hash-i + pinLookup preživeli round-trip.
# Lokacija za prijavo PO restoreu pride iz BACKUP datoteke (po pravem DR-ju
# so obnovljene lokacije tiste iz backupa — LOCATION_ID env je lahko star):
RESTORED_LOCATION_ID="$(BACKUP_FILE="$BACKUP_FILE" node -e '
  const j = JSON.parse(require("fs").readFileSync(process.env.BACKUP_FILE, "utf8"));
  const rows = (j.tables && j.tables.Location) || [];
  const preferred = rows.find(r => r.id === process.env.LOCATION_ID) || rows[0];
  if (preferred && preferred.id) console.log(preferred.id);
' 2>/dev/null || true)"
[ -n "$RESTORED_LOCATION_ID" ] || fail "backup ne vsebuje Location vrstice — nič za prijavo"
log "prijava PO restoreu na lokacijo iz backupa: $RESTORED_LOCATION_ID"
EMPLOYEES2_JSON="$WORKDIR/employees-after-restore.json"
if ! curl -fsS --max-time 30 \
    "$RESTAURANTOS_URL/api/auth/employees?locationId=$RESTORED_LOCATION_ID" -o "$EMPLOYEES2_JSON"; then
  fail "GET /api/auth/employees PO restoreu ni uspel (obnovljena lokacija $RESTORED_LOCATION_ID ni dosegljiva)"
fi
LOGIN_BODY2="$(EMPLOYEES_FILE="$EMPLOYEES2_JSON" ADMIN_PIN="$ADMIN_PIN" node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(process.env.EMPLOYEES_FILE, "utf8"));
  const list = ((j && j.employees) || []).filter(e => e && e.id);
  if (list.length === 0) { console.error("obnovljena lokacija nima aktivnih zaposlenih s PIN"); process.exit(1); }
  const admin = list.find(e => e.role === "admin") || list[0];
  console.error("izbran zaposleni po restoreu: " + admin.name + " [" + admin.role + "]");
  console.log(JSON.stringify({ employeeId: admin.id, pin: process.env.ADMIN_PIN }));
')" || fail "izbira zaposlenega po restoreu ni uspela: $EMPLOYEES2_JSON"

AUTH2_JSON="$WORKDIR/auth2.json"
if ! curl -fsS --max-time 30 -H 'Content-Type: application/json' \
    -d "$LOGIN_BODY2" "$RESTAURANTOS_URL/api/auth" -o "$AUTH2_JSON"; then
  fail "sveža prijava PO restoreu ni uspela — PIN hash-i verjetno NISO pravilno obnovljeni"
fi
TOKEN2="$(AUTH_FILE="$AUTH2_JSON" node -e '
  const j = JSON.parse(require("fs").readFileSync(process.env.AUTH_FILE, "utf8"));
  if (!j.token || typeof j.token !== "string") { console.error("odgovor brez polja token"); process.exit(1); }
  console.log(j.token);
')" || fail "druga prijava brez tokena: $AUTH2_JSON"
pass "sveža prijava PO restoreu uspešna (PIN hash-i OK, Session TRUNCATE dokazan)"

: > "$WORKDIR/verify-results.txt"
verify_endpoint "menu"      "/api/menus"          "Menu"          "$WORKDIR/verify-menu.json"
verify_endpoint "inventory" "/api/inventory"      "InventoryItem" "$WORKDIR/verify-inventory.json"
verify_endpoint "z-report"  "/api/z-report"       "ZReport"       "$WORKDIR/verify-zreport.json"
verify_endpoint "orders"    "/api/orders?limit=1" "Order"         "$WORKDIR/verify-orders.json"
VERIFY_DURATION=$(( $(date +%s) - PHASE_START ))
pass "VERIFY: menu/inventory/z-report/orders berljivi po restoreu, trajanje=${VERIFY_DURATION}s"

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="5/6 INTEGRITY (verifyOnly)"
PHASE_START="$(date +%s)"
log "--- faza 5: INTEGRITY (POST /api/backup/restore?confirm=true&verifyOnly=true) ---"
VERIFYONLY_JSON="$WORKDIR/verify-only-response.json"
if ! curl -fsS --max-time "$CURL_TIMEOUT" \
    -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
    --data-binary "@$BACKUP_FILE" \
    "$RESTAURANTOS_URL/api/backup/restore?confirm=true&verifyOnly=true" -o "$VERIFYONLY_JSON"; then
  fail "verifyOnly klic ni uspel (HTTP napaka)"
fi
VERIFYONLY_NOTE="$(VERIFYONLY_FILE="$VERIFYONLY_JSON" node -e '
  const fs = require("fs");
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.VERIFYONLY_FILE, "utf8")); }
  catch (e) { console.error("odgovor ni JSON"); process.exit(1); }
  if (j.success !== true) { console.error("success ni true"); process.exit(1); }
  if (j.verifyOnly !== true) { console.error("odgovor NI verifyOnly način"); process.exit(1); }
  // OPOMBA: verifyOnly vedno poroča matched=false (nič ni obnovljeno —
  // restored=0 po zasnovi). Merilo integrity tu je: HTTP 200 + success=true
  // + verifyOnly=true → struktura + checksum + manifest so SKLADNI.
  if (!Array.isArray(j.warnings)) { console.error("odgovor brez warnings seznama"); process.exit(1); }
  console.log("verifyOnly=true, struktura + checksum + manifest SKLADNA (matched=false je pričakovano: ni zapisov)");
')" || fail "INTEGRITY ni prešla: $VERIFYONLY_JSON"
INTEGRITY_DURATION=$(( $(date +%s) - PHASE_START ))
pass "INTEGRITY: $VERIFYONLY_NOTE, trajanje=${INTEGRITY_DURATION}s"

# ══════════════════════════════════════════════════════════════
CURRENT_PHASE="6/6 RTO/RPO POROČILO"
TOTAL_RTO=$(( $(date +%s) - DRILL_START ))
GIT_COMMIT="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
log "=== RTO/RPO MERITVE ==="
log "backup faza:     ${BACKUP_DURATION}s"
log "clean env faza:  ${CLEAN_DURATION}"
log "restore faza:    ${RESTORE_DURATION}s  (jedro RTO)"
log "verify faza:     ${VERIFY_DURATION}s"
log "integrity faza:  ${INTEGRITY_DURATION}s"
log "SKUPNI RTO:      ${TOTAL_RTO}s — cilj < 3600 s (docs/SLA.md §8.2: RTO 1 h)"
if [ "$TOTAL_RTO" -lt 3600 ]; then
  pass "RTO znotraj cilja (${TOTAL_RTO}s < 3600s)"
  DRILL_RESULT="PASS"
else
  fail "RTO PRESEGA cilj (${TOTAL_RTO}s >= 3600s) — dokumentiraj v docs/DISASTER-RECOVERY.md §7 in razišči ozka grla"
fi

log "=== DRILL USPEŠNO KONČAN ($DRILL_RESULT) ==="
log "artefakti (ohranjeni): $WORKDIR"
log "  - backup:        $BACKUP_FILE"
log "  - števec:        $COUNTS_FILE"
log "  - restore resp.: $WORKDIR/restore-response.json"
log "  - verify rezult: $WORKDIR/verify-results.txt"
log "vrstica za podpisno tabelo (docs/DISASTER-RECOVERY.md §7):"
log "  | $(date '+%Y-%m-%d') | $GIT_COMMIT | ${TOTAL_RTO}s | $DRILL_RESULT | (izvedel: ______) |"
exit 0
