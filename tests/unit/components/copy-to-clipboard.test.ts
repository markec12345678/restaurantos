// ============================================
// Testi za copyToClipboard (R91-3) — skupni pomožnik za kopiranje v odložišče
// Uporabnika: WebhookUrlSection (urejevalni dialog) + IntegrationTable (webhook badge).
//
// jsdom opombe: navigator.clipboard NE obstaja (undefined) in document.execCommand
// NE obstaja — vsak test izrecno namesti, kar potrebuje (Object.defineProperty,
// configurable: true) in počisti v afterEach. NAMERNO NE uporabljamo
// vi.stubGlobal('navigator'/'window') — v vmThreads poolu jsdom globalov ni
// mogoče redefinirati (glej vitest.config.ts GLOBAL_STUB_FILES / unit-globals).
// ============================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '@/components/pos/integration/copy-to-clipboard'

const WEBHOOK_URL = 'https://app.example.com/api/delivery/webhook/wolt?t=int-1:abc123'

/** Namesti navigator.clipboard z danim writeText (jsdom ga privzeto nima). */
function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

/** Namesti document.execCommand (jsdom ga privzeto nima) in vrni mock za pinjanje klicev. */
function mockExecCommand(impl: () => boolean) {
  const execCommand = vi.fn(impl)
  Object.defineProperty(document, 'execCommand', {
    value: execCommand,
    configurable: true,
    writable: true,
  })
  return execCommand
}

afterEach(() => {
  // Pobriši testne defineProperty inštalacije (configurable: true → delete dovoljen)
  delete (navigator as unknown as { clipboard?: unknown }).clipboard
  delete (document as unknown as { execCommand?: unknown }).execCommand
  // Počisti morebitne puščajoče textarea-e iz neuspešnih poti (hibna higiena med testi)
  document.querySelectorAll('textarea').forEach(t => t.remove())
})

describe('copyToClipboard', () => {
  it('Clipboard API uspešno zapiše → true in pokliče writeText z URL-jem', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    mockClipboard(writeText)

    await expect(copyToClipboard(WEBHOOK_URL)).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(WEBHOOK_URL)
  })

  it('Clipboard API zavrne → legacy fallback (textarea + execCommand) → true', async () => {
    mockClipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('NotAllowedError')))
    const execCommand = mockExecCommand(() => true)

    await expect(copyToClipboard(WEBHOOK_URL)).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // Skrita textarea se po uspešnem kopiranju počisti
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('brez Clipboard API-ja (starejši brskalnik / jsdom) → legacy fallback → true', async () => {
    // navigator.clipboard ostane undefined (jsdom privzeto) — gre naravnost na fallback
    const execCommand = mockExecCommand(() => true)
    const appendChild = vi.spyOn(document.body, 'appendChild')

    await expect(copyToClipboard(WEBHOOK_URL)).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledTimes(1)
    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('obe poti odpovedani (clipboard zavrne + execCommand vrne false) → false, ne meče', async () => {
    mockClipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('NotAllowedError')))
    mockExecCommand(() => false)

    await expect(copyToClipboard(WEBHOOK_URL)).resolves.toBe(false)
  })

  it('execCommand meče izjemo → false (funkcija nikoli ne meče naprej)', async () => {
    mockClipboard(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('NotAllowedError')))
    mockExecCommand(() => {
      throw new Error('boom')
    })

    await expect(copyToClipboard(WEBHOOK_URL)).resolves.toBe(false)
  })
})
