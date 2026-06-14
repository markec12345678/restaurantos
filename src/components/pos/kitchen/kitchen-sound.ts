// ============================================
// ZVOČNO OBVEŠČANJE
// ============================================
export class KitchenSoundManager {
  private audioContext: AudioContext | null = null
  private enabled = true

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  private getContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  playNewOrder() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      // Pleasant two-tone chime for new orders
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, ctx.currentTime)
      osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.2)
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.35)

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

      osc1.start(ctx.currentTime)
      osc2.start(ctx.currentTime + 0.2)
      osc1.stop(ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.5)
    } catch { /* Audio not available */ }
  }

  playItemReady() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)

      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* Audio not available */ }
  }

  playUrgent() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      // Three quick beeps for urgent orders
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'square'
        osc.frequency.value = 800
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.2)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15)
        osc.start(ctx.currentTime + i * 0.2)
        osc.stop(ctx.currentTime + i * 0.2 + 0.15)
      }
    } catch { /* Audio not available */ }
  }
}

export const soundManager = new KitchenSoundManager()
