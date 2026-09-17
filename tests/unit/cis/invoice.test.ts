// ============================================
// CIS RacunZahtjev — Unit testi (Task 24-b)
//
// Preverjamo:
// - buildRacunZahtjev: TOČNA XML struktura (string enačba — snapshot stil)
//   z NEODVISNO izračunanim ZKI (test sam podpiše + md5)
// - RED elementov po shemi (Pdv → Pnp → OstaliPor → … → Naknade → IznosUkupno)
// - validacija: slab OIB, slab znesek (vejica), NacinPlac "C", ParagonBrRac
//   brez NakDost, OznPosPr s posebnimi znaki, OibOper, DatumVrijeme format
// - UUID-ji male črke, Id atribut == IdPoruke element
// - opcijski elementi: prisotni samo če podani, sicer ODSOTNI
// - non-throwing: valid=false → prazen envelope, napake v validation
// ============================================

import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'

const privateKeyPem = crypto
  .generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString()

import {
  buildRacunZahtjev,
  validateRacunData,
  zkiInputString,
  CIS_FIELD_PATTERNS,
  CIS_NS,
} from '@/lib/cis'
import type { CisRacunData } from '@/lib/cis'

// Fiksni čas SPOROČILA: 2024-01-15T12:00:00Z = 13:00:00 po Zagrebu (CET)
const FIXED_NOW = new Date('2024-01-15T12:00:00Z')

const baseData: CisRacunData = {
  oib: '12345678901',
  usustPdv: true,
  datumVrijeme: '15.01.2024T13:00:00',
  oznSlijed: 'P',
  brOznRac: '1',
  oznPosPr: 'POS1',
  oznNapUr: '1',
  iznosUkupno: '15.00',
  nacinPlac: 'G',
  oibOper: '10987654321',
  nakDost: false,
}

/** Neodvisen izračun ZKI (brez buildRacunZahtjev) — primerjava apples-to-apples. */
function independentZki(data: CisRacunData, datVrijemeXml: string): string {
  const inputString = zkiInputString({
    oib: data.oib,
    datVrijeme: datVrijemeXml,
    brOznRac: data.brOznRac,
    oznPosPr: data.oznPosPr,
    oznNapUr: data.oznNapUr,
    iznosUkupno: data.iznosUkupno,
  })
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(inputString, 'utf8')
  return crypto.createHash('md5').update(signer.sign(privateKeyPem)).digest('hex')
}

describe('buildRacunZahtjev — minimalni račun (točna struktura)', () => {
  it('producira TOČEN envelope (string enačba, ZKI izračunan neodvisno)', () => {
    const res = buildRacunZahtjev(baseData, privateKeyPem, { now: FIXED_NOW })

    expect(res.validation.valid).toBe(true)
    expect(res.validation.errors).toEqual([])

    const expected = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      '  <soap:Body>',
      `    <tns:RacunZahtjev xmlns:tns="${CIS_NS}" Id="${res.idPoruke}">`,
      '      <tns:Zaglavlje>',
      `        <tns:IdPoruke>${res.idPoruke}</tns:IdPoruke>`,
      '        <tns:DatumVrijeme>15.01.2024T13:00:00</tns:DatumVrijeme>',
      '      </tns:Zaglavlje>',
      '      <tns:Racun>',
      '        <tns:Oib>12345678901</tns:Oib>',
      '        <tns:USustPdv>true</tns:USustPdv>',
      '        <tns:DatVrijeme>15.01.2024T13:00:00</tns:DatVrijeme>',
      '        <tns:OznSlijed>P</tns:OznSlijed>',
      '        <tns:BrRac>',
      '          <tns:BrOznRac>1</tns:BrOznRac>',
      '          <tns:OznPosPr>POS1</tns:OznPosPr>',
      '          <tns:OznNapUr>1</tns:OznNapUr>',
      '        </tns:BrRac>',
      `        <tns:IznosUkupno>15.00</tns:IznosUkupno>`,
      '        <tns:NacinPlac>G</tns:NacinPlac>',
      '        <tns:OibOper>10987654321</tns:OibOper>',
      `        <tns:ZastKod>${res.zki}</tns:ZastKod>`,
      '        <tns:NakDost>false</tns:NakDost>',
      '      </tns:Racun>',
      '    </tns:RacunZahtjev>',
      '  </soap:Body>',
      '</soap:Envelope>',
    ].join('\n')

    expect(res.envelope).toBe(expected)
    // ZKI v envelope-u se ujema z neodvisno izračunanim (vhod: DatVrijeme RAČUNA)
    expect(res.zki).toBe(independentZki(baseData, '15.01.2024T13:00:00'))
  })

  it('Zaglavlje/DatumVrijeme prihaja iz opts.now (Europe/Zagreb), ne iz racuna', () => {
    const summer = new Date('2024-07-15T12:00:00Z') // CEST = UTC+2 → 14:00
    const res = buildRacunZahtjev(baseData, privateKeyPem, { now: summer })
    expect(res.envelope).toContain('<tns:DatumVrijeme>15.07.2024T14:00:00</tns:DatumVrijeme>')
    // DatVrijeme računa ostane tak, kot je bil podan
    expect(res.envelope).toContain('<tns:DatVrijeme>15.01.2024T13:00:00</tns:DatVrijeme>')
  })

  it('datumVrijeme kot Date se pretvori v Europe/Zagreb in gre v ZKI', () => {
    const data: CisRacunData = { ...baseData, datumVrijeme: new Date('2024-07-15T12:00:00Z') }
    const res = buildRacunZahtjev(data, privateKeyPem, { now: FIXED_NOW })

    expect(res.validation.valid).toBe(true)
    expect(res.envelope).toContain('<tns:DatVrijeme>15.07.2024T14:00:00</tns:DatVrijeme>')
    // ZKI vhod mora uporabiti 14:00:00 (Zagreb), ne surovega UTC časa
    expect(res.zki).toBe(independentZki(data, '15.07.2024T14:00:00'))
  })

  it('Id atribut in IdPoruke element sta enaka UUID-ja (male črke)', () => {
    const res = buildRacunZahtjev(baseData, privateKeyPem, { now: FIXED_NOW })
    expect(res.idPoruke).toMatch(CIS_FIELD_PATTERNS.uuid)
    expect(res.envelope).toContain(`Id="${res.idPoruke}"`)
    expect(res.envelope).toContain(`<tns:IdPoruke>${res.idPoruke}</tns:IdPoruke>`)
    // dve pojavitvi: atribut + element
    expect(res.envelope.split(res.idPoruke).length - 1).toBe(2)
  })

  it('iznosUkupno kot številka se normalizira v XML in ZKI (15 → "15.00")', () => {
    const data: CisRacunData = { ...baseData, iznosUkupno: 15 }
    const res = buildRacunZahtjev(data, privateKeyPem, { now: FIXED_NOW })
    expect(res.envelope).toContain('<tns:IznosUkupno>15.00</tns:IznosUkupno>')
    expect(res.zki).toBe(independentZki(data, '15.01.2024T13:00:00'))
  })

  it('XML-escape besedilnih vrednosti (SpecNamj z & < > " \')', () => {
    const res = buildRacunZahtjev(
      { ...baseData, specNamj: ` posebna namen & "naročilo" <test>` },
      privateKeyPem,
      { now: FIXED_NOW }
    )
    expect(res.validation.valid).toBe(true)
    expect(res.envelope).toContain(
      '<tns:SpecNamj> posebna namen &amp; &quot;naročilo&quot; &lt;test&gt;</tns:SpecNamj>'
    )
  })
})

describe('buildRacunZahtjev — opcijski bloki (RED po shemi)', () => {
  it('Pdv blok: stope v podanem redu, pravilno gnezdenje', () => {
    const res = buildRacunZahtjev(
      {
        ...baseData,
        pdv: [
          { stopa: '25.00', osnovica: '12.00', iznos: '3.00' },
          { stopa: 9.5, osnovica: '9.00', iznos: '0.86' },
        ],
      },
      privateKeyPem,
      { now: FIXED_NOW }
    )
    expect(res.validation.valid).toBe(true)

    const idxPdv = res.envelope.indexOf('<tns:Pdv>')
    const idx25 = res.envelope.indexOf('<tns:Stopa>25.00</tns:Stopa>')
    const idx95 = res.envelope.indexOf('<tns:Stopa>9.50</tns:Stopa>')
    const idxBrRacEnd = res.envelope.indexOf('</tns:BrRac>')
    const idxUkupno = res.envelope.indexOf('<tns:IznosUkupno>')

    // Pdv pride takoj po BrRac in pred IznosUkupno; stope v podanem redu
    expect(idxPdv).toBeGreaterThan(idxBrRacEnd)
    expect(idxPdv).toBeLessThan(idxUkupno)
    expect(idx25).toBeGreaterThan(idxPdv)
    expect(idx95).toBeGreaterThan(idx25)

    // Pari stopa→osnovica→iznos v pravilnem vrstnem redu
    expect(res.envelope.indexOf('<tns:Osnovica>12.00</tns:Osnovica>')).toBeGreaterThan(idx25)
    expect(res.envelope.indexOf('<tns:Iznos>3.00</tns:Iznos>')).toBeGreaterThan(idx25)
    expect(res.envelope.indexOf('<tns:Osnovica>9.00</tns:Osnovica>')).toBeGreaterThan(idx95)
    expect(res.envelope.indexOf('<tns:Iznos>0.86</tns:Iznos>')).toBeGreaterThan(idx95)

    // Točen podblok (gnezdenje Pdv → Porez → Stopa/Osnovica/Iznos)
    expect(res.envelope).toContain(
      [
        '        <tns:Pdv>',
        '          <tns:Porez>',
        '            <tns:Stopa>25.00</tns:Stopa>',
        '            <tns:Osnovica>12.00</tns:Osnovica>',
        '            <tns:Iznos>3.00</tns:Iznos>',
        '          </tns:Porez>',
        '          <tns:Porez>',
        '            <tns:Stopa>9.50</tns:Stopa>',
        '            <tns:Osnovica>9.00</tns:Osnovica>',
        '            <tns:Iznos>0.86</tns:Iznos>',
        '          </tns:Porez>',
        '        </tns:Pdv>',
      ].join('\n')
    )
  })

  it('prazen Pdv ([] ali undefined) → element ODSOTEN', () => {
    const res = buildRacunZahtjev(baseData, privateKeyPem, { now: FIXED_NOW })
    expect(res.envelope).not.toContain('<tns:Pdv>')
    expect(res.envelope).not.toContain('<tns:Pnp>')
    expect(res.envelope).not.toContain('<tns:OstaliPor>')
    expect(res.envelope).not.toContain('<tns:Naknade>')
    expect(res.envelope).not.toContain('<tns:IznosOslobPdv>')
    expect(res.envelope).not.toContain('<tns:IznosMarza>')
    expect(res.envelope).not.toContain('<tns:IznosNePodlOpor>')
    expect(res.envelope).not.toContain('<tns:ParagonBrRac>')
    expect(res.envelope).not.toContain('<tns:SpecNamj>')
    expect(res.envelope).not.toContain('<tns:OibPrimateljaRacuna>')

    const resEmpty = buildRacunZahtjev({ ...baseData, pdv: [] }, privateKeyPem, { now: FIXED_NOW })
    expect(resEmpty.envelope).not.toContain('<tns:Pdv>')
  })

  it('Pnp, OstaliPor, Naknade in opcijski zneski — RED: Pdv → Pnp → OstaliPor → oslob/marza/nePodl → Naknade → IznosUkupno', () => {
    const res = buildRacunZahtjev(
      {
        ...baseData,
        pdv: [{ stopa: '25.00', osnovica: '10.00', iznos: '2.50' }],
        pnp: [{ stopa: '10.00', osnovica: '10.00', iznos: '1.00' }],
        ostaliPor: [{ naziv: 'Naknadna naklada & doplačilo', stopa: '0.00', osnovica: '1.00', iznos: '0.00' }],
        iznosOslobPdv: '0.00',
        iznosMarza: '1.00',
        iznosNePodlOpor: '2.00',
        naknade: [{ nazivN: 'Dostava', iznosN: '2.50' }],
      },
      privateKeyPem,
      { now: FIXED_NOW }
    )
    expect(res.validation.valid).toBe(true)

    const order = [
      '<tns:Pdv>',
      '<tns:Pnp>',
      '<tns:OstaliPor>',
      '<tns:IznosOslobPdv>',
      '<tns:IznosMarza>',
      '<tns:IznosNePodlOpor>',
      '<tns:Naknade>',
      '<tns:IznosUkupno>',
    ].map((tag) => res.envelope.indexOf(tag))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)

    // OstaliPor ima Naziv (escapiran) PRED Stopa
    expect(res.envelope).toContain('<tns:Naziv>Naknadna naklada &amp; doplačilo</tns:Naziv>')
    expect(res.envelope.indexOf('<tns:Naziv>')).toBeLessThan(res.envelope.indexOf('<tns:Stopa>0.00</tns:Stopa>'))
    expect(res.envelope).toContain('<tns:NazivN>Dostava</tns:NazivN>')
    expect(res.envelope).toContain('<tns:IznosN>2.50</tns:IznosN>')
  })

  it('NakDost=true + ParagonBrRac → ParagonBrRac IZPISAN za NakDost', () => {
    const res = buildRacunZahtjev(
      { ...baseData, nakDost: true, paragonBrRac: '12345678901234567890' },
      privateKeyPem,
      { now: FIXED_NOW }
    )
    expect(res.validation.valid).toBe(true)
    expect(res.envelope).toContain('<tns:NakDost>true</tns:NakDost>')
    const idxNakDost = res.envelope.indexOf('<tns:NakDost>')
    const idxParagon = res.envelope.indexOf('<tns:ParagonBrRac>12345678901234567890</tns:ParagonBrRac>')
    expect(idxParagon).toBeGreaterThan(idxNakDost)
  })
})

describe('validateRacunData — zavrnitve (non-throwing)', () => {
  const expectInvalid = (data: Partial<CisRacunData>, errorPart: RegExp, warningPart?: RegExp) => {
    const merged = { ...baseData, ...data } as CisRacunData
    const v = validateRacunData(merged)
    expect(v.valid).toBe(false)
    expect(v.errors.some((e) => errorPart.test(e))).toBe(true)
    if (warningPart) expect(v.warnings.some((w) => warningPart.test(w))).toBe(true)
    return v
  }

  it('slab OIB (10 števk) → napaka', () => {
    expectInvalid({ oib: '1234567890' }, /Oib/)
  })

  it('znesek z vejico → napaka (strog format s piko)', () => {
    expectInvalid({ iznosUkupno: '15,00' }, /IznosUkupno.*vejica/i)
  })

  it('NacinPlac "C" NI veljaven (dovoljeno G, K, T, O)', () => {
    expectInvalid({ nacinPlac: 'C' as unknown as CisRacunData['nacinPlac'] }, /NacinPlac.*"C"/)
  })

  it('ParagonBrRac z nakDost=false → napaka (poslovno pravilo)', () => {
    expectInvalid({ paragonBrRac: '123456' }, /ParagonBrRac.*NakDost/i)
  })

  it('OznPosPr s posebnimi znaki → napaka', () => {
    expectInvalid({ oznPosPr: 'POS#1' }, /OznPosPr/)
    expectInvalid({ oznPosPr: 'POS 1' }, /OznPosPr/)
  })

  it('BrOznRac/OznNapUr z ne-števkami → napaka', () => {
    expectInvalid({ brOznRac: 'R-1' }, /BrOznRac/)
    expectInvalid({ oznNapUr: 'NAP-1' }, /OznNapUr/)
  })

  it('slab OibOper → napaka', () => {
    expectInvalid({ oibOper: '987654321' }, /OibOper/)
  })

  it('slab OibPrimateljaRacuna → napaka', () => {
    expectInvalid({ oibPrimateljaRacuna: 'abc' }, /OibPrimateljaRacuna/)
  })

  it('datumVrijeme kot napačno formatiran niz → napaka; kot Date → OK', () => {
    expectInvalid({ datumVrijeme: '2024-01-15T13:00:00' }, /DatVrijeme/)
    const ok = validateRacunData({ ...baseData, datumVrijeme: new Date('2024-01-15T12:00:00Z') })
    expect(ok.valid).toBe(true)
  })

  it('neveljavna stopa/osnovica v Pdv → napaka s pozicijo', () => {
    expectInvalid({ pdv: [{ stopa: '25', osnovica: '12.00', iznos: '3.00' }] }, /Pdv\[0\]\.Stopa/)
    expectInvalid({ pdv: [{ stopa: '25.00', osnovica: '12,00', iznos: '3.00' }] }, /Pdv\[0\]\.Osnovica/)
  })

  it('buildRacunZahtjev pri valid=false → prazen envelope + napake v rezultatu', () => {
    const res = buildRacunZahtjev({ ...baseData, oib: 'bad' } as CisRacunData, privateKeyPem, { now: FIXED_NOW })
    expect(res.validation.valid).toBe(false)
    expect(res.validation.errors.length).toBeGreaterThan(0)
    expect(res.envelope).toBe('')
    expect(res.zki).toBe('')
    expect(res.idPoruke).toMatch(CIS_FIELD_PATTERNS.uuid)
  })
})

describe('validateRacunData — opozorila (ne blokirajo)', () => {
  it('USustPdv=false + Pdv blok → warning, valid ostane true', () => {
    const v = validateRacunData({ ...baseData, usustPdv: false, pdv: [{ stopa: '25.00', osnovica: '10.00', iznos: '2.50' }] })
    expect(v.valid).toBe(true)
    expect(v.warnings.some((w) => /USustPdv=false/.test(w))).toBe(true)
  })

  it('NakDost=true brez ParagonBrRac → warning, valid ostane true', () => {
    const v = validateRacunData({ ...baseData, nakDost: true })
    expect(v.valid).toBe(true)
    expect(v.warnings.some((w) => /ParagonBrRac/.test(w))).toBe(true)
    // envelope se vseeno zgradi (warning ne blokira)
    const res = buildRacunZahtjev({ ...baseData, nakDost: true }, privateKeyPem, { now: FIXED_NOW })
    expect(res.validation.valid).toBe(true)
    expect(res.envelope).toContain('<tns:ZastKod>')
    expect(res.envelope).not.toContain('<tns:ParagonBrRac>')
  })

  it('čist minimalni račun → brez opozoril', () => {
    const v = validateRacunData(baseData)
    expect(v.valid).toBe(true)
    expect(v.warnings).toEqual([])
  })
})
