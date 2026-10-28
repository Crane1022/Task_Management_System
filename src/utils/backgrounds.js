// Built-in backgrounds are drawn here as SVG, so they need no image files and work offline.
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
const svg = (inner) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${inner}</svg>`)}`
const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`

function forest() {
  const r = rnd(7)
  let o = `<defs>${grad('g', [[0, '#e6efd2'], [1, '#b9d3a0']])}</defs><rect width="1600" height="900" fill="url(#g)"/>`
  for (const [fill, base, h] of [['#9fbe86', 520, 70], ['#7fa56d', 620, 90], ['#5f8a56', 720, 110], ['#3f6b3f', 830, 130]]) {
    for (let x = -40; x < 1640; x += 50 + r() * 40) {
      const th = h * (0.8 + r() * 0.8), w = th * 0.5
      o += `<polygon points="${x},${base} ${x + w},${base} ${x + w / 2},${base - th}" fill="${fill}"/>`
      o += `<polygon points="${x + w * 0.1},${base - th * 0.45} ${x + w * 0.9},${base - th * 0.45} ${x + w / 2},${base - th * 1.2}" fill="${fill}"/>`
    }
    o += `<rect y="${base}" width="1600" height="${900 - base}" fill="${fill}"/>`
  }
  return svg(o)
}
function leaves() {
  const r = rnd(3), cols = ['#8fb36f', '#6f9a58', '#a9c98a', '#5b8a4f', '#c3d9a5']
  let o = '<rect width="1600" height="900" fill="#e9f0dc"/>'
  for (let i = 0; i < 46; i++) {
    o += `<g transform="translate(${(r() * 1600) | 0} ${(r() * 900) | 0}) rotate(${(r() * 360) | 0}) scale(${(0.6 + r() * 1.3).toFixed(2)})" opacity="${(0.55 + r() * 0.4).toFixed(2)}"><path d="M0 0C20-34 66-34 90 0C66 34 20 34 0 0Z" fill="${cols[i % 5]}"/><path d="M0 0L82 0" stroke="#3f6b3f" stroke-opacity=".35" stroke-width="2"/></g>`
  }
  return svg(o)
}
function mountains() {
  const r = rnd(11)
  let o = `<defs>${grad('s', [[0, '#f6e3cf'], [0.6, '#cfe2ee']])}</defs><rect width="1600" height="900" fill="url(#s)"/><circle cx="1250" cy="230" r="70" fill="#fff6e0" opacity=".9"/>`
  for (const [f, base] of [['#aebfce', 430], ['#8aa3b4', 560], ['#5f7f78', 690], ['#3f5f55', 800]]) {
    let p = `0,900 0,${base}`
    for (let x = 0; x <= 1600; x += 100 + r() * 80) p += ` ${x | 0},${(base - 60 - r() * 170) | 0}`
    o += `<polygon points="${p} 1600,${base} 1600,900" fill="${f}"/>`
  }
  return svg(o)
}
function sky() {
  const r = rnd(5)
  let o = `<defs>${grad('s', [[0, '#7fb8e6'], [1, '#eaf5fb']])}</defs><rect width="1600" height="900" fill="url(#s)"/>`
  for (let i = 0; i < 9; i++) {
    o += `<g transform="translate(${(r() * 1500) | 0} ${(80 + r() * 620) | 0}) scale(${(0.7 + r() * 1.1).toFixed(2)})" fill="#fff" opacity="${(0.65 + r() * 0.3).toFixed(2)}"><ellipse cx="60" cy="40" rx="60" ry="26"/><ellipse cx="110" cy="28" rx="46" ry="30"/><ellipse cx="150" cy="44" rx="55" ry="24"/></g>`
  }
  return svg(o)
}
const paper = () => svg('<defs><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .22  0 0 0 .22 0"/></filter></defs><rect width="1600" height="900" fill="#f4ecd9"/><rect width="1600" height="900" filter="url(#n)"/>')
const gradient = () => svg(`<defs>${grad('g', [[0, '#eef3e3'], [1, '#dde8ea']], 1, 1)}<radialGradient id="a" cx=".2" cy=".15" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="url(#g)"/><rect width="1600" height="900" fill="url(#a)"/>`)
function pattern() {
  let o = '<rect width="1600" height="900" fill="#eef1e2"/>'
  for (let i = 0; i < 16; i++) {
    let d = ''
    for (let x = 0; x <= 1600; x += 40) d += `${x ? 'L' : 'M'}${x} ${(60 + i * 52 + Math.sin(x / 170 + i * 0.6) * 28 + Math.sin(x / 70 + i) * 8).toFixed(1)}`
    o += `<path d="${d}" fill="none" stroke="${i % 3 ? '#8fae7a' : '#c9a85f'}" stroke-opacity=".35" stroke-width="2"/>`
  }
  return svg(o)
}

export const GALLERY = [
  { id: 'forest', name: 'Forest', url: forest() },
  { id: 'leaves', name: 'Green leaves', url: leaves() },
  { id: 'mountains', name: 'Mountains', url: mountains() },
  { id: 'sky', name: 'Sky and clouds', url: sky() },
  { id: 'paper', name: 'Warm paper', url: paper() },
  { id: 'gradient', name: 'Soft gradient', url: gradient() },
  { id: 'pattern', name: 'Natural pattern', url: pattern() },
]
export const galleryUrl = (id) => GALLERY.find((g) => g.id === id)?.url ?? ''

export const POSITIONS = { center: 'center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' }
export const POSITION_NAMES = { center: 'Centre', top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' }

export function bgImageStyle(bg, url) {
  if (!bg || !url) return {}
  const tile = bg.size === 'tile'
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: tile ? '360px auto' : bg.size || 'cover',
    backgroundRepeat: tile ? 'repeat' : 'no-repeat',
    backgroundPosition: POSITIONS[bg.position] ?? 'center',
  }
}
