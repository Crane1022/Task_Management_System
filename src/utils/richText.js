// Point form and bold in task descriptions. The description stays plain text with light marks:
//   **bold**              bold words
//   - item  (or * / •)   a bullet point
//   1. item              a numbered point
// parseRich turns it into lines for components/RichText.vue, which builds elements (never v-html), so nothing typed can
// run as code. The edit helpers below are used by the B / bullet / numbered buttons and the Enter key in the editor.
import { splitLinks } from './links.js'

const BULLET = /^(\s*)([-*•])\s+/
const NUMBER = /^(\s*)(\d{1,3})[.)]\s+/

// One line's text: bold pieces, each split into links and plain text  -> [{ text, bold, href? }]
export function inlineParts(text) {
  const out = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m
  const push = (s, bold) => { if (s) for (const p of splitLinks(s)) out.push({ ...p, bold }) }
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index), false)
    push(m[1], true)
    last = m.index + m[0].length
  }
  push(text.slice(last), false)
  return out
}

// The description as lines: { kind: 'bullet' | 'number' | 'text' | 'blank', marker, indent, parts }
export function parseRich(text = '') {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => {
    let m
    if ((m = line.match(BULLET))) return { kind: 'bullet', marker: '•', indent: Math.min(Math.floor(m[1].length / 2), 3), parts: inlineParts(line.slice(m[0].length)) }
    if ((m = line.match(NUMBER))) return { kind: 'number', marker: `${m[2]}.`, indent: Math.min(Math.floor(m[1].length / 2), 3), parts: inlineParts(line.slice(m[0].length)) }
    if (!line.trim()) return { kind: 'blank', parts: [] }
    return { kind: 'text', parts: inlineParts(line) }
  })
}

// The text without marks (for places that show one plain line)
export const plainText = (text = '') => String(text ?? '').replace(/\*\*(.+?)\*\*/g, '$1')

// ----- editing: each takes the text and the selection, and returns { value, start, end } -----

// Bold the selection (or remove the bold if it is already bold). With nothing selected, adds **** with the cursor inside.
export function toggleBold(value, start, end) {
  const sel = value.slice(start, end)
  if (sel.startsWith('**') && sel.endsWith('**') && sel.length >= 4) {
    const inner = sel.slice(2, -2)
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length }
  }
  if (value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**') {
    return { value: value.slice(0, start - 2) + sel + value.slice(end + 2), start: start - 2, end: end - 2 }
  }
  return { value: value.slice(0, start) + '**' + sel + '**' + value.slice(end), start: start + 2, end: end + 2 }
}

// Turn the selected lines into bullet ('bullet') or numbered ('number') points, or back to plain lines if they all are.
export function toggleList(value, start, end, kind) {
  const from = value.lastIndexOf('\n', start - 1) + 1
  let to = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  if (to === -1) to = value.length
  const lines = value.slice(from, to).split('\n')
  const re = kind === 'number' ? NUMBER : BULLET
  const all = lines.every((l) => re.test(l) || !l.trim())
  let n = 0
  const next = lines.map((l) => {
    const bare = l.replace(BULLET, '$1').replace(NUMBER, '$1')
    if (all) return bare
    if (!l.trim()) return l
    return kind === 'number' ? `${++n}. ${bare.trimStart()}` : `- ${bare.trimStart()}`
  }).join('\n')
  return { value: value.slice(0, from) + next + value.slice(to), start: from, end: from + next.length }
}

// Enter at the end of a point: the next line starts the next point. Enter on an empty point ends the list.
// Returns null when Enter should do what it normally does.
export function continueList(value, pos) {
  const from = value.lastIndexOf('\n', pos - 1) + 1
  const line = value.slice(from, pos)
  let m = line.match(BULLET)
  let marker
  if (m) marker = `${m[1]}${m[2]} `
  else if ((m = line.match(NUMBER))) marker = `${m[1]}${Number(m[2]) + 1}. `
  else return null
  if (!line.slice(m[0].length).trim()) { // an empty point: remove it and end the list
    return { value: value.slice(0, from) + value.slice(pos), start: from, end: from }
  }
  const ins = '\n' + marker
  return { value: value.slice(0, pos) + ins + value.slice(pos), start: pos + ins.length, end: pos + ins.length }
}
