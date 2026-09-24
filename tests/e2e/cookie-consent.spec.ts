// ============================================
// E2E — Cookie Consent banner (QA runda 16)
//
// REGRESIJSKI TEST za worklog rundo 15, točko 4:
// "cookie banner lahko intercepta prve klike (prvi obisk)".
// Stari banner: full-width fixed trak (z-[100], bottom-0) → POKRIVAL
// PIN-tipkovnico in glavne gumbe ob prvem obisku.
// Nov banner: plavajoča kartica spodaj desno → NE SME prekrivati
// PIN-dialoga (matematično preverjeno prek bounding boxov).
// Zaženi z: npx playwright test tests/e2e/cookie-consent.spec.ts
// ============================================

import { test, expect, type Page } from '@playwright/test'

/** Presek dveh pravokotnikov (px²); 0 = se ne prekrivata */
function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return x * y
}

async function getRect(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`Element ${selector} ni viden (boundingBox null)`)
  return box
}

test.describe('Cookie Consent (GDPR banner)', () => {
  // Mrzel Turbopack compile lahko preseže privzeti nav timeout
  test.use({ navigationTimeout: 120_000 })

  test('banner NE prekriva PIN-dialoga (intercept bug regresija)', async ({ page }) => {
    // Svež kontekst = brez localStorage → banner se pokaže ob prvem obisku
    await page.goto('/')

    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    // PIN-dialog vsebnik je full-screen (flex h-full) — POMENBNO je le vidna
    // interaktivna regija: notranja kartica + vsi njeni gumbi (klik tarče)
    const pinCard = page.locator('[data-testid="pin-login-card"]')
    await expect(pinCard).toBeVisible()
    const bannerRect = await getRect(page, '[role="dialog"][aria-label*="piškotkov"]')
    const pinCardRect = await getRect(page, '[data-testid="pin-login-card"]')

    const cardOverlap = overlapArea(bannerRect, pinCardRect)
    expect(cardOverlap, `Banner prekriva PIN-kartico na ${cardOverlap}px² — to je intercept bug!`).toBe(0)

    // Vsak PIN-dialog gumb mora biti popolnoma klikljiv (0px² prekrivanja).
    // POZOR: tipkovnica se montira ASINHRONO (najprej "Preverjam stanje
    // sistema...", šele nato PIN-tipkovnica) — čakaj na tipko "1".
    const firstDigit = page.getByRole('button', { name: 'Stevka 1' })
    await expect(firstDigit).toBeVisible({ timeout: 20_000 })
    const pinButtons = await page.locator('[role="dialog"][aria-label="PIN prijava"] button').all()
    expect(pinButtons.length).toBeGreaterThan(0)
    for (const btn of pinButtons) {
      const btnRect = await btn.boundingBox()
      if (!btnRect) continue
      const btnOverlap = overlapArea(bannerRect, btnRect)
      expect(btnOverlap, 'Banner prekriva PIN-dialog gumb — intercept bug!').toBe(0)
    }

    // Banner mora biti plavajoča kartica (max-w-sm ≈ 384px), NE full-width trak
    expect(bannerRect.width, 'Banner je preširok za plavajočo kartico').toBeLessThanOrEqual(420)
  })

  test('samo-nujni klik shrani privolitev in banner ne pride nazaj', async ({ page }) => {
    await page.goto('/')
    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Samo nujni' }).click()
    await expect(banner).toBeHidden({ timeout: 5_000 })

    // Privolitev mora biti shranjena (exit animacija + localStorage)
    const stored = await page.evaluate(() => localStorage.getItem('restaurantos-cookie-consent'))
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored ?? '{}') as { accepted?: boolean; analytics?: boolean }
    expect(parsed.accepted).toBe(true)
    expect(parsed.analytics).toBe(false)

    // Reload → banner SE NE SME več pokazati
    await page.reload()
    await page.waitForTimeout(1500)
    await expect(banner).toHaveCount(0)
  })

  test('nastavitve omogočajo granularno privolitev (analytics toggle)', async ({ page }) => {
    await page.goto('/')
    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Nastavitve' }).click()
    await expect(page.getByRole('heading', { name: 'Nastavitve piškotkov' })).toBeVisible()

    // Omogoči analitiko in shrani (sr-only checkbox: klik na label = vizualni toggle)
    await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Omogoči analitske piškotke' }) }).click()
    await page.getByRole('checkbox', { name: 'Omogoči analitske piškotke' }).isChecked()
    await page.getByRole('button', { name: 'Shrani nastavitve' }).click()
    await expect(banner).toBeHidden({ timeout: 5_000 })

    const stored = await page.evaluate(() => localStorage.getItem('restaurantos-cookie-consent'))
    const parsed = JSON.parse(stored ?? '{}') as { analytics?: boolean }
    expect(parsed.analytics).toBe(true)
  })

  // R115 (P1 repro): na nižjih/ožjih viewportih je kartica (z-[100], fixed
  // bottom-right) FIZIČNO prekrila PIN-dialog in INTERCEPTALA gumba "0" in
  // "Potrdi PIN" (elementFromPoint → consent kartica). Fix: ko bi kartica
  // pokrila katerikoli interaktivni kontrol primarnega aria-modal dialoga,
  // se preseli na vrh. Ta test zagotavlja: (a) NIKOLI pokrit PIN gumb,
  // (b) kartica ostane uporabna (klik na "Samo nujni" deluje).
  test('R115: kartica ne intercepta PIN gumbov na ožjem/nižjem viewportu (800×600)', async ({ page }) => {
    // 800×600 = dokazani repro: pri bottom poziciji sta bila pokrita "0" in "Potrdi PIN"
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('/')

    // R116: SetupRedirect (fixed inset-0 z-50, "Preverjam stanje sistema...")
    // pokriva VSE dokler /api/setup/status ne odgovori — to je legitimen
    // produktov vrata, ne consent bug. Hit-test šele, ko vrata padajo.
    await expect(page.getByText('Preverjam stanje sistema...')).toBeHidden({ timeout: 30_000 })

    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    // Počakaj na asinhrono tipkovnico + MIRUJOČE stanje (R116: premik pozicije
    // animira framer-motion spring — 700 ms je ujel prehod = lažen fail;
    // R115 kontrakt je o končni poziciji, ne o prehodnem okvirju leta)
    const firstDigit = page.getByRole('button', { name: 'Stevka 1' })
    await expect(firstDigit).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1_800)

    // (a) vsak PIN-dialog gumb mora biti dosegljiv pod kurzorjem (hit-test,
    //     1 retry za rezidualni prehod animacije — mirujoče stanje)
    const hitAllR115 = async () => {
      const pinButtons = await page.locator('[role="dialog"][aria-label="PIN prijava"] button').all()
      expect(pinButtons.length).toBeGreaterThan(0)
      for (const btn of pinButtons) {
        const box = await btn.boundingBox()
        if (!box || box.width === 0 || box.height === 0) continue
        const hit = await page.evaluate(
          ([cx, cy]) => {
            const el = document.elementFromPoint(cx as number, cy as number)
            return !!el && !!el.closest('[role="dialog"][aria-label="PIN prijava"]')
          },
          [box.x + box.width / 2, box.y + box.height / 2],
        )
        if (!hit) return false
      }
      return true
    }
    if (!(await hitAllR115())) {
      await page.waitForTimeout(400)
      expect(await hitAllR115(), 'PIN gumb ni klikljiv (mirujoče stanje) — consent kartica ga pokriva!').toBe(true)
    }

    // (b) kartica ostane uporabna na novi poziciji (vrh)
    await page.getByRole('button', { name: 'Samo nujni' }).click()
    await expect(banner).toBeHidden({ timeout: 5_000 })
    const stored = await page.evaluate(() => localStorage.getItem('restaurantos-cookie-consent'))
    expect(stored).toBeTruthy()

    // (c) po privolitvi je PIN dialog popolnoma čist
    await page.waitForTimeout(300)
    const bannerAfter = await page.locator('[role="dialog"][aria-label*="piškotkov"]').count()
    expect(bannerAfter).toBe(0)
  })

  test('R115: kartica ostane spodaj na velikem viewportu (brez nepotrebnega premika)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/')
    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    const firstDigit = page.getByRole('button', { name: 'Stevka 1' })
    await expect(firstDigit).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(700)

    // Na 1366×768 se kartica (bottom-right) ne prekriva s PIN kartico —
    // obstoječi geometrijski assertions iz prvega testa veljajo še naprej.
    const bannerRect = await getRect(page, '[role="dialog"][aria-label*="piškotkov"]')
    const pinCardRect = await getRect(page, '[data-testid="pin-login-card"]')
    expect(overlapArea(bannerRect, pinCardRect)).toBe(0)
  })

  // R116 (P1 regresija po R115 popravku — BREZ refaktorja): matrika
  // 4 viewportov × vsi interaktivni PIN kontrol (številke 1–9 + 0,
  // backspace, potrdi PIN; cancel/close če obstaja). elementFromPoint
  // dokazuje DEJANSKO klikljivost (ne samo geometrijski presek).
  // R115 repro: 800×600 je bil dokazani bug (tipki "0" + "Potrdi PIN"
  // fizično pokriti); 1024×680 blokiran "Potrdi PIN".
  const R116_VIEWPORTS = [
    { width: 800, height: 600 },
    { width: 1024, height: 680 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
  ]

  for (const vp of R116_VIEWPORTS) {
    test(`R116: vse PIN kontrole klikljive na ${vp.width}×${vp.height} (elementFromPoint)`, async ({ page }) => {
      await page.setViewportSize(vp)
      await page.goto('/')

      // R116: SetupRedirect vrata (glej zgornji test) — hit-test šele po njih
      await expect(page.getByText('Preverjam stanje sistema...')).toBeHidden({ timeout: 30_000 })

      const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
      await expect(banner).toBeVisible({ timeout: 15_000 })
      const firstDigit = page.getByRole('button', { name: 'Stevka 1' })
      await expect(firstDigit).toBeVisible({ timeout: 20_000 })
      // R116: čakamo NA MIRUJOČE STANJE (R115 kontrakt: odločitev o poziciji
      // je analitična — useLayoutEffect + rAF + 500 ms settle; premik bottom↔top
      // pa animira framer-motion spring, ki SREDI leta prečeka tipkovnico —
      // 700 ms hit-test je ujel prehod = lažen fail. Steady-state je tisto,
      // kar R115 jamči (dokazano v brskalniku: 1366×768 bottom, vse zeleno).
      await page.waitForTimeout(1_800)

      // (a) Imenovani kontrolki MORAJA obstajati (številke 1–9 + 0, backspace,
      //     potrdi) — elementFromPoint brez kontrol bi bil trivialno zelen.
      //     OPOMBA (R116 odkritje): tipka "0" NIMA aria-labela — dostopno ime
      //     je besedilo "0" (isto za cancel/close: če bi obstajal, je v (b)).
      for (let d = 1; d <= 9; d++) {
        await expect(page.getByRole('button', { name: `Stevka ${d}` })).toBeAttached()
      }
      await expect(page.getByRole('button', { name: '0', exact: true })).toBeAttached()
      const backspace = page.getByRole('button', { name: 'Izbrisi zadnjo stevko' })
      const confirm = page.getByRole('button', { name: 'Potrdi PIN' })
      await expect(backspace).toBeAttached()
      await expect(confirm).toBeAttached()

      // (b) elementFromPoint: vsak interaktivni element PIN dialoga je pod
      //     kurzorjem DEJANSKO dosegljiv (consent kartica ga ne pokriva).
      //     1 retry (400 ms) za morebitni rezidualni prehod animacije —
      //     asercija je o MIRUJOČEM stanju, ne o prehodnem okvirju.
      const hitTestAll = async () => {
        const pinButtons = await page.locator('[role="dialog"][aria-label="PIN prijava"] button').all()
        // 10 števk + backspace + potrdi (+ morebitni cancel/close)
        expect(pinButtons.length).toBeGreaterThanOrEqual(12)
        for (const btn of pinButtons) {
          const box = await btn.boundingBox()
          if (!box || box.width === 0 || box.height === 0) continue
          const hit = await page.evaluate(
            ([cx, cy]) => {
              const el = document.elementFromPoint(cx as number, cy as number)
              return !!el && !!el.closest('[role="dialog"][aria-label="PIN prijava"]')
            },
            [box.x + box.width / 2, box.y + box.height / 2],
          )
          const label = (await btn.getAttribute('aria-label')) ?? (await btn.textContent()) ?? 'gumb'
          if (!hit) return { ok: false as const, label: label.trim() }
        }
        return { ok: true as const, label: '' }
      }
      let result = await hitTestAll()
      if (!result.ok) {
        await page.waitForTimeout(400)
        result = await hitTestAll()
      }
      expect(
        result.ok,
        `PIN gumb "${result.label}" ni klikljiv na ${vp.width}×${vp.height} (mirujoče stanje) — consent kartica ga pokriva!`,
      ).toBe(true)

      // (c) kartica ostane uporabna na svoji poziciji (vrh ali dno)
      await page.getByRole('button', { name: 'Samo nujni' }).click()
      await expect(banner).toBeHidden({ timeout: 5_000 })
      const stored = await page.evaluate(() => localStorage.getItem('restaurantos-cookie-consent'))
      expect(stored).toBeTruthy()
    })
  }
})
