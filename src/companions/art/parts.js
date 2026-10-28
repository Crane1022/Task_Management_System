// Small building blocks shared by the drawings. Colours are CSS variables (--c-body, --c-ear, ...), so one drawing can be
// recoloured part by part without touching outlines, shading or the face. Class names (pet-*) are what the animations use.
export const V = {
  body: 'var(--c-body)', sec: 'var(--c-secondary)', face: 'var(--c-face)', ear: 'var(--c-ear)', inner: 'var(--c-inner)',
  eye: 'var(--c-eye)', nose: 'var(--c-nose)', paw: 'var(--c-paw)', tail: 'var(--c-tail)', mark: 'var(--c-marking)',
}
const r2 = (n) => Math.round(n * 100) / 100
export const ellipsePath = (cx, cy, rx, ry) => `M${r2(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${r2(rx * 2)} 0a${rx} ${ry} 0 1 0 ${r2(-rx * 2)} 0Z`
export const el = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`

// two eyes that blink together (scaled from their own centre)
export const eyes = (cy = 40, dx = 11, r = 3, cx = 50, fill = V.eye) => `<g class="pet-eyes" style="transform-origin:${cx}px ${cy}px">`
  + el(cx - dx, cy, r, r2(r * 1.2), fill) + el(cx + dx, cy, r, r2(r * 1.2), fill)
  + `<circle cx="${r2(cx - dx + r * 0.35)}" cy="${r2(cy - r * 0.45)}" r="${r2(r * 0.32)}" fill="#fff"/><circle cx="${r2(cx + dx + r * 0.35)}" cy="${r2(cy - r * 0.45)}" r="${r2(r * 0.32)}" fill="#fff"/></g>`
// cheeks that appear when the pet is happy
export const blush = (cy = 49, dx = 18, cx = 50) => `<g class="pet-blush" opacity="0">${el(cx - dx, cy, 4.5, 2.6, '#ff8fa3')}${el(cx + dx, cy, 4.5, 2.6, '#ff8fa3')}</g>`
export const smile = (cy = 51, w = 5, cx = 50) => `<path class="pet-mouth" d="M${cx - w} ${cy}Q${cx} ${cy + w * 0.95} ${cx + w} ${cy}" fill="none" stroke="#4a3030" stroke-width="1.6" stroke-linecap="round"/>`
export const paws = (y = 93, dx = 14, rx = 8, ry = 4.6, fill = V.paw) => el(50 - dx, y, rx, ry, fill) + el(50 + dx, y, rx, ry, fill)
export const body = (cx = 50, cy = 76, rx = 24, ry = 20, extra = '') => `<g class="pet-body" style="transform-origin:50px 96px">${el(cx, cy, rx, ry, V.body)}${extra}</g>`
export const belly = (cx = 50, cy = 80, rx = 14, ry = 14) => el(cx, cy, rx, ry, V.sec)
export const tail = (inner, ox, oy) => `<g class="pet-tail" style="transform-origin:${ox}px ${oy}px">${inner}</g>`
export const ear = (side, ox, oy, inner) => `<g class="pet-ear pet-ear-${side}" style="transform-origin:${ox}px ${oy}px">${inner}</g>`
export const head = (inner, ox = 50, oy = 62) => `<g class="pet-head-shape">${inner}</g>`
export const whiskers = (cy = 49, from = 31, to = 17, rise = 3) => `<path d="M${from} ${cy}l${to - from} ${-rise}M${from} ${cy + 3.5}l${to - from} ${rise}M${100 - from} ${cy}l${from - to} ${-rise}M${100 - from} ${cy + 3.5}l${from - to} ${rise}" fill="none" stroke="#7d7568" stroke-width="1" stroke-linecap="round" opacity=".8"/>`
export const noseTri = (cy = 46, w = 3.4, fill = V.nose) => `<path d="M${50 - w} ${cy}h${w * 2}l${-w} ${r2(w * 0.95)}z" fill="${fill}"/>`
export const noseDot = (cy = 46, rx = 4.2, ry = 3.2, fill = V.nose) => el(50, cy, rx, ry, fill) + `<ellipse cx="48.6" cy="${cy - 1}" rx="1.3" ry=".8" fill="#fff" opacity=".6"/>`
