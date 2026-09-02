#!/usr/bin/env bash
# ============================================
# CHAOS TEST — Concurrent load z obstoječim tokenom
# ============================================
# Uporaba:
#   ./concurrent-load.sh <TOKEN> <BASE_URL> <NUM_REQUESTS> <CONCURRENCY>
#
# Brez argov: uporabi default vrednosti
# ============================================

set -e

TOKEN="${1:-b44bff5d11fb91af8d05f0fc7733b394ac86f06d03fb762945c63eb17f3caa1d}"
BASE_URL="${2:-https://restaurantos-7pqmhtubw-robertpezdirc12-designs-projects.vercel.app}"
NUM="${3:-100}"
CONCURRENCY="${4:-10}"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  CONCURRENT LOAD TEST                                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo "  Base URL:     $BASE_URL"
echo "  Token:        ${TOKEN:0:20}..."
echo "  Requests:     $NUM"
echo "  Concurrency:  $CONCURRENCY"
echo "  Started:      $(date -Iseconds)"
echo ""

# Create temp dir for results
RESULTS_DIR=$(mktemp -d)
trap "rm -rf $RESULTS_DIR" EXIT

# Generate requests
run_request() {
  local id=$1
  local op=$((id % 4))
  local url
  case $op in
    0) url="/api/orders?status=in-progress,ready" ;;
    1) url="/api/menu-items" ;;
    2) url="/api/inventory?limit=20" ;;
    3) url="/api/outbox" ;;
  esac

  local start=$(date +%s%N)
  local status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    --max-time 10 \
    "$BASE_URL$url")
  local end=$(date +%s%N)
  local duration=$(( (end - start) / 1000000 ))

  echo "$id,$status,$duration,$url" >> "$RESULTS_DIR/results.csv"
}

export -f run_request
export TOKEN BASE_URL RESULTS_DIR

echo "status,duration_ms" > "$RESULTS_DIR/summary.csv"
echo "id,status,duration_ms,url" > "$RESULTS_DIR/results.csv"

# Run concurrent requests
echo "Running $NUM requests with concurrency $CONCURRENCY..."
seq 1 "$NUM" | xargs -P "$CONCURRENCY" -I {} bash -c 'run_request "$@"' _ {}

# Analyze
echo ""
echo "=== RESULTS ==="

total=$(wc -l < "$RESULTS_DIR/results.csv")
total=$((total - 1))  # subtract header

ok_200=$(awk -F, 'NR>1 && $2==200' "$RESULTS_DIR/results.csv" | wc -l)
err_500=$(awk -F, 'NR>1 && $2==500' "$RESULTS_DIR/results.csv" | wc -l)
err_502=$(awk -F, 'NR>1 && $2==502' "$RESULTS_DIR/results.csv" | wc -l)
err_429=$(awk -F, 'NR>1 && $2==429' "$RESULTS_DIR/results.csv" | wc -l)
err_401=$(awk -F, 'NR>1 && $2==401' "$RESULTS_DIR/results.csv" | wc -l)
err_other=$(awk -F, 'NR>1 && $2!=200 && $2!=500 && $2!=502 && $2!=429 && $2!=401' "$RESULTS_DIR/results.csv" | wc -l)

echo "  Total:      $total"
echo "  ✓ 200 OK:   $ok_200"
echo "  ✗ 500:      $err_500"
echo "  ✗ 502:      $err_502"
echo "  ⚠ 429:      $err_429 (rate limit)"
echo "  ✗ 401:      $err_401 (auth)"
echo "  ? Other:    $err_other"

# Latency stats (only for 200 responses)
if [ "$ok_200" -gt 0 ]; then
  echo ""
  echo "=== LATENCY (200 responses only) ==="
  awk -F, 'NR>1 && $2==200 {print $3}' "$RESULTS_DIR/results.csv" | \
    sort -n | awk '
      BEGIN { sum=0; count=0 }
      { vals[NR]=$1; sum+=$1; count++ }
      END {
        if (count == 0) exit
        avg = sum / count
        p50 = vals[int(count * 0.5)]
        p90 = vals[int(count * 0.9)]
        p95 = vals[int(count * 0.95)]
        p99 = vals[int(count * 0.99)]
        printf "  count:  %d\n", count
        printf "  avg:    %dms\n", avg
        printf "  p50:    %dms\n", p50
        printf "  p90:    %dms\n", p90
        printf "  p95:    %dms\n", p95
        printf "  p99:    %dms\n", p99
        printf "  max:    %dms\n", vals[count]
      }
    '
fi

# Pass/Fail
echo ""
echo "=== PASS/FAIL ==="
success_rate=$(awk "BEGIN { printf \"%.2f\", ($ok_200 / $total) * 100 }")
echo "  Success rate: ${success_rate}%"

if awk "BEGIN { exit !($success_rate >= 95.0) }"; then
  echo "  Result: ✓ PASS (≥95% uspešnih)"
  exit 0
elif awk "BEGIN { exit !($success_rate >= 80.0) }"; then
  echo "  Result: ⚠ WARN (80-95% uspešnih)"
  exit 1
else
  echo "  Result: ✗ FAIL (<80% uspešnih)"
  exit 2
fi
