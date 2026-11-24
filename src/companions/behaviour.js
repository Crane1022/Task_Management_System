// What the pet says and when. Pure, so it can be tested.
export const MESSAGES = {
  pet: ['Hehe, that tickles!', 'More pats please!', 'Purr… I mean, thank you!', 'You are the best!', 'I love this!'],
  created: ['Nice start!', 'A new task! Let us go!', 'You have got this!', 'One step at a time!'],
  completed: ['Well done!', 'Task complete! Great job!', 'Hooray! One less to do!', 'Look at you go!'],
  board: ['New board, new adventure!', 'Let me have a look around…', 'Oh, what is on this board?'],
  sleepy: ['zZz…'],
  // the idle party is interrupted: the pet has been caught dancing or singing
  caught: ['Oh! You are back!', 'Oops, you saw that? 🙈', 'Hehe, caught me!', 'I was just warming up!'],
}
export const pickMessage = (type, rng = Math.random) => {
  const list = MESSAGES[type] ?? MESSAGES.pet
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}
export const greetingFor = (animal, name, first) => `${animal?.greeting ?? 'Hello!'}${first ? ` Hi ${first}!` : ''}`.trim()

// How long without any interaction before the pet falls asleep
export const SLEEP_AFTER_MS = 60_000
export const shouldSleep = (idleMs, enabled) => enabled && idleMs >= SLEEP_AFTER_MS

// ----- easter egg (20 Nov 2026): left alone for a while, the pet dances or sings, then falls asleep as before -----
export const PARTY_AFTER_MS = 45_000 // idle this long → the party starts
export const PARTY_MS = 12_000       // and lasts this long (ends before the pet falls asleep at SLEEP_AFTER_MS)
export const PARTY_KINDS = ['dance', 'sing']
export const PARTY_LINES = {
  dance: ['Neon and beyond~ ✨', 'Neon and beyond~ 🕺', 'Neon and beyond~ 💃'],
  sing: ['♪ La la la~', '♫ Do re mi fa so~', 'Hmm hmm hmm~ ♪', '♪ Laa~ la la laa~ ♫'],
}
export const pickParty = (rng = Math.random) => PARTY_KINDS[Math.min(PARTY_KINDS.length - 1, Math.floor(rng() * PARTY_KINDS.length))]
export const pickPartyLine = (kind, rng = Math.random) => {
  const list = PARTY_LINES[kind] ?? PARTY_LINES.sing
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}
// May the party start now? Only when the pet is shown and animated, the setting is on and someone could see it
export const partyAllowed = (settings, animated, pageHidden) => !!(settings.visible && settings.behaviour.idleParty && animated && !pageHidden)

// Which reactions a setting allows
export const REACTIONS_FOR_TASKS = ['created', 'completed', 'board']
export const reactionAllowed = (settings, type) => {
  if (!settings.visible) return false
  if (REACTIONS_FOR_TASKS.includes(type)) return settings.behaviour.taskReactions
  return true
}
