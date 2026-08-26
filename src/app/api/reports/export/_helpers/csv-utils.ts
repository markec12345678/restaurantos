// CSV pomožne funkcije za izvoz poročil

export function escapeCsvField(field: unknown): string {
  let str = String(field ?? '')
  // FIX MEDIUM: CSV injection protection — prepreči formule v Excelu (=+@-)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(';') // Slovenian Excel uses ;
}
