// What the pet says and when. Pure, so it can be tested.
export const MESSAGES = {
  pet: ['Hehe, that tickles!', 'More pats please!', 'Purr… I mean, thank you!', 'You are the best!', 'I love this!'],
  created: ['Nice start!', 'A new task! Let us go!', 'You have got this!', 'One step at a time!'],
  completed: ['Well done!', 'Task complete! Great job!', 'Hooray! One less to do!', 'Look at you go!'],
  board: ['New board, new adventure!', 'Let me have a look around…', 'Oh, what is on this board?'],
  sleepy: ['zZz…'],
}
export const pickMessage = (type, rng = Math.random) => {
  const list = MESSAGES[type] ?? MESSAGES.pet
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}
export const greetingFor = (animal, name, first) => `${animal?.greeting ?? 'Hello!'}${first ? ` Hi ${first}!` : ''}`.trim()

// How long without any interaction before the pet falls asleep
export const SLEEP_AFTER_MS = 60_000
export const shouldSleep = (idleMs, enabled) => enabled && idleMs >= SLEEP_AFTER_MS

// Which reactions a setting allows
export const REACTIONS_FOR_TASKS = ['created', 'completed', 'board']
export const reactionAllowed = (settings, type) => {
  if (!settings.visible) return false
  if (REACTIONS_FOR_TASKS.includes(type)) return settings.behaviour.taskReactions
  return true
}
