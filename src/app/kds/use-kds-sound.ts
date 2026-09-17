'use client'

import { useRef, useCallback } from 'react'

// ─── Zvočni sistem za KDS ─────────────────────────────────────
// Trojni ping — nizko-srednje-visoko (C5, E5, G5)
// Task 21: bump confirmation — kratko padajoče E5→C5 (ločljivo od prihodnega
// pinga: kuhar sliši RAZLIKO med "novo naročilo" in "potrjen bump")

export function useKDSSound() {
  const audioRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

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

  const toggle = useCallback(() => { enabledRef.current = !enabledRef.current }, [])
  const isEnabled = useCallback(() => enabledRef.current, [])

  return { play, playBump, toggle, isEnabled }
}
