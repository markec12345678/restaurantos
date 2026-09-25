#!/usr/bin/env bash
# ============================================================
# scripts/backup.sh — Produkcijski JSON backup (cron-prijazen)
# Epic #115 P0-6 (zanesljivost / disaster recovery)
# ============================================================
# Klice GET /api/backup?mode=full (CRON_SECRET Bearer) in shrani
# format-v1 JSON artefakt v BACKUP_DIR z datumskim pečatom + sha256
# sidecar datoteko + retencijo.
#
# Heartbeat: sam backup klic (GET /api/backup?mode=full) posodobi
# backup heartbeat STREŽNIŠKO (updatedBy 'api/backup') — ta skripta
# zato NE pošilja dodatnega POST /api/monitoring/backup-heartbeat
# (heartbeat pomeni USPEH; ob napaki se ne laže). Ob napaki skripta
# konča z ne-ničelnim izhodom (cron pošlje mail), alert
# 'backup_overdue' (GET /api/monitoring/alerts) pa se sproži
# samodejno po STALNOSTI heartbeat-a, ko ta poteče
# (BACKUP_EXPECTED_INTERVAL_HOURS, privzeto 24 h).
#
# Uporaba:
#   CRON_SECRET="..." ./scripts/backup.sh
#   CRON_SECRET="..." RESTAURANTOS_URL=https://app.example.com ./scripts/backup.sh
#   ./scripts/backup.sh --help
#
# Okoljske spremenljivke:
#   RESTAURANTOS_URL  cilj aplikacije          (privzeto http://localhost:3000)
#   CRON_SECRET       obvezen Bearer secret    (brez njega exit 2)
#   BACKUP_DIR        mapa za artefakte        (privzeto /var/backups/restaurantos)
#   RETENTION_DAYS    retencija v dneh         (privzeto 14)
#   CURL_TIMEOUT      curl --max-time v sek.   (privzeto 900)
#
# Cron primer (dnevno ob 03:00):
#   0 3 * * * CRON_SECRET="..." /opt/restaurantos/scripts/backup.sh >> /var/log/restaurantos-backup.log 2>&1
# Opcijsko: dodatni poskus pred dnevnim zaključkom (npr. 15:30) — zmanjša
# dejanski RPO za dni, ko prvi (nočni) poskus ne uspe:
#   30 15 * * * CRON_SECRET="..." /opt/restaurantos/scripts/backup.sh >> /var/log/restaurantos-backup.log 2>&1
#
# Zelo velike zunanje Postgres produkcije (Neon, > ~500 MB JSON ali
# počasna serializacija): uporabi pg_dump pot — glej docs/DISASTER-RECOVERY.md
# (pot b) in docs/STAGING_DEPLOYMENT.md §5.2.
#
# Izhodne kode:
#   0  uspeh (artefakt + sha256 shranjena, retencija očiščena)
#   2  konfiguracijska napaka (manjkajoč CRON_SECRET / curl / node) ali --help
#   3  artefakt NI prešel validacije — NE izbrišem ga (forenzika), pot izpisana
#   1  vse ostalo (preflight dosegljivost/avtorizacija, backup klic, sha256)
# ============================================================
set -euo pipefail

# Varne privzete pravice — backup vsebuje PII + PIN bcrypt hash-e (0600)
umask 077

RESTAURANTOS_URL="${RESTAURANTOS_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/restaurantos}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CURL_TIMEOUT="${CURL_TIMEOUT:-900}"

usage() {
  sed -n '2,55p' "$0" | grep -E '^#( |$)' | sed 's/^# \{0,1\}//'
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "NAPAKA: $1"; exit "${2:-1}"; }

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) usage; die "neznani argument: $1" 2 ;;
esac

# ── 0. Konfiguracija + orodja ─────────────────────────────────
[ -n "$CRON_SECRET" ] || die "CRON_SECRET ni nastavljen — brez njega ni backup GET-a (fail-closed). Primer: CRON_SECRET=\"...\" $0" 2
command -v curl >/dev/null 2>&1 || die "curl ni nameščen (predpogoj skripte)" 2
command -v node >/dev/null 2>&1 || die "node ni nameščen (potreben za validacijo artefakta)" 2
mkdir -p "$BACKUP_DIR"

AUTH_HEADER="Authorization: Bearer $CRON_SECRET"

# ── 1. Preflight: CRON_SECRET + dosegljivost prek heartbeat GET-a ──
# NAMERNO FATAL: napačen secret pomeni, da bi bilo alarmiranje (heartbeat)
# prelomljeno — takega backupa ne začenjaj niti po naključju.
PREFLIGHT_CODE=""
if ! PREFLIGHT_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 -H "$AUTH_HEADER" \
    "$RESTAURANTOS_URL/api/monitoring/backup-heartbeat"); then
  die "preflight: $RESTAURANTOS_URL ni dosegljiv (curl ni uspel) — prekini, da cron pošlje mail" 1
fi
if [ "$PREFLIGHT_CODE" != "200" ]; then
  if [ "$PREFLIGHT_CODE" = "401" ]; then
    die "preflight: heartbeat vrnil 401 — CRON_SECRET je NAPAČEN (heartbeat alarmiranje bi bilo prelomljeno)" 1
  fi
  die "preflight: heartbeat vrnil HTTP $PREFLIGHT_CODE (pričakovano 200)" 1
fi
log "preflight OK: heartbeat dosegljiv, CRON_SECRET sprejet"

# ── 2. Backup: temp datoteka + atomski mv ─────────────────────
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/restaurantos-backup-$STAMP.json"
TMP="$BACKUP_DIR/.tmp-restaurantos-backup-$STAMP.$$"

# GET /api/backup?mode=full posodobi heartbeat strežniško (updatedBy 'api/backup')
# — uspešen klic = svež heartbeat; tu ni podvojenega POST-a heartbeat-a.
log "zaganjam backup: $RESTAURANTOS_URL/api/backup?mode=full (timeout ${CURL_TIMEOUT}s)"
if ! curl -fsS --max-time "$CURL_TIMEOUT" -H "$AUTH_HEADER" \
    "$RESTAURANTOS_URL/api/backup?mode=full" -o "$TMP"; then
  rm -f "$TMP"
  die "backup klic ni uspel (curl -f: HTTP napaka ali prekinitev) — artefakt NE obstaja, heartbeat bo zastarel → 'backup_overdue' alert" 1
fi
mv "$TMP" "$TARGET"   # atomsko (isti direktorij = isti datotečni sistem)
log "artefakt prenesen: $TARGET"

# ── 3. Validacija artefakta (format v1) ───────────────────────
# Ob napaki artefakt NE IZBRIŠEM — ostane za forenziko, pot se izpiše.
VALIDATION_OUT=""
if ! VALIDATION_OUT=$(BACKUP_FILE="$TARGET" node -e '
  const fs = require("fs");
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.BACKUP_FILE, "utf8")); }
  catch (e) { console.error("ni veljaven JSON: " + e.message); process.exit(1); }
  if (j.format !== "restaurantos-backup") { console.error("format ni restaurantos-backup: " + JSON.stringify(j.format)); process.exit(1); }
  if (j.version !== 1) { console.error("version ni 1: " + JSON.stringify(j.version)); process.exit(1); }
  if (!j.counts || typeof j.counts !== "object" || Array.isArray(j.counts) || Object.keys(j.counts).length === 0) { console.error("counts je prazen ali manjka"); process.exit(1); }
  if (!j.checksum || typeof j.checksum !== "string" || j.checksum.length === 0) { console.error("checksum je prazen ali manjka"); process.exit(1); }
  console.log(String(j.createdAt || ""));
  console.log(String(Object.keys(j.counts).length));
  console.log(j.checksum);
  console.log(String(j.engine || "neznan"));
'); then
  log "VALIDACIJA NI USPELA — artefakt ostaja shranjen (ne briši, forenzika): $TARGET"
  die "artefakt ni prešel validacije formata v1: $VALIDATION_OUT" 3
fi
CREATED_AT="$(printf '%s\n' "$VALIDATION_OUT" | sed -n '1p')"
TABLE_COUNT="$(printf '%s\n' "$VALIDATION_OUT" | sed -n '2p')"
CHECKSUM="$(printf '%s\n' "$VALIDATION_OUT" | sed -n '3p')"
ENGINE="$(printf '%s\n' "$VALIDATION_OUT" | sed -n '4p')"

# ── 4. Sidecar integriteta (sha256 cele datoteke) ─────────────
# Storage-level tamper detection — LOČENO od in-file 'checksum' polja,
# ki je hash nad kanoničnim JSON 'tables' (vsebinska integriteta backupa).
if ! sha256sum "$TARGET" > "$TARGET.sha256"; then
  die "zapis sha256 sidecarja ni uspel: $TARGET.sha256" 1
fi
log "sha256 sidecar: $TARGET.sha256"

# ── 5. Retencija ──────────────────────────────────────────────
find "$BACKUP_DIR" -type f -name 'restaurantos-backup-*.json*' -mtime "+$RETENTION_DAYS" -delete || true
REMAINING="$(find "$BACKUP_DIR" -type f -name 'restaurantos-backup-*.json' | wc -l | tr -d ' ')"
log "retencija: izbrisano vse starejše od $RETENTION_DAYS dni; aktivnih backupov: $REMAINING"

# ── 6. Povzetek ───────────────────────────────────────────────
SIZE="$(du -h "$TARGET" | cut -f1)"
log "OK: datoteka  = $TARGET"
log "OK: velikost  = $SIZE"
log "OK: engine    = $ENGINE"
log "OK: ustvarjen = $CREATED_AT"
log "OK: tabele    = $TABLE_COUNT"
log "OK: checksum  = $CHECKSUM"
log "OK: retencija = $REMAINING backupov (RETENTION_DAYS=$RETENTION_DAYS)"
log "OK: backup zaključen. Periodični restore preskus: scripts/dr-restore-test.sh (docs/DISASTER-RECOVERY.md §7)"
exit 0
