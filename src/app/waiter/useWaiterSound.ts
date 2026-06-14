'use client'

import { useRef, useCallback } from 'react'

// ─── Zvočni sistem za natakarjeva obvestila ────────────────────

export function useWaiterSound() {
  const audioRef = useRef<AudioContext | null>(null)
  const play = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      const notes = [660, 880, 1100]
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = freq; osc.type = 'sine'
          gain.gain.setValueAtTime(0.2, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
        }, i * 250)
      })
    } catch {
      // Web Audio API ni podprt ali uporabnik ni interaktiral s stranjo
    }
  }, [])
  return play
}
