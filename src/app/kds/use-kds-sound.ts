'use client'

import { useRef, useCallback } from 'react'

// ─── Zvočni sistem za KDS ─────────────────────────────────────
// Trojni ping — nizko-srednje-visoko (C5, E5, G5)

export function useKDSSound() {
  const audioRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  const play = useCallback(() => {
    if (!enabledRef.current) return
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      // Trojni ping — nizko-srednje-visoko
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = freq; osc.type = 'sine'
          gain.gain.setValueAtTime(0.25, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
        }, i * 200)
      })
    } catch {
      // Web Audio API ni podprt ali uporabnik ni interaktiral s stranjo — tiho ignoriraj
    }
  }, [])

  const toggle = useCallback(() => { enabledRef.current = !enabledRef.current }, [])
  const isEnabled = useCallback(() => enabledRef.current, [])

  return { play, toggle, isEnabled }
}
