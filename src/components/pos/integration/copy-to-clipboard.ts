// ============================================
// COPY TO CLIPBOARD — skupni pomožnik za kopiranje v odložišče (R91-3)
// ============================================

// R91-3: izvleček copy logike iz WebhookUrlSection.handleCopy (R90-4) — zdaj
// deljena med urejevalnim dialogom (WebhookUrlSection) in seznamom integracij
// (webhook badge v IntegrationTable). Hišni vzorec: OrderingLinkSection
// (R89-2). Potek: moderni Clipboard API (navigator.clipboard.writeText,
// zahteva secure context) → ob zavrnitvi ALI manjkajočem API-ju legacy
// fallback (skriti textarea + document.execCommand('copy')). Funkcija NIKOLI
// ne meče — rezultat je vedno boolean (true = kopirano, false = prikaži
// error toast in navodilo za ročno kopiranje).

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 1. Moderni Clipboard API
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // Zavrnjen dostop / nezabezpečeni kontekst → legacy fallback spodaj
    }

    // 2. Legacy fallback za okolja brez Clipboard API (starejši brskalniki / ne-zabezpečeni konteksti)
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    // Totalna napaka (nobena pot ni na voljo) — nikoli ne meči
    return false
  }
}
