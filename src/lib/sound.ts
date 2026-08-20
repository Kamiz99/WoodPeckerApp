/** Sonidos sintetizados (sin ficheros de audio). */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.06) {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  vol.gain.setValueAtTime(gain, ac.currentTime)
  vol.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationMs / 1000)
  osc.connect(vol).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + durationMs / 1000)
}

export const sound = {
  move: () => tone(320, 70, 'triangle', 0.05),
  correct: () => {
    tone(660, 90, 'sine', 0.05)
    setTimeout(() => tone(880, 130, 'sine', 0.05), 85)
  },
  wrong: () => tone(180, 220, 'sawtooth', 0.04),
  finish: () => {
    tone(523, 110)
    setTimeout(() => tone(659, 110), 100)
    setTimeout(() => tone(784, 200), 200)
  },
}
