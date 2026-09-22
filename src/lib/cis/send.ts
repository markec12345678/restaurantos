// ============================================
// CIS SEND — transport podpisanega RacunZahtjev + RacunOdgovor parsing
// ============================================
// Zadnji kos za polno HR fiskalizacijo (runda 27):
//   buildRacunZahtjev (ZKI) → signRacunZahtjev (XML-dsig) → soapPost →
//   parseRacunOdgovor (JIR / SifraGreske).
//
// Spec (tehnička v2.7): uspeh = RacunOdgovor z JIR (17-mestna številka) in
// brez SifraGreske. Napaka = RacunOdgovor z <SifraGreske> (b/r/s kode) +
// <PorukaGreske>, ali klasičen SOAP Fault (sistemske s00x napake).
//
// API je NON-THROWING — zrcali checkCisConnectivity() (echo.ts): vsak
// rezultat (tudi mrežna napaka) je struktura, nikoli izjema. Razlog:
// klic teče iz API route handlerjev, kjer želimo rezultat direktno logirati
// v fiskalni audit trail in vrniti 200 z statusom posla (POS mora delovati
// OFFLINE — neuspešna fiskalizacija NE blokira prodaje, samo flagira).
// ============================================

import { logger } from '@/lib/logger'
import type { CisConfigValidation, CisEnvironment } from './types'
import { CIS_URLS, CIS_CONNECTIVITY_TIMEOUT_MS } from './constants'
import { CIS_TEST_CA_PEM } from './demo-ca'
import { CIS_PROD_CA_PEM } from './prod-ca'
import { soapPost } from './transport'
import { buildRacunZahtjev } from './invoice'
import type { CisRacunData } from './invoice'
import { signRacunZahtjev } from './xmlsig'
import type { CisP12Pems } from './p12'

// --------------------------------------------
// Tipi
// --------------------------------------------

/** Rezultat pošiljanja RacunZahtjev na CIS (non-throwing). */
export interface CisSendResult {
  /** true = JIR prejet, brez SifraGreske — račun je fiskaliziran. */
  ok: boolean
  /** JIR iz RacunOdgovor (17 števk) — obstaja samo ob ok=true. */
  jir?: string
  /** Naš izračunani ZKI (iz buildRacunZahtjev — za audit trail). */
  zki?: string
  /** UUID sporočila (IdPoruke) — korelacija z odgovorom/logi. */
  idPoruke?: string
  /** HTTP status odgovora (če je prišel do odgovora). */
  httpStatus?: number
  /** Skupni odzivni čas build+sign+send+parse v ms. */
  responseTime?: number
  /** Koda napake strežnika (SifraGreske ali sistemska s00x iz SustavPoruka/Fault). */
  serverErrorCode?: string
  /** Človeku berljiva napaka strežnika (PorukaGreske / FaultReason) ali transporta. */
  errorMessage?: string
  /** Podatki o transportni napaki (istovetna z errorMessage pri mrežnih napakah). */
  error?: string
  /** Validacija vhodnih podatkov — prisotna, ko je zahteva sploh ni šla na žico. */
  validation?: CisConfigValidation
  /** PODPISAN SOAP envelope (debug/audit — vsebuje ds:Signature). */
  signedEnvelope?: string
}

/** Razpakiran RacunOdgovor (ali SOAP Fault) — čista funkcija. */
export interface CisRacunOdgovor {
  /** JIR — samo ob uspešni fiskalizaciji. */
  jir?: string
  /** ZKI echo (strežnik ga lahko vrne za primerjavo). */
  zki?: string
  /** Echo IdPoruke iz zaglavlja odgovora. */
  idPoruke?: string
  /** Poslovna/sistemska napaka (b001, r001, s006 …) — obstoječa brez JIR. */
  sifraGreske?: string
  /** Besedilo napake. */
  porukaGreske?: string
  /** Sistemski koda (s000 = uspeh brez JIR ni možen pri RacunOdgovor; s006 …). */
  sustavPoruka?: string
  /** true, če je odgovor klasičen SOAP Fault. */
  isFault: boolean
}

// --------------------------------------------
// Parsing — regex pristop (kontroliran odgovor strežnika; enako kot echo)
// --------------------------------------------

/**
 * Izlušči besedilo prvega elementa z danim LOCAL imenom (s poljubnim prefixom
 * ali brez). Case-sensitive, ker so elementi sheme CamelCase (Jir, BrRac …).
 */
function tagText(xml: string, localName: string): string | undefined {
  const re = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${localName}\\s*>`
  )
  const m = re.exec(xml)
  return m ? m[1].trim() : undefined
}

/** SOAP Fault lokator (Fault element je v soap namespace-u). */
function findSoapFaultText(xml: string): string | undefined {
  // faultstring (SOAP 1.1) ali Reason/Text (SOAP 1.2) — CIS ne uporablja
  // enotno, pokrijemo oba; plus SustavPoruka/PorukaGreske znotraj detail.
  return tagText(xml, 'faultstring') ?? tagText(xml, 'Text') ?? undefined
}

/**
 * Razpakiraj RacunOdgovor XML (čista funkcija, non-throwing).
 *
 * Prepozna:
 *  - RacunOdgovor z <Jir> → uspeh
 *  - RacunOdgovor/FiskalizacijaError z <SifraGreske> + <PorukaGreske> → poslovna napaka
 *  - soap:Fault (faultstring / Reason/Text) → sistemska napaka (besedilo gre v porukaGreske)
 */
export function parseRacunOdgovor(xml: string): CisRacunOdgovor {
  // <Jir> po shemi v2.7; nekateri strežniki pišejo JIR — pokrijemo oba zapisa
  const jir = tagText(xml, 'Jir') ?? tagText(xml, 'JIR')
  const sifraGreske = tagText(xml, 'SifraGreske')
  const sustavPoruka = tagText(xml, 'SustavPoruka')
  const faultText = findSoapFaultText(xml)
  const isFault = /<(?:[\w.-]*:)?Fault[\s>]/.test(xml)

  return {
    jir,
    zki: tagText(xml, 'Zki') ?? tagText(xml, 'ZKI'),
    idPoruke: tagText(xml, 'IdPoruke'),
    sifraGreske,
    // pri Fault-u je besedilo napake v faultstring/Reason — preslikaj v porukaGreske,
    // da klicatelj nima dveh virov istega podatka
    porukaGreske: tagText(xml, 'PorukaGreske') ?? (isFault ? faultText : undefined),
    sustavPoruka,
    isFault,
  }
}

/** JIR mora biti 17-mestno število (spec v2.7). */
export function isValidJir(jir: string | undefined): jir is string {
  return typeof jir === 'string' && /^\d{17}$/.test(jir)
}

// --------------------------------------------
// Build + sign (odprto za klicatelje, ki hočejo envelope shraniti PRED pošiljanjem)
// --------------------------------------------

export interface CisSignedRequest {
  /** PODPISAN SOAP envelope ('' ob napaki). */
  envelope: string
  /** Izračunani ZKI ('' ob napaki). */
  zki: string
  /** UUID sporočila (vedno prisoten — uporaben za log nevalidnih zahtev). */
  idPoruke: string
  validation: CisConfigValidation
}

/**
 * Zgradi IN podpiše RacunZahtjev v enem klicu (compose buildRacunZahtjev +
 * signRacunZahtjev z propagacijo napak). Non-throwing.
 */
export function buildSignedRacunZahtjev(
  data: CisRacunData,
  pems: CisP12Pems,
  opts: { now?: Date } = {}
): CisSignedRequest {
  const built = buildRacunZahtjev(data, pems.privateKeyPem, { now: opts.now })
  if (!built.validation.valid || !built.envelope) {
    return { envelope: '', zki: '', idPoruke: built.idPoruke, validation: built.validation }
  }

  const signed = signRacunZahtjev(built.envelope, {
    certificatePem: pems.certificatePem,
    privateKeyPem: pems.privateKeyPem,
  })
  if (!signed.validation.valid || !signed.envelope) {
    return { envelope: '', zki: built.zki, idPoruke: built.idPoruke, validation: signed.validation }
  }

  return { envelope: signed.envelope, zki: built.zki, idPoruke: built.idPoruke, validation: built.validation }
}

// --------------------------------------------
// Pošiljanje
// --------------------------------------------

/**
 * Pošlji fiskalni račun na CIS (RacunZahtjev → RacunOdgovor/JIR).
 * NON-THROWING — mrežne napake so rezultat z ok=false + error.
 */
export async function sendRacunZahtjev(
  environment: CisEnvironment,
  data: CisRacunData,
  pems: CisP12Pems,
  options: { timeoutMs?: number; now?: Date } = {}
): Promise<CisSendResult> {
  const start = Date.now()

  const request = buildSignedRacunZahtjev(data, pems, { now: options.now })
  if (!request.envelope) {
    return {
      ok: false,
      idPoruke: request.idPoruke,
      zki: request.zki || undefined,
      validation: request.validation,
      errorMessage: request.validation.errors.join('; ') || 'Zahteva ni bila zgrajena (validacija)',
    }
  }

  // TLS trust anchor per okolje (enako kot echo: test = Fina Demo CA, prod = javna veriga)
  const ca = environment === 'test' ? CIS_TEST_CA_PEM : CIS_PROD_CA_PEM

  try {
    const { status, body } = await soapPost(
      CIS_URLS[environment],
      request.envelope,
      { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      { ca, timeoutMs: options.timeoutMs ?? CIS_CONNECTIVITY_TIMEOUT_MS }
    )

    const responseTime = Date.now() - start
    const odgovor = parseRacunOdgovor(body)

    // Napaka: poslovna (SifraGreske) ALI SOAP Fault. Sistemski s000 je "uspeh"
    // oznaka sistemske plasti — ne velja kot napaka.
    const hasBusinessError = odgovor.sifraGreske !== undefined && odgovor.sifraGreske !== 's000'
    const hasFault = odgovor.isFault

    if (hasBusinessError || hasFault || !odgovor.jir) {
      const code =
        odgovor.sifraGreske ??
        odgovor.sustavPoruka ??
        (hasFault ? 's000-fault' : undefined)
      const message =
        odgovor.porukaGreske ?? findSoapFaultText(body) ?? (hasFault ? 'SOAP Fault' : undefined)

      return {
        ok: false,
        jir: undefined,
        zki: request.zki,
        idPoruke: odgovor.idPoruke ?? request.idPoruke,
        httpStatus: status,
        responseTime,
        serverErrorCode: code,
        errorMessage: message ?? (!odgovor.jir ? `Odgovor brez JIR (HTTP ${status}, ${body.length} B)` : undefined),
        signedEnvelope: request.envelope,
      }
    }

    // Uspeh — JIR obvezno 17-mestna številka po spec (defenzivno: če strežnik
    // vrne nenormalen JIR, ga vseeno spustimo, ampak logiramo opozorilo).
    if (!isValidJir(odgovor.jir)) {
      logger.warn('CIS', `JIR nenormalnega formata (pričakovano 17 števk): "${odgovor.jir}"`)
    }

    return {
      ok: true,
      jir: odgovor.jir,
      zki: request.zki,
      idPoruke: odgovor.idPoruke ?? request.idPoruke,
      httpStatus: status,
      responseTime,
      signedEnvelope: request.envelope,
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Neznana napaka'
    logger.warn('CIS', `RacunZahtjev neuspešen (${environment}):`, error)
    return {
      ok: false,
      zki: request.zki,
      idPoruke: request.idPoruke,
      error,
      errorMessage: error,
      signedEnvelope: request.envelope,
    }
  }
}
