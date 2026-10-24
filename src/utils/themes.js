// Central theme configuration. Every colour in the app comes from CSS variables set here.
// Name mapping:  Primary -> --accent   Secondary -> --accent-soft   Accent -> --highlight
//                Background -> --bg    Surface -> --surface   Text -> --ink   Border -> --line

export const PRESETS = {
  light: { name: 'Light', mode: 'light', c: { primary: '#4a7c59', secondary: '#e2eee7', accent: '#2f8f83', background: '#f2f5f3', surface: '#ffffff', text: '#1f2d27', border: '#dde4df', muted: '#66756c' } },
  dark: { name: 'Dark', mode: 'dark', c: { primary: '#8fc9a3', secondary: '#1f3328', accent: '#5cc2b3', background: '#121a16', surface: '#19231e', text: '#e4ece7', border: '#2a3a32', muted: '#98a89f' } },
  moss: { name: 'Moss', mode: 'light', c: { primary: '#3d6b45', secondary: '#dcebe0', accent: '#3a8f7e', background: '#edf3ee', surface: '#f8fbf8', text: '#223228', border: '#d3e0d6', muted: '#62786a' } },
  clay: { name: 'Clay', mode: 'light', c: { primary: '#b0623a', secondary: '#f3e1d3', accent: '#6f8f4e', background: '#f5ede4', surface: '#fcf7f1', text: '#3b2a22', border: '#e4d5c6', muted: '#85705f' } },
  sky: { name: 'Sky', mode: 'light', c: { primary: '#3f7a96', secondary: '#dcebf2', accent: '#d08a3a', background: '#eef3f6', surface: '#f9fbfc', text: '#22323b', border: '#d3dfe6', muted: '#62757f' } },
  blossom: { name: 'Blossom', mode: 'light', c: { primary: '#a8566f', secondary: '#f4dde4', accent: '#7a9a5a', background: '#f8eff0', surface: '#fdf8f8', text: '#3a2a30', border: '#ead7da', muted: '#8a6f76' } },
  sand: { name: 'Sand', mode: 'light', c: { primary: '#8a6a2f', secondary: '#efe3c8', accent: '#4f7a4a', background: '#f6f0e0', surface: '#fcf9ef', text: '#3a3222', border: '#e3d8bb', muted: '#7d7358' } },
  dusk: { name: 'Dusk', mode: 'dark', c: { primary: '#b79df0', secondary: '#2c2540', accent: '#f0b47a', background: '#16131f', surface: '#1f1a2c', text: '#ece8f6', border: '#322b47', muted: '#a49cba' } },
}
export const PRESET_IDS = ['light', 'dark', 'system', 'moss', 'clay', 'sky', 'blossom', 'sand', 'dusk']
export const presetName = (id) => (id === 'system' ? 'System' : PRESETS[id]?.name ?? id)

export const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary', hint: 'Buttons and the active menu item' },
  { key: 'secondary', label: 'Secondary', hint: 'Soft tints and chips' },
  { key: 'accent', label: 'Accent', hint: 'Highlights and focus rings' },
  { key: 'background', label: 'Background', hint: 'Behind everything' },
  { key: 'surface', label: 'Cards and panels', hint: 'Cards, columns, menus' },
  { key: 'text', label: 'Text', hint: 'Main text colour' },
  { key: 'border', label: 'Borders', hint: 'Lines and outlines' },
]
export const FONT_RANGE = { min: 85, max: 125, step: 5 }
export const RADIUS_RANGE = { min: 0, max: 2, step: 0.1 }

// Dashboards saved before themes existed only have a `palette` name; keep them looking the same.
const LEGACY = {
  moss: { light: { primary: '#4f7a4a', secondary: '#e3ecd8' }, dark: { primary: '#9cc783', secondary: '#26331f' } },
  clay: { light: { primary: '#b0623a', secondary: '#f3e1d3' }, dark: { primary: '#e4a27c', secondary: '#3a2a21' } },
  sky: { light: { primary: '#3f7a96', secondary: '#dcebf2' }, dark: { primary: '#8cc4dd', secondary: '#1f3340' } },
  blossom: { light: { primary: '#a8566f', secondary: '#f4dde4' }, dark: { primary: '#e49bb2', secondary: '#3a2530' } },
}
export const dashboardLayer = (d) => d?.theme ?? (d?.palette ? { legacyPalette: d.palette } : {})

// ---------- colour helpers ----------
const HEX = /^#[0-9a-f]{6}$/i
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)) }
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
// Text colour that stays readable on top of `bg` (used for buttons with a custom primary colour)
export const readableOn = (bg) => { const L = lum(bg); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.061 ? '#ffffff' : '#1b1b1b' }
const cleanColors = (c = {}) => Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === 'string' && HEX.test(v)))

// Layers are applied lowest to highest: global, then dashboard, then page. Later layers win.
export function mergeLayers(layers) {
  const out = {}
  for (const l of layers) {
    if (!l) continue
    if (l.preset) out.preset = l.preset
    if (l.legacyPalette) out.legacyPalette = l.legacyPalette
    if (l.colors) out.colors = { ...out.colors, ...cleanColors(l.colors) }
    if (typeof l.fontSize === 'number') out.fontSize = l.fontSize
    if (typeof l.radius === 'number') out.radius = l.radius
    if (l.background) out.background = l.background
    if (typeof l.reduceMotion === 'boolean') out.reduceMotion = l.reduceMotion
  }
  return out
}

export function resolveTheme(layers, systemDark = false) {
  const m = mergeLayers(layers)
  const id = m.preset ?? 'light'
  const base = id === 'system' ? PRESETS[systemDark ? 'dark' : 'light'] : PRESETS[id] ?? PRESETS.light
  const legacy = m.legacyPalette && !m.preset ? LEGACY[m.legacyPalette]?.[base.mode] ?? {} : {}
  const c = { ...base.c, ...legacy, ...m.colors }
  // if the person picked their own text colour, derive the softer "muted" text from it
  c.muted = m.colors?.text || m.colors?.background ? mix(c.text, c.background, 0.45) : base.c.muted
  const radius = m.radius ?? 1
  return {
    mode: base.mode,
    colors: c,
    fontScale: m.fontSize ?? 100,
    radius,
    background: m.background ?? null,
    reduceMotion: !!m.reduceMotion,
    vars: {
      '--bg': c.background, '--surface': c.surface, '--line': c.border, '--ink': c.text, '--muted': c.muted,
      '--accent': c.primary, '--accent-soft': c.secondary, '--highlight': c.accent,
      '--on-primary': readableOn(c.primary), '--r': String(radius),
    },
  }
}

export function applyTheme(t) {
  const root = document.documentElement
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.classList.toggle('dark', t.mode === 'dark')
  root.classList.toggle('reduce-motion', t.reduceMotion)
  root.style.fontSize = `${(16 * t.fontScale) / 100}px`
  try {
    localStorage.setItem('wb-theme-cache', JSON.stringify({ vars: t.vars, mode: t.mode, fontScale: t.fontScale, reduceMotion: t.reduceMotion }))
  } catch { /* storage can be blocked; the theme still applies */ }
}

export const PAGES = [
  { key: 'dashboard', name: 'Dashboard' },
  { key: 'board', name: 'Kanban Board' },
  { key: 'my-tasks', name: 'My Tasks' },
  { key: 'list', name: 'List' },
  { key: 'workspace', name: 'Workspaces' },
  { key: 'profile', name: 'Profile & settings' },
  { key: 'companion', name: 'My companion' },
  { key: 'appearance', name: 'Appearance & Theme' },
]
export const pageName = (key) => PAGES.find((p) => p.key === key)?.name ?? key
