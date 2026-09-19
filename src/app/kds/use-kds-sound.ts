'use client'

import { useRef, useCallback, useState } from 'react'
import { loadSoundPref, saveSoundPref } from '@/lib/kds-sound-prefs'

// ─── Zvočni sistem za KDS ─────────────────────────────────────
// Trojni ping — nizko-srednje-visoko (C5, E5, G5)
// Task 21: bump confirmation — kratko padajoče E5→C5 (ločljivo od prihodnega
// pinga: kuhar sliši RAZLIKO med "novo naročilo" in "potrjen bump")
//
// RUNDA 63 (zvok 2.0):
//   • Preferenca PERSISTIRANA (localStorage kds_sound_enabled — lib
//     kds-sound-prefs) — utišanje preživi reload/izmeno, prej ref-only
//   • Lazy init (useState(() => loadSoundPref())) — SSR rendera samo
//     prijavno formo, KDSHeader pa šele po obnovi seje client-side →
//     brez hydration mismatcha in brez setState-v-effectu (react-hooks)
//   • unlock(): Web Audio autoplay politika — kuhinjski zaslon po
//     reloadu ni interaktiral → AudioContext je suspended in pisk
//     TIHO odpadejo; unlock (resume + tih ton) sprosti prvi
//     pointerdown/keydown (poslušalca v useKDSPage)
//   • toggle() ob VKLOPU predvaja potrditveni ping (kuhar takoj sliši,
//     da je zvok spet živ — hkrati odpre AudioContext)

export function useKDSSound() {
  const audioRef = useRef<AudioContext | null>(null)
  // R63: preferenca že pri prvem client renderju (lazy initializer).
  // SSR rendera samo prijavno formo; KDSHeader (edini izpis zvoka) se
  // rendera šele po obnovi seje client-side → brez hydration mismatcha.
  const [soundOn, setSoundOn] = useState(() => loadSoundPref())
  const enabledRef = useRef(soundOn)

  const ensureCtx = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioRef.current
  }, [])

  /** Enotn oscilatorski ton z exponential decay. */
  const tone = useCallback((ctx: AudioContext, freq: number, delayMs: number, duration = 0.25, volume = 0.22) => {
    setTimeout(() => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration)
    }, delayMs)
  }, [])

  const play = useCallback(() => {
    if (!enabledRef.current) return
    try {
      const ctx = ensureCtx()
      // Trojni ping — nizko-srednje-visoko
      ;[523.25, 659.25, 783.99].forEach((freq, i) => tone(ctx, freq, i * 200, 0.4))
    } catch {
      // Web Audio API ni podprt ali uporabnik ni interaktiral s stranjo — tiho ignoriraj
    }
  }, [ensureCtx, tone])

  /** Task 21: bump potrditev — padajoči dvoton (E5 → C5), kratko in jasno. */
  const playBump = useCallback(() => {
    if (!enabledRef.current) return
    try {
      const ctx = ensureCtx()
      tone(ctx, 659.25, 0, 0.15)   // E5
      tone(ctx, 523.25, 110, 0.2)  // C5
    } catch {
      // tiho ignoriraj
    }
  }, [ensureCtx, tone])

  /**
   * R63: sprosti suspended AudioContext (autoplay politika).
   * resume() + en 0-glasnostni ton (poln unlock tudi v brskalnikih, ki
   * zahtevajo dejansko predvajanje). Idempotentno — varno poklicati večkrat.
   */
  const unlock = useCallback(() => {
    try {
      const ctx = ensureCtx()
      if (ctx.state === 'suspended') void ctx.resume()
      if (ctx.state === 'running') {
        // 0-glasnostni "unlock" ton — 1 ms, neslišen
        tone(ctx, 1, 0, 0.01, 0.0001)
      }
    } catch {
      // brez Web Audio ničesar ni za odkleniti
    }
  }, [ensureCtx, tone])

  const toggle = useCallback(() => {
    const next = !enabledRef.current
    enabledRef.current = next
    setSoundOn(next)    // re-render glave (stanjska barva/ikona)
    saveSoundPref(next) // R63: preživi reload
    if (next) {
      // R63: potrditveni ping ob vklopu — kuhar sliši, da je zvok živ
      // (hkrati tudi interakcija → AudioContext se lahko odklene)
      try {
        const ctx = ensureCtx()
        if (ctx.state === 'suspended') void ctx.resume()
        tone(ctx, 659.25, 0, 0.15)
        tone(ctx, 783.99, 110, 0.2)
      } catch {
        // tiho
      }
    }
  }, [ensureCtx, tone])

  const isEnabled = useCallback(() => enabledRef.current, [])

  return { play, playBump, toggle, isEnabled, unlock }
}
