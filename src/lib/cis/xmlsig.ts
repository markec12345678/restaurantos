// ============================================
// CIS XML-DSIG — enveloped podpis RacunZahtjev (HR fiskalizacija, Task 26-a)
// ============================================
// ZADNJI MANJKAJOČI KOS pred oddajo računa na FINA fiskalni strežnik:
// ds:Signature kot ZADNJI otrok elementa tns:RacunZahtjev (v soap:Body).
//
// SPEC FAKTI (verificirano proti referenčni implementaciji `fiskalizacija2`
// 0.16.1 na npm — avtor shunkica; extrahirano iz minified bundle-a, funkcija
// `signFiskalizacija1Request`, ki uporablja xml-crypto):
//   - CanonicalizationMethod: http://www.w3.org/2001/10/xml-exc-c14n#
//     (EXCLUSIVE C14N 1.0 — NE c14n11, čeprak ga je predlagal plac opis;
//     referenca + FINA sprejemata exc-c14n, zato sledimo referenci)
//   - SignatureMethod: http://www.w3.org/2001/04/xmldsig-more#rsa-sha256
//   - DigestMethod:    http://www.w3.org/2001/04/xmlenc#sha256
//   - Reference URI = "#" + Id atribut RacunZahtjev (xml-crypto xpath:
//     //*[@Id='<id>']), Transforms (TOČNO ta red):
//       1. http://www.w3.org/2000/09/xmldsig#enveloped-signature
//       2. http://www.w3.org/2001/10/xml-exc-c14n#
//   - Signature se pripenja kot ZADNJI otrok korenskega (RacunZahtjev)
//     elementa (xml-crypto location {reference:"/*", action:"append"}),
//     SOAP envelope se ovije OKOLI PODPISANEGA elementa.
//   - KeyInfo vsebuje base64 DER certifikat (referenca dodaja še
//     X509SubjectName/X509IssuerSerial — informativni; mi oddajamo samo
//     obvezen ds:X509Certificate, dovolj po XML-dsig shemi).
//
// STRATEGIJA KANONIZACIJE (byte-level, dokumentirano):
// Naš builder (invoice.ts) producira DETERMINISTIČEN XML iz kontrolirane
// množice konstrukcij (brez CDATA, komentarjev, PI, DTD, samo tns: prefix
// + opcijski ds: na Signature). Zato "canonical form" dosežemo s KONSTRUKCIJO
// — mini-c14n spodaj re-serializira izluščen tns:RacunZahtjev fragment po
// pravilih EXCLUSIVE C14N 1.0 (W3C, 2002):
//   1. enveloped transform: ds:Signature otrok se ODSTRANI pred digestom —
//      IN TO SAMO kot VOZLIŠČE (whitespace besedilna vozlišča OKOLI njega
//      OSTANEJO v dokumentu). Zato podpis VSTAVIMO BREZ dodatnega whitespace-a
//      (takoj pred zaključno značko, kot dela xml-crypto) — potem je pogled
//      verifikatorja po odstranitvi Signature vozlišča BYTE-IDENTIČEN
//      nepodpisanemu envelope-u, digest pa je dobro definiran in idempotenten.
//   2. komentarji in processing instructioni se IZPUSTIJO (c14n brez
//      komentarjev; builder jih ne producira — vseeno obravnavano).
//   3. prazni elementi <x/> se RAZŠIRIJO v <x></x> (c14n pravilo).
//   4. besedilna vozlišča: entitete se razpakirajo (kontrolirana množica
//      builderja: &amp; &lt; &gt; &quot; &apos; + numerične xD/xA/x9), nato
//      re-escape po c14n: & → &amp;, < → &lt;, > → &gt;, CR → &#xD;.
//      POMEMBNO: c14n v besedilu NE escape-ira " in ' — zato naš builderjev
//      &quot; v besedilu (npr. SpecNamj) postane v kanonični obliki DOLOEN
//      znak " — mini-c14n to upošteva, surovi substring pa ne! (pogosta
//      napaka pri digest-over-raw-bytes pristopih)
//   5. atributi: namespace deklaracije PRVE (urejene po prefixu), ostali
//      atributi za njimi (urejeni po local-name — vsi v našem nizu brez
//      namespace-a); vrednosti escape-irane po c14n (& < " TAB LF CR).
//   6. imenski prostori (exc-c14n "visibly utilized"): na korenskem elementu
//      fragmenta se izpišejo SAMO deklaracije, katerih prefix je dejansko
      // uporabljen (značka/atributi) — xmlns:soap iz Envelope ovoja TAKO
//      pravilno IZPADE, ds: pa se za SignedInfo fragment VSTAVI (dedovan
//      od ds:Signature, v kanonični obliki na vrhu fragmenta).
//   7. whitespace besedilna vozlišča se OHRANIJO byte-po-byte (c14n jih ne
//      normalizira); vrstični konci so že \n (builder) — CR-LF se normalizira.
//
// Determinizem: RSA-SHA256 PKCS#1 v1.5 podpis je determinističen (padding ni
// naključen) → isti vhod + isti ključ → identičen podpis. `opts.now` je
// sprejet za doslednost API-ja (kot pri buildRacunZahtjev), ampak XML-dsig
// NE vsebuje časovnega žiga — parameter je namenoma neuporabljen.
// ============================================

import { createHash, createSign } from 'node:crypto'
import {
  CIS_ALG_CANONICALIZATION,
  CIS_ALG_ENVELOPED,
  CIS_ALG_RSA_SHA256,
  CIS_ALG_SHA256_DIGEST,
  CIS_XMLDSIG_NS,
} from './constants'
import type { CisConfigValidation } from './types'

/** Rezultat podpisovanja (non-throwing, zrcali CisInvoiceRequestResult stil). */
export interface CisSignatureResult {
  /** SOAP envelope z ds:Signature kot zadnjim otrokom RacunZahtjev ('' pri napaki). */
  envelope: string
  /** base64 DigestValue (debug/log). */
  digestValue: string
  /** base64 SignatureValue (debug/log). */
  signatureValue: string
  /** Kanonični SignedInfo (UTF-8 niz) — javljen za testabilnost (kot zkiInputString). */
  signedInfoCanonical: string
  /** Napake/opozorila (non-throwing). */
  validation: CisConfigValidation
}

/** Opcije signRacunZahtjev. */
export interface CisSignOptions {
  /** Certifikat (PEM) — njegov DER gre v ds:X509Certificate, javni ključ verificira. */
  certificatePem: string | Buffer
  /** Zasebni ključ (PEM, PKCS#8 ali PKCS#1) — podpisuje kanonični SignedInfo. */
  privateKeyPem: string | Buffer
  /**
   * Rezervirano za doslednost z buildRacunZahtjev API-jem. XML-dsig NIMA
   * časovnega žiga, RSA PKCS#1 v1.5 pa je determinističen — parameter ne
   * vpliva na izhod (dokumentirano: namenoma neuporabljen).
   */
  now?: Date
}

// --------------------------------------------
// Mini exclusive-C14N za kontroliran niz XML konstrukcij
// --------------------------------------------

interface C14nOptions {
  /** Imenski prostori, vstavljeni v začetno značko korena (npr. ds za SignedInfo). */
  rootNamespaces?: Record<string, string>
}

/** Znane entitete builderja (+ numerične, ki jih c14n sreča ob CR/LF/TAB). */
const KNOWN_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#xD': '\r',
  '#xA': '\n',
  '#x9': '\t',
}

/** Razpakiraj znane entitete (en prehod — &amp; ne povzroči dvojnega razpakiranja). */
function unescapeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, name: string) => {
    if (name in KNOWN_ENTITIES) return KNOWN_ENTITIES[name]
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return String.fromCodePoint(parseInt(name.slice(2), 16))
    }
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10))
    throw new Error(`mini-c14n: neznana XML entiteta "${match}" (kontroliran niz builderja pozna samo &amp; &lt; &gt; &quot; &apos;)`)
  })
}

/** c14n escape BESEDILA: & < > (in CR, ki ga prej normaliziramo) — " in ' OSTANETA. */
function escapeC14nText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;')
}

/** c14n escape VREDNOSTI ATRIBUTA: & < " + TAB/LF/CR kot znakovne reference. */
function escapeC14nAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;')
}

/** Besedilno vozlišče: normaliziraj CR-LF, razpakiraj entitete, re-escape po c14n. */
function canonText(s: string): string {
  return escapeC14nText(unescapeEntities(s.replace(/\r\n?/g, '\n')))
}

interface ParsedAttr {
  rawName: string
  value: string
  isNamespace: boolean
  nsPrefix: string | null
  sortKey: string
}

/** Najdi konec začetne značke (indeks '>') s spoštovanjem navedkov. */
function findTagEnd(src: string, from: number): number {
  let inQuote: string | null = null
  for (let i = from; i < src.length; i++) {
    const ch = src[i]
    if (inQuote) {
      if (ch === inQuote) inQuote = null
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === '>') {
      return i
    }
  }
  throw new Error('mini-c14n: nedokončana XML značka (manjka >)')
}

/** Parse začetne značke → ime + atributi (vrednosti razpakirane) + selfClosing. */
function parseStartTag(tagSrc: string): { name: string; attrs: ParsedAttr[]; selfClosing: boolean } {
  const inner = tagSrc.slice(1, -1).replace(/\/$/, '')
  const selfClosing = /\/\s*$/.test(tagSrc.slice(1, -1))
  const nameMatch = /^[^\s/>]+/.exec(inner)
  if (!nameMatch) throw new Error(`mini-c14n: neveljavna značka "${tagSrc}"`)
  const name = nameMatch[0]
  const attrs: ParsedAttr[] = []
  const attrRe = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(inner)) !== null) {
    const rawName = m[1]
    const rawValue = m[3] ?? m[4] ?? ''
    const isNamespace = rawName === 'xmlns' || rawName.startsWith('xmlns:')
    const nsPrefix = rawName.startsWith('xmlns:') ? rawName.slice(6) : null
    // sortKey: namespace deklaracije po prefixu, atributi po local-name (brez URI — kontroliran niz)
    attrs.push({
      rawName,
      value: unescapeEntities(rawValue),
      isNamespace,
      nsPrefix,
      sortKey: isNamespace ? `0:${nsPrefix ?? ''}` : `1:${rawName}`,
    })
  }
  attrs.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
  return { name, attrs, selfClosing }
}

/** Prefixi, uporabljeni v značkah/atributih fragmenta (za exc-c14n "visibly utilized"). */
function scanUsedPrefixes(raw: string): Set<string> {
  const used = new Set<string>()
  // prefixi v imenih značk (<tns:X>, </tns:X>)
  for (const m of raw.matchAll(/<(\/?)([A-Za-z_][\w.\-]*):/g)) used.add(m[2])
  // prefixi v imenih atributov (pfx:x="…") — izključi same xmlns deklaracije
  for (const m of raw.matchAll(/\s([A-Za-z_][\w.\-]*):[A-Za-z_][\w.\-]*\s*=/g)) {
    if (m[1] !== 'xmlns') used.add(m[1])
  }
  used.delete('xml') // vgrajeni prefix — nikoli deklariran
  return used
}

/**
 * Kanoniziraj FRAGMENT (eno korensko značko + otroci, kot jih producira naš
 * builder) po pravilih Exclusive C14N 1.0. Vrne UTF-8 bajte — TOČNO vhod
 * za digest/podpis. Omejitve (dokumentirano, kontroliran niz): brez CDATA,
 * DTD; komentarji/PI se izpustijo; gnezdene xmlns deklaracije na ne-korenskih
 * značkah se ohranijo samo, če jih ta značka/atributi dejansko uporabljajo.
 */
export function canonicalizeFragment(raw: string, opts: C14nOptions = {}): Buffer {
  const usedPrefixes = scanUsedPrefixes(raw)
  let out = ''
  let i = 0
  let rootDone = false

  while (i < raw.length) {
    const lt = raw.indexOf('<', i)
    if (lt < 0) {
      out += canonText(raw.slice(i))
      break
    }
    if (lt > i) out += canonText(raw.slice(i, lt))

    if (raw.startsWith('<!--', lt)) {
      const end = raw.indexOf('-->', lt + 4)
      if (end < 0) throw new Error('mini-c14n: nedokončan komentar')
      i = end + 3 // komentarji se IZPUSTIJO (c14n brez komentarjev)
      continue
    }
    if (raw.startsWith('<![CDATA[', lt)) {
      throw new Error('mini-c14n: CDATA ni podprt v kontroliranem nizu builderja')
    }
    if (raw.startsWith('<?', lt)) {
      const end = raw.indexOf('?>', lt + 2)
      if (end < 0) throw new Error('mini-c14n: nedokončan processing instruction')
      i = end + 2 // PI se izpusti (builder jih ne producira)
      continue
    }

    const gt = findTagEnd(raw, lt)
    const tagSrc = raw.slice(lt, gt + 1)
    i = gt + 1

    if (tagSrc.startsWith('</')) {
      // zapiralna značka — passthrough (ime, brez atributov)
      out += `</${tagSrc.slice(2, -1).trim()}>`
      continue
    }

    const { name, attrs, selfClosing } = parseStartTag(tagSrc)
    const isRoot = !rootDone
    if (isRoot) rootDone = true

    let startTag = `<${name}`
    for (const attr of attrs) {
      const include = attr.isNamespace
        ? isRoot
          ? // koren: deklaracija ostane, če je prefix uporabljen kjer koli v fragmentu
            (attr.nsPrefix !== null ? usedPrefixes.has(attr.nsPrefix) : usedPrefixes.has(''))
          : // ne-koren: builder ne deklarira namespace-ov na otrocih — passthrough
            // (omejitev dokumentirana v glavi; naš determinističen izhod tega ne potrebuje)
            true
        : true
      if (!include) continue
      startTag += ` ${attr.rawName}="${escapeC14nAttr(attr.value)}"`
    }

    // Vstavljeni namespace (npr. ds za SignedInfo — dedovan od ds:Signature,
    // exc-c14n ga izriše na vrhu kanoničnega fragmenta, ker je visibly utilized)
    if (isRoot && opts.rootNamespaces) {
      for (const [prefix, uri] of Object.entries(opts.rootNamespaces)) {
        const alreadyDeclared =
          prefix === '' ? attrs.some((a) => a.isNamespace && a.nsPrefix === null) : attrs.some((a) => a.rawName === `xmlns:${prefix}`)
        const usedNow = prefix === '' ? usedPrefixes.has('') : usedPrefixes.has(prefix)
        if (!alreadyDeclared && usedNow) startTag += ` xmlns${prefix ? `:${prefix}` : ''}="${escapeC14nAttr(uri)}"`
      }
    }

    startTag += '>'
    out += startTag
    if (selfClosing) out += `</${name}>` // c14n: prazni elementi se RAZŠIRIJO
  }

  return Buffer.from(out, 'utf8')
}

// --------------------------------------------
// Izluščevanje RacunZahtjev + enveloped transform
// --------------------------------------------

/** Regularen izraz za odstranitev obstoječega ds:Signature (enveloped transform).
 *  Odstrani SAMO element (vozlišče), NE whitespace-a okoli njega — enako kot
 *  pravi enveloped-signature transform pri verifikatorju. */
const SIGNATURE_CHILD_RE = /<ds:Signature\b[\s\S]*?<\/ds:Signature>/g

export interface RacunZahtjevLocation {
  /** Indeks `<tns:RacunZahtjev` v izvornem nizu. */
  openStart: number
  /** Indeks `</tns:RacunZahtjev>`. */
  closeStart: number
  /** Vrednost Id atributa (UUID poruke). */
  id: string
  /** Indent otrok RacunZahtjev (npr. 6 presledkov). */
  childIndent: string
}

/** Izlušči lego RacunZahtjev elementa + Id atribut (za Reference URI="#Id"). */
export function locateRacunZahtjev(xml: string): RacunZahtjevLocation {
  const openStart = xml.indexOf('<tns:RacunZahtjev')
  if (openStart < 0) {
    throw new Error('Podpisa ni mogoče dodati: v XML ni elementa <tns:RacunZahtjev> (pričakovan izhod buildRacunZahtjev)')
  }
  const closeStart = xml.lastIndexOf('</tns:RacunZahtjev>')
  if (closeStart < openStart) {
    throw new Error('Podpisa ni mogoče dodati: manjka zaključni </tns:RacunZahtjev>')
  }
  const openTagEnd = findTagEnd(xml, openStart)
  const openTag = xml.slice(openStart, openTagEnd + 1)
  const idMatch = /\bId="([^"]*)"/.exec(openTag)
  if (!idMatch || !idMatch[1]) {
    throw new Error('RacunZahtjev nima Id atributa — Reference URI ne more kazati na element')
  }
  // indent otrok = indent odpiralne značke + 2 (builder: 4 → 6)
  const lineStart = xml.lastIndexOf('\n', openStart) + 1
  const openIndent = /^[ \t]*/.exec(xml.slice(lineStart, openStart))?.[0] ?? ''
  return { openStart, closeStart, id: idMatch[1], childIndent: `${openIndent}  ` }
}

// --------------------------------------------
// SignedInfo + Signature gradnja
// --------------------------------------------

/** SignedInfo vrstice (prva BREZ indentov — ta je del fragmenta za kanonizacijo). */
function buildSignedInfoLines(id: string, digestValueB64: string, iBase: string): string[] {
  return [
    `<ds:SignedInfo>`,
    `${iBase}  <ds:CanonicalizationMethod Algorithm="${CIS_ALG_CANONICALIZATION}"/>`,
    `${iBase}  <ds:SignatureMethod Algorithm="${CIS_ALG_RSA_SHA256}"/>`,
    `${iBase}  <ds:Reference URI="#${id}">`,
    `${iBase}    <ds:Transforms>`,
    `${iBase}      <ds:Transform Algorithm="${CIS_ALG_ENVELOPED}"/>`,
    `${iBase}      <ds:Transform Algorithm="${CIS_ALG_CANONICALIZATION}"/>`,
    `${iBase}    </ds:Transforms>`,
    `${iBase}    <ds:DigestMethod Algorithm="${CIS_ALG_SHA256_DIGEST}"/>`,
    `${iBase}    <ds:DigestValue>${digestValueB64}</ds:DigestValue>`,
    `${iBase}  </ds:Reference>`,
    `${iBase}</ds:SignedInfo>`,
  ]
}

/** PEM certifikata → goli base64 DER (brez BEGIN/END in whitespace — ena vrstica). */
export function pemToBase64Der(pem: string): string {
  const m = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(pem)
  if (!m) throw new Error('Certifikat nima pričakovane PEM strukture (-----BEGIN CERTIFICATE-----)')
  const b64 = m[1].replace(/\s+/g, '')
  if (!b64) throw new Error('Certifikat vsebuje prazen PEM blok')
  return b64
}

/**
 * Podpiši RacunZahtjev SOAP envelope z XML-dsig enveloped podpisom.
 *
 * Vhod = izhod buildRacunZahtjev (poln envelope). Izid = isti envelope z
 * ds:Signature kot ZADNJIM otrokom tns:RacunZahtjev. Če envelope že vsebuje
 * ds:Signature, se ta najprej ODSTRANI (enveloped transform + idempotenca).
 *
 * Non-throwing: napaka (slab XML, slab ključ/cert) → { envelope: '', validation }.
 */
export function signRacunZahtjev(xml: string, opts: CisSignOptions): CisSignatureResult {
  const validation: CisConfigValidation = { valid: true, errors: [], warnings: [] }
  const fail = (message: string): CisSignatureResult => ({
    envelope: '',
    digestValue: '',
    signatureValue: '',
    signedInfoCanonical: '',
    validation: { valid: false, errors: [message], warnings: [] },
  })

  try {
    if (typeof xml !== 'string' || !xml.trim()) return fail('Podatki za podpis: prazen XML')

    if (!opts || !opts.certificatePem || !opts.privateKeyPem) {
      return fail('Manjka certifikat ali zasebni ključ (certificatePem/privateKeyPem)')
    }
    const certPem = typeof opts.certificatePem === 'string' ? opts.certificatePem : opts.certificatePem.toString('utf8')
    const keyPem = typeof opts.privateKeyPem === 'string' ? opts.privateKeyPem : opts.privateKeyPem.toString('utf8')
    if (!certPem.includes('BEGIN CERTIFICATE')) {
      return fail('certificatePem ni PEM certifikat (manjka -----BEGIN CERTIFICATE-----)')
    }
    if (!/BEGIN (?:RSA )?PRIVATE KEY/.test(keyPem)) {
      return fail('privateKeyPem ni PEM zasebni ključ (manjka -----BEGIN PRIVATE KEY-----)')
    }
    // Zgodnja validacija certifikata: PEM struktura + ASN.1 SEQUENCE v DER
    const certB64 = pemToBase64Der(certPem)
    const der = Buffer.from(certB64, 'base64')
    if (der.length < 2 || der[0] !== 0x30) {
      throw new Error('Certifikat ni veljaven DER (manjka ASN.1 SEQUENCE)')
    }

    // 1. enveloped transform: odstrani obstoječi ds:Signature (idempotenca)
    const base = xml.replace(SIGNATURE_CHILD_RE, '')

    // 2. lega RacunZahtjev + Id (NA OČIŠČENEM nizu — indeksi veljajo po stripu)
    const loc = locateRacunZahtjev(base)

    // 3. kanoniziran RacunZahtjev (BREZ Signature) → digest
    const fragment = base.slice(loc.openStart, loc.closeStart + '</tns:RacunZahtjev>'.length)
    const canonicalElement = canonicalizeFragment(fragment)
    const digestValueB64 = createHash('sha256').update(canonicalElement).digest('base64')

    // 4. SignedInfo → kanoniziran (ds ns na vrhu fragmenta) → podpis.
    //    closeIndent = indent zaključne značke RacunZahtjev (builder: 4);
    //    <ds:Signature se VSTAVI BREZ dodatnega whitespace-a tik pred njo —
    //    potem je pogled verifikatorja po enveloped transformu byte-identičen
    //    nepodpisanemu envelope-u (zgornja točka 1 v glavi).
    const closeIndent = /(?:^|\n)([ \t]*)$/.exec(base.slice(0, base.lastIndexOf('</tns:RacunZahtjev>')))?.[1] ?? ''
    const iBase = `${closeIndent}  `
    const siLines = buildSignedInfoLines(loc.id, digestValueB64, iBase)
    const signedInfoCanonicalInput = siLines.join('\n')
    const canonicalSignedInfo = canonicalizeFragment(signedInfoCanonicalInput, {
      rootNamespaces: { ds: CIS_XMLDSIG_NS },
    })

    const signer = createSign('RSA-SHA256')
    signer.update(canonicalSignedInfo)
    const signatureValueB64 = signer.sign(keyPem).toString('base64')

    // 5. ds:Signature blok — VSTAVLJEN BREZ whitespace-a okoli sebe, tik pred
    //    zaključno značko (zadolži si obstoječi indent; glej točko 1 v glavi)
    const signatureBlock = [
      `<ds:Signature xmlns:ds="${CIS_XMLDSIG_NS}">`,
      `${iBase}${siLines[0]}`,
      ...siLines.slice(1),
      `${iBase}<ds:SignatureValue>${signatureValueB64}</ds:SignatureValue>`,
      `${iBase}<ds:KeyInfo>`,
      `${iBase}  <ds:X509Data>`,
      `${iBase}    <ds:X509Certificate>${certB64}</ds:X509Certificate>`,
      `${iBase}  </ds:X509Data>`,
      `${iBase}</ds:KeyInfo>`,
      `${closeIndent}</ds:Signature>`,
    ].join('\n')

    const closeIdx = base.lastIndexOf('</tns:RacunZahtjev>')
    const envelope = base.slice(0, closeIdx) + signatureBlock + base.slice(closeIdx)

    return { envelope, digestValue: digestValueB64, signatureValue: signatureValueB64, signedInfoCanonical: canonicalSignedInfo.toString('utf8'), validation }
  } catch (err: unknown) {
    return fail(`XML-dsig podpis ni uspel: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Kanonični tns:RacunZahtjev (BREZ ds:Signature — enveloped transform) kot
 * UTF-8 bajti — TOČNO vhod za DigestValue. Javljeno za teste (NEODVISNA
 * verifikacija digesta) in debugging.
 */
export function canonicalizeRacunZahtjev(xml: string): Buffer {
  // Najprej enveloped transform (strip), ŠELE nato lega — indeksi veljajo na očiščenem nizu
  const base = xml.replace(SIGNATURE_CHILD_RE, '')
  const loc = locateRacunZahtjev(base)
  const fragment = base.slice(loc.openStart, loc.closeStart + '</tns:RacunZahtjev>'.length)
  return canonicalizeFragment(fragment)
}
