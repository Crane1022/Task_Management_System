// Search (26 Nov 2026): one search box finds tasks by title or description, comments by their text, attachments
// by file name, and staff by name (with the tasks they are assigned to).
export const MIN_COMMENT_SEARCH = 3 // comments are searched from 3 letters on (they are read from the server)

const norm = (s) => String(s ?? '').toLowerCase()

// "voucher" in "Fix voucher payment" -> [{ t: 'Fix ', hit: false }, { t: 'voucher', hit: true }, { t: ' payment', hit: false }]
export function splitHits(text, query) {
  const src = String(text ?? '')
  const q = norm(query).trim()
  if (!q) return [{ t: src, hit: false }]
  const out = []
  const low = src.toLowerCase()
  let i = 0
  while (i < src.length) {
    const j = low.indexOf(q, i)
    if (j < 0) { out.push({ t: src.slice(i), hit: false }); break }
    if (j > i) out.push({ t: src.slice(i, j), hit: false })
    out.push({ t: src.slice(j, j + q.length), hit: true })
    i = j + q.length
  }
  return out
}

// a short piece of a long text around the first match, so the match is visible
export function snippet(text, query, size = 90) {
  const src = String(text ?? '').replace(/\s+/g, ' ').trim()
  const j = src.toLowerCase().indexOf(norm(query).trim())
  if (j < 0 || src.length <= size) return src.length > size ? src.slice(0, size) + '…' : src
  const start = Math.max(0, j - Math.floor(size / 3))
  return (start ? '…' : '') + src.slice(start, start + size) + (start + size < src.length ? '…' : '')
}

export const taskHit = (t, q) => !!norm(q).trim() && norm(`${t.title} ${t.description ?? ''}`).includes(norm(q).trim())
export const fileHits = (t, q) => (norm(q).trim() ? (t.attachments ?? []).filter((a) => norm(a.name).includes(norm(q).trim())) : [])
// both names of a person ("Crane", "Neo Ka Hoong")
const namesOf = (u) => `${u?.displayName ?? ''} ${u?.name ?? ''}`
export const personHit = (u, q) => !!norm(q).trim() && norm(namesOf(u)).includes(norm(q).trim())
// a task assigned to someone whose name matches
export const assigneeHit = (t, users, q) => (t.assignedTo ?? []).some((id) => users?.[id] && personHit(users[id], q))
export const commentHit = (c, q) => !!norm(q).trim() && norm(`${c.text} ${c.userName ?? ''}`).includes(norm(q).trim())

// every result for a search, grouped. `comments` = { taskId: [comment…] } already loaded for these tasks.
// `users` = { id: user } (optional): people whose name matches, with how many of these tasks they are assigned to,
// and the tasks assigned to them
export function searchAll(tasks, comments, q, limit = 8, users = {}) {
  const query = norm(q).trim()
  if (!query) return { tasks: [], comments: [], files: [], people: [] }
  const out = { tasks: [], comments: [], files: [], people: [] }
  for (const u of Object.values(users ?? {})) {
    if (u?.disabled || !personHit(u, query)) continue
    out.people.push({ user: u, count: tasks.filter((t) => (t.assignedTo ?? []).includes(u.id) && !t.completedAt).length })
  }
  out.people.sort((a, b) => b.count - a.count)
  for (const t of tasks) {
    if (taskHit(t, query) || assigneeHit(t, users, query)) out.tasks.push(t)
    for (const a of fileHits(t, query)) out.files.push({ task: t, file: a })
    for (const c of comments[t.id] ?? []) if (commentHit(c, query)) out.comments.push({ task: t, comment: c })
  }
  out.comments.sort((a, b) => (b.comment.createdAt?.seconds ?? 0) - (a.comment.createdAt?.seconds ?? 0))
  return { tasks: out.tasks.slice(0, limit), comments: out.comments.slice(0, limit), files: out.files.slice(0, limit), people: out.people.slice(0, 4), more: out.tasks.length > limit || out.comments.length > limit || out.files.length > limit }
}
