// ============================================
// ESC/POS KONSTANTE IN KODIRANJE
// Podpora za Star SP700 (impact) in Epson TM-T88VI (thermal)
// Kodna stran 852 (Latin 2) za slovenske znake (č, š, ž, itd.)
// ============================================

// ESC/POS ukazi
export const ESC = '\x1B'
export const GS = '\x1D'

// Kodna stran 852 (Latin 2 - za slovenščino)
export const CODE_PAGE_852 = 852

// FIX BUG-EP1 CRITICAL: MAX_PRINT_BUFFER je bil referenciran a nikoli definiran — runtime ReferenceError
// Omejitev na 16KB prepreči buffer overflow v tiskalniku
export const MAX_PRINT_BUFFER = 16 * 1024 // 16 KB

// ============================================
// SLOVENSKA ZNAKOVNA MAPA (CP852)
// ============================================

export const SLOVENIAN_CHAR_MAP: Record<string, string> = {
  'č': '\x9D', // č v CP852
  'š': '\x9A', // š v CP852
  'ž': '\x9E', // ž v CP852
  'Č': '\x8D', // Č v CP852
  'Š': '\x8A', // Š v CP852
  'Ž': '\x8E', // Ž v CP852
  'ć': '\x87', // ć v CP852
  'Ć': '\x86', // Ć v CP852
  'đ': '\x91', // đ v CP852
  'Đ': '\x90', // Đ v CP852
}

/**
 * Pretvori slovenske znake v CP852 kodiranje
 * FIX HIGH: Odstrani ESC (\x1B) in GS (\x1D) znake iz vnosa — prepreči ESC/POS injection
 * Zlonamerni vnosi z ESC/GS znaki bi se interpretirali kot ukazi tiskalnika
 * FIX EP6 LOW: Odstrani tudi NUL (0x00), FF (0x0C) in FS (0x1C) — prepreči nepravilno premikanje papirja
 */
export function encodeSlovenian(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    // FIX: Odstrani kontrolne znake — ESC (0x1B), GS (0x1D), NUL (0x00), FF (0x0C), FS (0x1C)
    if (code === 0x00 || code === 0x0C || code === 0x1B || code === 0x1C || code === 0x1D) continue
    if (SLOVENIAN_CHAR_MAP[char]) {
      result += SLOVENIAN_CHAR_MAP[char]
    } else {
      result += char
    }
  }
  return result
}
