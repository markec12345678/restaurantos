# CIS (FINA / Porezna uprava, Hrvaška) — testni certifikati

Javni certifikati (BREZ privatnih ključev!) hrvaškega fiskalizacijskega testnega
okolja (CIS = Centralni Informacijski Sustav). Kot pri FURS niso skrivnost —
namerno so del repozitorija, da so testi ponovljivi v CI.

Strežnik testnega okolja: `https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest`
(APIS IT d.o.o. gostuje CIS test namestitev; produkcijski strežnik:
`https://cis.porezna-uprava.hr:8449/FiskalizacijaService`).

## Datoteke

| Datoteka | Namen | Veljavnost | SHA-256 |
|---|---|---|---|
| `cistest.apis-it.hr.pem` | TLS strežniški certifikat testnega okolja (pin za `cistest.apis-it.hr:8449`) | 12.12.2025 → 12.12.2026 | `0A:AB:10:E5:3A:2E:D8:BF:10:FF:F2:E7:5C:F7:C1:BD:AC:12:6E:88:88:09:84:A0:32:26:34:B7:20:0F:9C:22` |
| `fiskalcistest-chain.pem` | Veriga certifikata, s katerim CIS **podpisuje odgovore** v testnem okolju: list `fiskalcistest` (OIB 02994650199) + Fina Demo CA 2020 + Fina Demo Root CA | 6.7.2026 → 6.7.2028 | list: `9E:4F:51:3F:07:A8:6F:EE:13:E2:6E:08:EF:70:41:15:23:3B:82:82:B3:B1:7F:EB:0C:CE:F7:51:B0:76:1B:46` |
| `demo2020_sub_ca.pem` | Vmesno potrdilo Fina Demo CA 2020 (izdajatelj obeh listov zgoraj) | 31.7.2020 → 31.7.2030 | `97:71:58:6D:69:DC:A7:3D:70:E1:96:B7:AA:05:9D:EF:3D:47:B2:DE:4B:C0:80:E7:38:E5:B1:BC:8A:10:5B:D2` |
| `demo2014_root_ca.pem` | Korensko potrdilo Fina Demo Root CA (samopodpisano) | 18.3.2014 → 18.3.2034 | `A0:62:8E:66:BC:FC:6D:ED:7B:6D:84:57:DF:57:AD:54:77:EE:55:B7:D6:E1:16:1E:25:21:2B:D5:B1:B1:E1:4D` |
| `demo-ca-bundle.pem` | CA paket (root + intermediate) za `openssl s_client -CAfile` / `curl --cacert` — strežnik pošlje samo list, zato je paket obvezen | (sestavljen) | (sestavljen iz zgornjih dveh) |
| `prod-fiskalcis.pem` | PRODUKCIJSKI certifikat za podpis odgovorov (fiskalcis, MinFin, OIB 18683136487) | 31.8.2026 → 31.8.2028 | `21:53:AA:9A:D1:30:E5:18:CA:5D:4D:0E:87:F3:27:A9:FF:A2:53:0B:1A:76:56:B6:B9:8B:BE:C6:AD:B8:F2:2E` |
| `prod-FinaRDCCA2020.pem` | PRODUKCIJSKO vmesno potrdilo Fina RDC 2020 | 25.11.2020 → 25.11.2030 | (glede na Fina Root CA) |
| `prod-FinaRootCA.pem` | PRODUKCIJSKO korensko potrdilo Fina Root CA | 24.11.2015 → 24.11.2035 | (samopodpisano) |
| `prod-cis-server.pem` | PRODUKCIJSKI TLS strežniški certifikat `cis.porezna-uprava.hr` | 18.12.2025 → 18.12.2026 | `76:4B:8E:56:50:3E:7F:05:0A:67:EC:69:54:C8:5B:55:B7:84:CB:C0:8A:BC:41:41:37:76:C3:DD:50:65:5E:80` |

## Verigi

```
TEST:    cistest.apis-it.hr (TLS, strežnik)  ─┐
         fiskalcistest (podpis odgovorov)    ─┴─→ Fina Demo CA 2020 ─→ Fina Demo Root CA (samopodpisan)

PRODUKCIJA:
         cis.porezna-uprava.hr (TLS)         ─┐
         fiskalcis (podpis odgovorov)        ─┴─→ Fina RDC 2020 ─→ Fina Root CA (samopodpisan)
```

Preverjanje:
```bash
openssl verify -CAfile demo2014_root_ca.pem -untrusted demo2020_sub_ca.pem cistest.apis-it.hr.pem
openssl verify -CAfile prod-FinaRootCA.pem  -untrusted prod-FinaRDCCA2020.pem prod-fiskalcis.pem
```

## Viri (križno preverjeni)

Vsi certifikati so bili dvakrat ali trikrat neodvisno preverjeni:

1. **Uradni vir (produkcijski)**: Porezna uprava — "Certifikati za preuzimanje"
   https://porezna.gov.hr/fiskalizacija/gotovinski-racuni/tehnicki-podaci/o/certifikati-za-preuzimanje
   (zip arhivi: `fiskalcis.zip`, `cis.porezna-uprava.hr.zip`, `FinaRoot.zip`)

2. **Uradni vir (demo CA)**: FINA demo PKI portal
   https://demo-pki.fina.hr/certifikati/ (DemoRootCAG2, DemoQCA2024, demo2020_sub_ca, ...)

3. **Neodvisna kopija (obe verigi)**: GitHub `l-d-t/fiskalhrgo` (certDemo/ + certProd/,
   posodobljen po rotaciji julija 2026) — list `fiskalcis` se prstno ujema (SHA-256)
   z uradnim zip-om Porezne uprave; Fina Demo Root CA se ujema z GitHub `kodmasin/fiskpy`.

4. **Živo (testno okolje)**: TLS handshake z `cistest.apis-it.hr:8449` (2026-09-10)
   predstavi certifikat, ki se prstno ujema s `cistest.apis-it.hr.pem` in verifikira
   z demo verigo. Protokol: TLS 1.3.

## Rotacija Fiskalcistest (9. julij 2026)

Stari demo certifikat je potekel sredi julija 2026; Porezna uprava ga je zamenjala
9. 7. 2026. Ta paket vsebuje NOVI certifikat (veljaven do 6. 7. 2028).
Vir obvestila: https://porezna-uprava.gov.hr/hr/istek-demo-fiskalcistest-certifikata-sredinom-srpnja-2026-godine/8614

## Kaj NI javno dostopno

**Odjemalški demo aplikacijski certifikat (P12/PFX Z ZASEBNIM KLJUČEM)** se NE more
prenesti javno s spleta — preverjeno (GitHub knjižnice fiskalhrgo/fiskpy/SLOTax/
senko-fiskal-hr vsebujejo LE javne certifikate ali lokalno samopodpisane teste;
zastareli javni FURS demo `demo_podjetje.p12` iz Ruby knjižnice je potekel 2020).

Uradni postopek (FINA — "Izdavanje Demo aplikacijskog certifikata za fiskalizaciju"):
https://www.fina.hr/poslovni-digitalni-certifikati/poslovni-certifikati-za-fiskalizaciju/izdavanje-demo-aplikacijskog-certifikata-za-fiskalizaciju

1. Prenesi in izpolni zahtevek za izdajo democertifikata.
2. Predaj izpolnjeno dokumentacijo FINA DigiCert službi.
3. Skrbnik prenese certifikat prek portala https://demo-usercert.fina.hr/cms-user-portal/

Po prejemu P12 nastavi v aplikaciji: `finaCertPath` + geslo (na Location nivoju).

## Živo preverjanje povezljivosti

```bash
bun run fina:check        # skripta: TLS handshake + demo veriga + pin + mTLS poskus
```

Skripta potrdi: (1) cistest strežnik dosegljiv, (2) predstavlja uradni demo cert
(fingerprint pin), (3) CA veriga velja, (4) brez odjemalškega P12 strežnik prezve
zahtevo — nadaljnja komunikacija zahteva demo certifikat iz FINA portala.

## Obnova (rotacija CIS certifikatov)

Porezna uprava objavlja obvestila ob zamenjavi (glej "Novosti" na porezna.gov.hr —
npr. 2026: zamenjava Fiskalcistest dema certifikata 9. 7. 2026, produkcijskega
fiskalcis 31. 8. 2026, strežniškega cis.porezna-uprava.hr 18. 12. 2025). Po rotaciji:

1. Prenesi nove zip datoteke z uradne strani (zgoraj).
2. Zamenjaj datoteke tukaj in posodobi fingerprint tabelo + pin assertione v
   `tests/unit/cis/test-certificates.test.ts`.
3. Zaženi `bun run fina:check` in potrjevalni test: `bun test tests/unit/cis`.

## Tehnična dokumentacija

- CIS tehnička specifikacija v2.7 (21. 7. 2026):
  https://porezna-uprava.gov.hr/UserDocsImages/Fiskalizacija/Tehničke%20specifikacije/Fiskalizacija%20-%20Tehnicka%20specifikacija%20za%20korisnike_v2.7%20(21.07.2026.).pdf
- Aplikacija trenutno implementira fiskalizacijo samo za SI (FURS); ti certifikati
  so priprava za HR podporo (country-config) — enaka zgradba kot certs/furs-test/.
