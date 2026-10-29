// Task attachments are LINKS to files that live somewhere else (Google Drive, OneDrive, SharePoint, Dropbox or a company
// file server). Nothing is uploaded to this app, and nothing is stored in Firebase Storage.
const PROVIDERS = [
  [/(^|\.)(drive|docs)\.google\.com$/i, 'Google Drive'],
  [/(^|\.)onedrive\.live\.com$|(^|\.)1drv\.ms$|(^|\.)onedrive\.com$/i, 'OneDrive'],
  [/(^|\.)sharepoint\.com$/i, 'SharePoint'],
  [/(^|\.)dropbox\.com$|(^|\.)dropboxusercontent\.com$/i, 'Dropbox'],
]
export const MAX_ATTACHMENTS = 30
export const MAX_URL = 2000

const KINDS = [
  ['pdf', /\.pdf$/i], ['word', /\.(docx?|rtf|odt)$/i], ['excel', /\.(xlsx?|csv|ods)$/i], ['slides', /\.(pptx?|odp)$/i],
  ['image', /\.(png|jpe?g|gif|webp|bmp|svg|heic)$/i], ['archive', /\.(zip|rar|7z)$/i],
]
export const KIND_LABEL = { pdf: 'PDF', word: 'Word', excel: 'Excel', slides: 'Slides', image: 'Image', archive: 'Archive', other: 'File' }

export const isSafeHref = (url) => { try { return ['http:', 'https:'].includes(new URL(url).protocol) } catch { return false } }

// `serverHosts` = extra host names that mean "our company file server" (optional)
export function providerOf(hostname, serverHosts = []) {
  for (const [re, name] of PROVIDERS) if (re.test(hostname)) return name
  const h = hostname.toLowerCase()
  if (serverHosts.some((s) => h === s.toLowerCase() || h.endsWith('.' + s.toLowerCase())) || !h.includes('.') || /\.(local|lan|internal|corp)$/.test(h)) return 'Company file server'
  return 'Web link'
}

export function nameFromUrl(u) {
  const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').trim()
  return (last && last.length <= 120 ? last : '') || u.hostname
}
export const kindOf = (name, url = '') => KINDS.find(([, re]) => re.test(name) || re.test(url.split('?')[0]))?.[0] ?? 'other'

// Returns { url, name, provider, kind } or { error: 'a sentence for the person' }
export function parseLink(input, name = '', serverHosts = []) {
  const raw = String(input ?? '').trim()
  if (!raw) return { error: 'Paste the link to the file.' }
  if (/^\\\\/.test(raw) || /^[a-z]:\\/i.test(raw)) return { error: 'A network path such as \\\\server\\folder cannot be opened from a browser. Use a shared web link (https://…) instead.' }
  if (raw.length > MAX_URL) return { error: 'That link is too long.' }
  let u
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`) } catch { return { error: 'That does not look like a web link.' } }
  if (!['http:', 'https:'].includes(u.protocol)) return { error: 'Only web links (https://…) can be attached.' }
  if (u.username || u.password) return { error: 'Remove the user name and password from the link and share it with the people who need access instead.' }
  if (!u.hostname) return { error: 'That does not look like a web link.' }
  const label = String(name ?? '').trim().slice(0, 120) || nameFromUrl(u)
  return { url: u.href, name: label, provider: providerOf(u.hostname, serverHosts), kind: kindOf(label, u.pathname) }
}

// ----- links typed or pasted inside free text (a task description) -----
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi
// a closing bracket at the end belongs to the link only if the link opened one
const trimLink = (raw) => {
  let t = raw.replace(/[.,;:!?'"]+$/, '')
  for (;;) {
    const m = /[)\]}]$/.exec(t)
    if (!m) break
    const open = { ')': '(', ']': '[', '}': '{' }[m[0]]
    if (t.split(m[0]).length > t.split(open).length) t = t.slice(0, -1).replace(/[.,;:!?'"]+$/, '')
    else break
  }
  return t
}

// -> [{ text, href }] in order; `href` is null for plain text. Only safe http(s) links get an href.
export function splitLinks(text) {
  const src = String(text ?? '')
  const out = []
  let last = 0
  for (const m of src.matchAll(URL_RE)) {
    const link = trimLink(m[0])
    let href = null
    try { const u = new URL(/^www\./i.test(link) ? `https://${link}` : link); if (isSafeHref(u.href) && u.hostname.includes('.')) href = u.href } catch { href = null }
    if (!href) continue
    if (m.index > last) out.push({ text: src.slice(last, m.index), href: null })
    out.push({ text: link, href })
    last = m.index + link.length
  }
  if (last < src.length) out.push({ text: src.slice(last), href: null })
  return out.length ? out : [{ text: src, href: null }]
}

// The distinct links in a text, in order of appearance
export const linksIn = (text) => [...new Set(splitLinks(text).filter((p) => p.href).map((p) => p.href))]
