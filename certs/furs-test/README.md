# FURS testni certifikati — JAVNI ključi uradnega testnega okolja

To so **javni certifikati** (brez privatnih ključev!), ki jih FURS uradno objavlja
za testno okolje davčnega potrjevanja računov. Niso skrivnost — namerno so
del repozitorija, da so testi ponovljivi v CI.

**Vir (uradna stran, razdelek "Digitalna potrdila"):**
https://edavki.durs.si/EdavkiPortal/OpenPortal/CommonPages/Opdynp/PageD.aspx?category=dpr_teh_spec

## Datoteke

| Datoteka | Namen | Veljavnost | SHA-256 |
|---|---|---|---|
| `blagajne-test.fu.gov.si.cer` | Javni ključ strežniškega TLS certifikata testnega okolja (preverjanje identitete `blagajne-test.fu.gov.si:9002`) | 10.9.2025 → 10.10.2026 | `2F:35:6F:02:44:6C:90:44:B6:C5:4E:C0:F6:D1:85:C7:A2:CD:B2:BD:05:0D:6F:22:5F:CC:F5:AC:52:DC:46:45` |
| `DavPotRacTEST.cer` | Javni ključ certifikata, s katerim FURS **podpisuje odgovore** v testnem okolju (preverjanje podpisa odgovorov, x5c v JWS headerju) | 9.4.2025 → 9.4.2030 | `8A:60:65:24:4E:85:14:E8:72:DF:2D:C5:88:20:12:4A:D5:DD:B6:22:66:AB:49:07:4F:86:91:BF:4F:08:B7:3A` |
| `si-trust-root.crt` | Korensko potrdilo SI-TRUST Root (izdajatelj SIGOV-CA) | 25.4.2016 → 25.12.2037 | `FA:D5:40:81:1A:FA:E0:DC:76:7C:DF:65:72:A0:88:FA:3C:E8:49:3D:D8:2B:3B:86:9A:67:D1:0A:AB:4E:81:24` |
| `sigov-ca.crt` | Vmesno potrdilo SIGOV-CA (izdajatelj obeh zgornjih) | 24.5.2016 → 24.5.2036 | `98:63:73:DD:A5:9F:D0:93:84:B0:A4:7C:8E:31:55:AB:74:24:EC:DA:5D:D8:2D:B2:E2:A4:3F:BD:75:91:43:4E` |

## Veriga

```
blagajne-test.fu.gov.si (TLS, strežnik)  ─┐
DavPotRacTEST (podpis odgovorov)         ─┴─→ SIGOV-CA ─→ SI-TRUST Root (samopodpisan)
```

Preverjanje: `openssl verify -CAfile si-trust-root.crt -untrusted sigov-ca.crt blagajne-test.fu.gov.si.cer`

## Kaj NI javno dostopno

**Odjemalški (namenski) certifikat za testno okolje** — p12/pfx Z PRIVATNIM KLJUČEM —
se **NE more prenesti javno**. Postopek (Tehnična dokumentacija v3.2, točka 2.3):

> Za pridobitev testnega digitalnega potrdila pošljite elektronsko sporočilo na
> **sd.fu@gov.si** z nazivom podjetja, ki razvija programsko rešitev. Testna
> potrdila so izdana na naključno davčno številko in anonimiziran naziv
> (npr. »Testna oseba n«).

Po prejemu p12 nastavite na lokaciji (Location) v app-u: `fursCertPath` + geslo.

## Živo preverjanje povezljivosti

```bash
bun run furs:check        # skripta: TLS handshake + CA veriga + echo poskus
```

Skripta potrdi: (1) strežnik je dosegljiv, (2) predstavi uradni cert
(fingerprint pin), (3) CA veriga velja, (4) zahteva odjemalški cert (mTLS) —
brez njega povezava padla, kar je pričakovano.

## Obnova (FURS rotacija certifikatov)

FURS objavlja novice ob zamenjavi (glej "Novice" na zgornji strani — npr.
2025: zamenjava TLS certifikata testnega strežnika, 2026: sprememba TLS
šifrirnih zbirk). Po rotaciji:

1. Prenesi nove .cer datoteke z uradne strani (zgoraj).
2. Zamenjaj datoteke tukaj in posodobi fingerprint tabelo + teste
   (`tests/unit/furs/test-certificates.test.ts` — pin assertioni).
3. Zaženi `bun run furs:check` in potrjevalni test: `bun test tests/unit/furs`.

## FINA / CIS (Hrvaška) — za primerjavo

Demo certifikat CIS ("Fiskalcistest", OIB 02994650199, FINA Demo CA 2020):
javni ključ se iskanja na https://demo-pki.fina.hr/certificate-search/ (kriteriji:
aplikacijski certifikati / FINA Demo CA 2020 / fiskalcistest / OIB 02994650199).
Javni demo CA certifikati: https://www.fina.hr/finadigicert/certifikati-za-testiranje-i-demonstraciju/fina-demo-ca-certifikati.
Privatni demo certifikat se zahteva prek FINA portala. App trenutno implementira
fiskalizacijo samo za SI (FURS) — HR je v country-config samo kot pripravljenost.
