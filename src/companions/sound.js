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

let ctx
export function playVoice(voice, volume) {
  const notes = voiceNotes(voice, volume)
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
    }
    return true
  } catch { return false }
}
