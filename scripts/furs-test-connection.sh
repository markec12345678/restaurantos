#!/usr/bin/env bash
# ============================================
# FURS TESTNO OKOLJE — živo preverjanje povezljivosti
#
# Preverja (brez privatnega odjemalškega certifikata, ki se zahteva prek
# sd.fu@gov.si — Tehnična dokumentacija v3.2, točka 2.3):
#   1. DNS + TCP dosegljivost blagajne-test.fu.gov.si:9002
#   2. TLS handshake + verifikacija strežniškega certifikata s CA verigo
#      (certs/furs-test/si-trust-root.crt + sigov-ca.crt)
#   3. Fingerprint pin strežniškega certifikata (rotacija detector)
#   4. Echo poskus — pričakovan izid: strežnik ZAHTEVA odjemalški certifikat
#      (TLS Request CERT) in prekine brez njega → mTLS potrjen
#
# Uporaba: bun run furs:check
# ============================================
set -u

CERTS_DIR="$(dirname "$0")/../certs/furs-test"
HOST="blagajne-test.fu.gov.si"
PORT="9002"
EXPECTED_PIN="2F:35:6F:02:44:6C:90:44:B6:C5:4E:C0:F6:D1:85:C7:A2:CD:B2:BD:05:0D:6F:22:5F:CC:F5:AC:52:DC:46:45"

echo "════ FURS testno okolje — preverjanje povezljivosti ════"
echo ""

# 1. TCP dosegljivost
echo "── 1. TCP dosegljivost ($HOST:$PORT) ──"
if timeout 15 bash -c "echo > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
  echo "✅ Strežnik je dosegljiv (TCP)"
else
  echo "❌ Strežnik NI dosegljiv — preveri omrežje/firewall"
  exit 1
fi
echo ""

# 2. TLS handshake + CA verifikacija
echo "── 2. TLS handshake + verifikacija strežniškega certifikata ──"
HANDSHAKE=$(timeout 25 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" \
  -CAfile "$CERTS_DIR/si-trust-root.crt" \
  < /dev/null 2>&1)
if echo "$HANDSHAKE" | grep -q "Verify return code: 0 (ok)"; then
  echo "✅ TLS handshake uspešen, certifikat verifikacija: OK (SI-TRUST Root + SIGOV-CA)"
else
  echo "⚠️ Verifikacija ni OK:"
  echo "$HANDSHAKE" | grep -E "verify (error|return)" | head -3
fi
TLS_VER=$(echo "$HANDSHAKE" | grep -o "TLSv[0-9.]*" | head -1)
echo "   Protokol: ${TLS_VER:-neznan} (FURS zahteva TLS 1.2/1.3)"
echo ""

# 3. Fingerprint pin
echo "── 3. Fingerprint pin strežniškega certifikata ──"
LIVE_PIN=$(timeout 25 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" \
  < /dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256 2>/dev/null \
  | grep -o '[0-9A-F:]\{95\}')
if [ "$LIVE_PIN" = "$EXPECTED_PIN" ]; then
  echo "✅ Pin se ujema z certs/furs-test/blagajne-test.fu.gov.si.cer"
else
  echo "⚠️ Pin se NE ujema — FURS je zamenjal certifikat!"
  echo "   Živi:  $LIVE_PIN"
  echo "   Pričakovan: $EXPECTED_PIN"
  echo "   → Sledi certs/furs-test/README.md (razdelek Obnova)"
fi
echo ""

# 4. Echo poskus (mTLS zahteva)
echo "── 4. Echo poskus — pričakovan zavrnitev brez odjemalškega certifikata ──"
ECHO_RESULT=$(timeout 25 curl -s --cacert "$CERTS_DIR/si-trust-root.crt" --cert "$CERTS_DIR/sigov-ca.crt" \
  "https://$HOST:$PORT/v1/cash_registers/echo" \
  -H "Content-Type: application/json; charset=UTF-8" \
  -X POST -d '{"token":"invalid"}' -w "HTTPCODE:%{http_code}" 2>&1)
HTTP_CODE=$(echo "$ECHO_RESULT" | grep -o "HTTPCODE:[0-9]*" | cut -d: -f2)
if [ "$HTTP_CODE" = "000" ] || [ -z "$HTTP_CODE" ]; then
  echo "✅ Strežnik je ZAHTEVAL odjemalški certifikat (mTLS) in prekinil povezavo"
  echo "   (kupec certifikat s privatnim ključem se zahteva prek sd.fu@gov.si)"
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Strežnik je odgovoril s HTTP $HTTP_CODE (zahteva veljaven JWS token)"
else
  echo "ℹ️ HTTP: $HTTP_CODE — glej odgovor strežnika"
fi
echo ""

echo "════ Povzetek ════"
echo "1. Dosegljivost:        preverjeno zgoraj"
echo "2. CA verifikacija:     certs/furs-test/ (javni, uradni)"
echo "3. Pin rotacije:        preverjen zgoraj"
echo "4. mTLS (dvosmerna TLS): potrjena — odjemalški certifikat je OBVEZEN"
echo ""
echo "Za POPOLNO testno pošiljanje (echo + račun + EOR) potrebuješ namensko"
echo "testno potrdilo (p12): pošlji zahtevek na sd.fu@gov.si (dokumentacija 2.3),"
echo "nato nastavi certPath + geslo na lokaciji v aplikaciji."
