// @mentions ("tags") in comments. The person picks a name from a list, which inserts "@Their Name" into the text; the
// picked ids are remembered, and only those whose "@Name" is still in the text when the comment is posted are saved.
export const MAX_MENTIONS = 10

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The "@query" being typed right before the caret, or null. The "@" must start the text or follow whitespace (so e-mail addresses don't count).
export function activeQuery(text, caret = text.length) {
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret))
  return m ? { query: m[2], start: caret - m[2].length - 1 } : null
}

// Replaces the "@query" with "@Name " and returns the new text and caret position
export function insertMention(text, caret, name) {
  const q = activeQuery(text, caret)
  if (!q) return { text, caret }
  const inserted = `@${name} `
  return { text: text.slice(0, q.start) + inserted + text.slice(caret), caret: q.start + inserted.length }
}

// picked = [{ id, name }] -> the unique ids whose "@name" is still in the text
export function resolveMentions(text, picked) {
  const ids = []
  for (const p of picked) if (p?.id && p.name && text.includes(`@${p.name}`) && !ids.includes(p.id)) ids.push(p.id)
  return ids.slice(0, MAX_MENTIONS)
}

// Splits a comment into plain and mention parts, so mentions can be highlighted. names = display names of the mentioned people.
export function splitMentions(text, names = []) {
  const list = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!list.length) return [{ text, mention: false }]
  const re = new RegExp(`(@(?:${list.map(escapeRe).join('|')}))`, 'g')
  // split() with one capture group puts the matches at the odd positions
  return text.split(re).map((s, i) => ({ text: s, mention: i % 2 === 1 })).filter((p) => p.text !== '')
}
