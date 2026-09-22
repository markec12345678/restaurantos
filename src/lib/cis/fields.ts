// ============================================
// CIS OMEJITVE POLJ — uradni regex vzorci (spec v1.3+ / namespace f73)
// ============================================
// Vir: referenčna implementacija fiskalizacija2-js (verificirano Task 24-b).
// Ti vzorci veljajo za vrednosti elementov v RacunZahtjev — uporabljata ju
// validateRacunData() (invoice.ts) in formatCisAmount() (zki.ts).
//
// POMEMBNO (pogoste napake, ki jih vzorci lovijo):
//   - iznos: PIKA kot decimalno ločilo, natanko 2 decimalki ("15.00", ne "15,00")
//   - uuid: SAMO male črke (CIS zavrača velike hex znake)
//   - datumVrijeme: med datumom in časom je "T" (za ZKI vhod pa presledek —
//     glej zki.ts, replace("T", " "))
// ============================================

/** Regex vzorci polj RacunZahtjev sporočila (ime = XML element). */
export const CIS_FIELD_PATTERNS = {
  /** UUID poruke — male črke, format 8-4-4-4-12. */
  uuid: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
  /** Datum i vrijeme poruke/računa — dd.MM.yyyyTHH:mm:ss. */
  datumVrijeme: /^[0-9]{2}\.[0-9]{2}\.[1-2][0-9]{3}T[0-9]{2}:[0-9]{2}:[0-9]{2}$/,
  /** OIB — natanko 11 števk. */
  oib: /^\d{11}$/,
  /** Znesek — predznak opcijsko, do 15 števk, pika, natanko 2 decimalki. */
  iznos: /^[+-]?[0-9]{1,15}\.[0-9]{2}$/,
  /** Stopa (Pdv/Pnp/OstaliPor) — npr. "25.00". */
  stopa: /^[+-]?[0-9]{1,3}\.[0-9]{2}$/,
  /** Številka računa (BrOznRac) — samo številke. */
  brOznRac: /^\d{1,20}$/,
  /** Oznaka poslovnega prostora — alfanumerično + pomišljaj (npr. "POS-1"). */
  oznPosPr: /^[0-9a-zA-Z\-]{1,20}$/,
  /** Oznaka naprave za izdajo računov — samo številke. */
  oznNapUr: /^\d{1,20}$/,
  /** ZKI (ZastKod) — 32 malih hex znakov. */
  zastKod: /^[a-f0-9]{32}$/,
} as const

/** Dovoljene vrednosti OznSlijed: P = račun v rednem slijedu, N = bez slijeda. */
export const CIS_OZNA_SLIJED_VALUES = ['P', 'N'] as const

/**
 * Dovoljeni načini plačila (NacinPlac):
 *   G = gotovina, K = kartice, T = transakcijski račun, O = ostalo.
 * NAPOMENA: "C" (check/ček) NI veljaven v HR fiskalizaciji — pogosta napaka
 * prihoda iz FURS logike.
 */
export const CIS_NACIN_PLACANJA_VALUES = ['G', 'K', 'T', 'O'] as const
