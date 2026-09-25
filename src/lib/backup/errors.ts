// ============================================
// BACKUP / RESTORE — TIPIZIRANE NAPAKE (P0-6)
// ============================================
// BackupError je EDINA napaka, ki jo jedro backup liba meče navzven in jo
// /api/backup rute (R127-c) pričakujejo. `code` določa politiko odgovora,
// `status` je privzeti HTTP status — route ga lahko posreduje direktno v
// NextResponse.json(..., { status }).
//
// Kode:
//   FORMAT   400 — backup ni veljaven (oblika, vrstice, pregloboka struktura)
//   VERSION  400 — nepodprta verzija backup formata
//   CHECKSUM 422 — vsebina se ne ujema s checksumom (pokvarjen/tamperan file)
//   MANIFEST 400 — backup govori o tabelah, ki jih manifest ne pozna
//   SIZE     413 — backup presega obrambno mejo velikosti
//   CYCLE    422 — cikel v FK grafu z obvezno (non-nullable) povezavo
//   DB       500 — napaka na strani baze (delegate, transakcija, izguba vrstic)

export type BackupErrorCode =
  | 'FORMAT'
  | 'VERSION'
  | 'CHECKSUM'
  | 'MANIFEST'
  | 'SIZE'
  | 'CYCLE'
  | 'DB'

const STATUS_BY_CODE: Record<BackupErrorCode, number> = {
  FORMAT: 400,
  VERSION: 400,
  CHECKSUM: 422,
  MANIFEST: 400,
  SIZE: 413,
  CYCLE: 422,
  DB: 500,
}

export class BackupError extends Error {
  code: BackupErrorCode
  status: number

  constructor(code: BackupErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'BackupError'
    this.code = code
    this.status = status ?? STATUS_BY_CODE[code]
    // Zaščita instanceof čez različne bundl okolja (več kopij Error prototype)
    Object.setPrototypeOf(this, BackupError.prototype)
  }
}
