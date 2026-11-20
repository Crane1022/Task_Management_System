// Optional animal sounds, made with the browser's own audio (no sound files to download). Off by default.
// `voice` comes from the registry: { wave, from, to, dur, repeat } (pitch glides from `from` to `to` Hz).

// The notes of a voice at a volume 0..100 (pure, so it can be tested)
export function voiceNotes(voice, volume = 40) {
  const gain = Math.min(1, Math.max(0, volume / 100)) * 0.25 // keep it gentle even at 100
  if (!voice || gain === 0) return []
  const notes = []
  for (let i = 0; i < Math.max(1, voice.repeat); i++) {
    notes.push({ wave: voice.wave, from: voice.from, to: voice.to, start: i * (voice.dur + 0.05), dur: voice.dur, gain })
  }
  return notes
}

// ----- little tunes for the idle party (20 Nov 2026). Original note patterns, made on the spot like the voices. -----
const N = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, C6: 1047 }
const TUNES = {
  // a bouncy arpeggio for the dance
  dance: { wave: 'square', step: 0.17, loud: 0.5, notes: ['C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'A5', 'F5', 'C5', 'F5', 'A5', 'C6', 'G5', 'D5', 'B4', 'G5', 'C6'] },
  // a gentle hum for the song
  sing: { wave: 'triangle', step: 0.34, loud: 0.8, notes: ['G4', 'A4', 'B4', 'D5', 'B4', 'A4', 'G4', 'B4', 'D5', 'E5', 'D5', 'B4', 'G4'] },
}
// The notes of a tune at a volume 0..100 (pure, so it can be tested)
export function tuneNotes(kind, volume = 40) {
  const tune = TUNES[kind]
  const gain = Math.min(1, Math.max(0, volume / 100)) * 0.25 * (tune?.loud ?? 1)
  if (!tune || gain === 0) return []
  return tune.notes.map((name, i) => ({ wave: tune.wave, from: N[name], to: N[name], start: i * tune.step, dur: tune.step * 0.9, gain }))
}

let ctx
let playing = [] // oscillators of the tune that is playing, so it can be stopped when the person comes back
function playNotes(notes, keep = false) {
  if (!notes.length) return false
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume() // browsers only allow sound after a click or tap
    const t0 = ctx.currentTime
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = n.wave
      osc.frequency.setValueAtTime(n.from, t0 + n.start)
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, n.to), t0 + n.start + n.dur)
      g.gain.setValueAtTime(0.0001, t0 + n.start)
      g.gain.exponentialRampToValueAtTime(n.gain, t0 + n.start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur)
      osc.connect(g).connect(ctx.destination)
      osc.start(t0 + n.start)
      osc.stop(t0 + n.start + n.dur + 0.02)
      if (keep) playing.push(osc)
    }
    return true
  } catch { return false }
}
export const playVoice = (voice, volume) => playNotes(voiceNotes(voice, volume))
export function playTune(kind, volume) { stopTune(); return playNotes(tuneNotes(kind, volume), true) }
export function stopTune() {
  for (const osc of playing) { try { osc.stop() } catch { /* already stopped */ } }
  playing = []
}
