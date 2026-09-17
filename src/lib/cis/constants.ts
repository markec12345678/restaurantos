// ============================================
// CIS KONSTANTE — endpointi (tehnička specifikacija v2.7)
// ============================================
// VIR (živo verificirano v scripts/cis-test-connection.sh, Task 1):
//   test: https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest
//   prod: https://cis.porezna-uprava.hr:8449/FiskalizacijaService
//
// FIX vsaj country-config/hr.ts: ta je imel napačna URL-ja
// (test brez "Test" pripone, prod na zastarel apis-it.hr host).
//
// Namespace: FIX Task 24-b — prej je bil "types/fiskalizacija", kar je NAPAČNO.
// Pravilen namespace (verificirano iz referenčne implementacije
// fiskalizacija2-js IN uradne specifikacije v1.3+) je "types/f73" —
// uporabljata ga TUDI EchoRequest in RacunZahtjev. Stari ns ni povzročil
// očitne napake pri Echo (strežnik na ne-podpisan echo odgovarja s sistemsko
// napako s006 ne glede na ns), ampak bi RacunZahtjev zavrnil.
// ============================================

import type { CisEnvironment } from './types'

export const CIS_URLS: Record<CisEnvironment, string> = {
  test: 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest',
  production: 'https://cis.porezna-uprava.hr:8449/FiskalizacijaService',
}

export const CIS_SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/'
export const CIS_NS = 'http://www.apis-it.hr/fin/2012/types/f73'

/** Demo CA pin odgovora (rotacija detector — glej certs/cis-test/README.md). */
export const CIS_TEST_RESPONSE_CERT_PIN =
  '9E:4F:51:3F:07:A8:6F:EE:13:E2:6E:08:EF:70:41:15:23:3B:82:82:B3:B1:7F:EB:0C:CE:F7:51:B0:76:1B:46'

/** Zakasnitev za povezljivostni klic (ms) — enaka kot FURS echo. */
export const CIS_CONNECTIVITY_TIMEOUT_MS = 10_000
