#!/usr/bin/env bash
# ============================================
# CIS (FINA / Porezna uprava, HR) TESTNO OKOLJE — živo preverjanje povezljivosti
#
# Zrcalna struktura scripts/furs-test-connection.sh.
#
# Preverja (brez privatnega demo odjemalškega certifikata, ki se zahteva prek
# FINA DigiCert portala — glej certs/cis-test/README.md):
#   1. DNS + TCP dosegljivost cistest.apis-it.hr:8449
#   2. TLS handshake (TLS 1.3) + verifikacija strežniškega certifikata z
#      DEMO CA paketom (demo-ca-bundle.pem = Fina Demo Root CA + Demo CA 2020)
#   3. Fingerprint pin strežniškega certifikata (rotacija detector)
#   4. ŽIV SOAP POST — strežnik odgovori s podpisanim Odgovorjem (s006 za
#      prazen envelope je pričakovan); certifikat v podpisu odgovora se
#      primerja z certs/cis-test/fiskalcistest-chain.pem (PIN)
#
# Ključna razlika proti FURS: CIS ne zahteva odjemalškega certifikata na TLS
# nivoju — demo P12 se uporablja za XML podpis sporočil (soap:Body), ne za
# mTLS. Zato živ POST deluje brez certifikata (strežnik vrne s006).
#
# Endpoint (CIS tehnička specifikacija v2.7):
#   test: https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest
#   prod: https://cis.porezna-uprava.hr:8449/FiskalizacijaService
#
# Uporaba: bun run fina:check
# ============================================
set -u

CERTS_DIR="$(dirname "$0")/../certs/cis-test"
HOST="cistest.apis-it.hr"
PORT="8449"
PATH_SUFFIX="/FiskalizacijaServiceTest"
EXPECTED_PIN="0A:AB:10:E5:3A:2E:D8:BF:10:FF:F2:E7:5C:F7:C1:BD:AC:12:6E:88:88:09:84:A0:32:26:34:B7:20:0F:9C:22"
EXPECTED_RESPONSE_CERT_PIN="9E:4F:51:3F:07:A8:6F:EE:13:E2:6E:08:EF:70:41:15:23:3B:82:82:B3:B1:7F:EB:0C:CE:F7:51:B0:76:1B:46"
TMP_RESPONSE="$(mktemp /tmp/cis-response-XXXXXX.xml)"
TMP_CERT="$(mktemp /tmp/cis-resp-cert-XXXXXX.pem)"
trap 'rm -f "$TMP_RESPONSE" "$TMP_CERT"' EXIT

echo "════ CIS testno okolje (Hrvaška) — preverjanje povezljivosti ════"
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

# 2. TLS handshake + verifikacija z demo CA paketom
#    (strežnik pošlje samo list certifikat — CA bundle vsebuje oba CA)
echo "── 2. TLS handshake + verifikacija strežniškega certifikata ──"
HANDSHAKE=$(timeout 25 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" \
  -CAfile "$CERTS_DIR/demo-ca-bundle.pem" \
  < /dev/null 2>&1)
TLS_VER=$(echo "$HANDSHAKE" | grep -o "TLSv[0-9.]*" | head -1)
if echo "$HANDSHAKE" | grep -q "Verify return code: 0 (ok)"; then
  echo "✅ TLS handshake uspešen, verifikacija: OK (Fina Demo Root CA + Fina Demo CA 2020)"
  echo "   Protokol: ${TLS_VER:-neznan}"
else
  echo "⚠️ Verifikacija ni OK:"
  echo "$HANDSHAKE" | grep -E "verify (error|return)" | head -3
  echo "   Protokol: ${TLS_VER:-neznan}"
fi
echo ""

# 3. Fingerprint pin strežniškega certifikata
echo "── 3. Fingerprint pin strežniškega certifikata ──"
LIVE_PIN=$(timeout 25 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" \
  < /dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256 2>/dev/null \
  | grep -o '[0-9A-F:]\{95\}')
if [ "$LIVE_PIN" = "$EXPECTED_PIN" ]; then
  echo "✅ Pin se ujema z certs/cis-test/cistest.apis-it.hr.pem"
else
  echo "⚠️ Pin se NE ujema — CIS je zamenjal strežniški certifikat!"
  echo "   Živi:  $LIVE_PIN"
  echo "   Pričakovan: $EXPECTED_PIN"
  echo "   → Sledi certs/cis-test/README.md (razdelek Obnova)"
fi
echo ""

# 4. Živ SOAP POST + preverjanje certifikata v podpisu odgovora
echo "── 4. Živ SOAP POST — podpisan Odgovor + certifikat v podpisu ──"
HTTP_CODE=$(timeout 25 curl -s --cacert "$CERTS_DIR/demo-ca-bundle.pem" \
  "https://$HOST:$PORT$PATH_SUFFIX" \
  -X POST -H "Content-Type: text/xml;charset=UTF-8" \
  -d '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body/></soapenv:Envelope>' \
  -o "$TMP_RESPONSE" -w "%{http_code}" 2>/dev/null)

if [ ! -s "$TMP_RESPONSE" ]; then
  echo "❌ Brez odgovora (HTTP $HTTP_CODE) — strežnik ni odziven"
  exit 1
fi
echo "✅ Strežnik je odgovoril (HTTP $HTTP_CODE; s006 = sistemska pogreška za prazen envelope — pričakovano)"

# Izlušči X509Certificate iz Signature/KeyInfo in primerjaj pin
node -e "
const fs = require('fs');
const xml = fs.readFileSync('$TMP_RESPONSE', 'utf8');
const m = xml.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/);
if (!m) { process.exit(1); }
const b64 = m[1].trim();
const lines = b64.match(/.{1,64}/g) || [];
fs.writeFileSync('$TMP_CERT', '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----\n');
" 2>/dev/null

if [ -s "$TMP_CERT" ]; then
  RESPONSE_PIN=$(openssl x509 -in "$TMP_CERT" -noout -fingerprint -sha256 2>/dev/null | grep -o '[0-9A-F:]\{95\}')
  if [ "$RESPONSE_PIN" = "$EXPECTED_RESPONSE_CERT_PIN" ]; then
    echo "✅ Certifikat v podpisu odgovora = fiskalcistest (PIN ujemanje)"
    echo "   → naše certs/cis-test/fiskalcistest-chain.pem JE certifikat, s katerim"
    echo "     strežnik dejavno podpisuje odgovore (overitev podpisov bo delovala)"
  else
    echo "⚠️ Certifikat v odgovoru se NE ujema s paketom!"
    echo "   Živi:  $RESPONSE_PIN"
    echo "   Pričakovan: $EXPECTED_RESPONSE_CERT_PIN"
    echo "   → Sledi certs/cis-test/README.md (razdelek Obnova)"
  fi
else
  echo "⚠️ V odgovoru ni certifikata v podpisu — preveri strukturo"
fi
echo ""

echo "════ Povzetek ════"
echo "1. Dosegljivost:        preverjeno zgoraj"
echo "2. CA verifikacija:     certs/cis-test/demo-ca-bundle.pem (javni, uradni)"
echo "3. Pin rotacije:        preverjen zgoraj"
echo "4. Podpis odgovorov:    fiskalcistest cert overjen ŽIVO iz strežniškega odgovora"
echo "5. Odjemalški demo cert: za racun/JIR zahtevan P12 z zasebnim ključem —"
echo "   izda se prek FINA portala demo-usercert.fina.hr (certs/cis-test/README.md)"
echo ""
echo "Za POPOLNO testno pošiljanje (racun + JIR) izpolni zahtevek na FINA strani,"
echo "nato nastavi certPath + geslo na lokaciji v aplikaciji."
