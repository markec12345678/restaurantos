# RestaurantOS — E2E Test Suite

**144/149 tests PASS (96.6%)**

## Quick Start

```bash
# Set environment
export BASE_URL=https://restaurantos-...vercel.app
export TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"pin":"1234"}' $BASE_URL/api/auth | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Run all tests
for test in tests/chaos/test-*.js; do
  echo "=== Running $(basename $test) ==="
  node "$test" --base-url=$BASE_URL --token=$TOKEN 2>&1 | tail -5
  echo ""
done

# Go-Live verification (27 checks)
node tests/chaos/go-live-verify.js --base-url=$BASE_URL --pin=1234
```

## Test Categories

| Category | Tests | Result |
|----------|-------|--------|
| Chaos Engineering | 3.1, 3.2, 3.3 | ✅ PASS |
| Financial Reconciliation | 4.1, 4.2, 4.3 | ✅ PASS |
| FURS Compliance | 5.3 | ✅ PASS |
| Offline Stress | 6.1, 6.2, 6.3 | ✅ PASS |
| Multi-Tenant | 7.1, 7.2, 7.3 | ✅ PASS |
| Security | SQLi, XSS, Auth, Rate | ✅ PASS |
| Load Testing | 500 req / 50 concurrent | ✅ PASS |
| Go-Live | 27-point check | ✅ PASS |
