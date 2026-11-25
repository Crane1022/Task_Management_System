// Small extras drawn over the head. They are placed using each animal's anchors (see art/*.js), so they fit every animal.
export const ACCESSORIES = [
  { id: 'none', name: 'None' },
  { id: 'bow', name: 'Bow' },
  { id: 'party', name: 'Party hat' },
  { id: 'glasses', name: 'Glasses' },
  { id: 'crown', name: 'Crown' },
  { id: 'headphones', name: 'Headphones' },
  { id: 'scarf', name: 'Scarf' },
]
// Festive outfits (25 Nov 2026): free, given on special days and kept in the person's wardrobe (companions/festive.js).
// Not in the everyday picker above; the wardrobe on My companion lists the ones the person has.
export const FESTIVE_ACCESSORY_IDS = ['santa', 'ghost', 'partyglasses', 'heart', 'redscarf', 'songkok', 'bindi', 'garland', 'lotus', 'flag', 'headband', 'siga', 'bowtie', 'shades', 'mug', 'nightcap', 'umbrella']
export const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id)
// Combining (25 Nov 2026): the festive outfit is a second layer, so the person's own accessory is never replaced.
// Each item sits in one place; when both want the same place (two hats, two pairs of glasses), only the festive
// one is drawn while it is on. The person's saved accessory stays as it is.
const SLOT = {
  party: 'top', crown: 'top', santa: 'top', songkok: 'top', nightcap: 'top', headband: 'top', siga: 'top', headphones: 'ears',
  glasses: 'eyes', partyglasses: 'eyes', shades: 'eyes',
  scarf: 'neck', redscarf: 'neck', garland: 'neck', heart: 'neck', lotus: 'neck', bowtie: 'neck',
  bow: 'side', flag: 'side2', mug: 'hold', umbrella: 'above', bindi: 'forehead', ghost: 'all',
}
export const slotOf = (id) => SLOT[id] ?? ''
// may the accessory be drawn together with this outfit?
export function fitsWith(accessory, outfit) {
  if (!accessory || accessory === 'none' || !outfit) return true
  const a = slotOf(accessory), o = slotOf(outfit)
  if (o === 'all') return a === 'top' || a === 'side' // the little ghost keeps its hat or bow; glasses and scarves hide under the sheet
  if (a === 'ears' && o === 'top') return false        // a hat over headphones looks wrong
  return a !== o
}
// drawn under the head (around the neck, over the body), like the scarf
export const UNDER_HEAD = new Set(['scarf', 'redscarf', 'garland', 'heart', 'lotus', 'bowtie', 'mug'])

// a = { top: [x, y], head: [x, y], neck: [x, y], w: head width }
export function accessorySvg(id, a) {
  const [tx, ty] = a.top, [hx, hy] = a.head, [nx, ny] = a.neck, w = a.w
  switch (id) {
    case 'bow': // beside the top of the head
      return `<g class="pet-acc"><path d="M${tx + w * 0.28} ${ty + 3} l9 -5 v10 z M${tx + w * 0.28} ${ty + 3} l-9 -5 v10 z" fill="#ef6f8f"/><circle cx="${tx + w * 0.28}" cy="${ty + 3}" r="2.6" fill="#d94a72"/></g>`
    case 'party':
      return `<g class="pet-acc"><path d="M${tx - 9} ${ty + 6} L${tx} ${ty - 13} L${tx + 9} ${ty + 6} Z" fill="#7aa8ff"/><path d="M${tx - 6} ${ty - 1} l12 0 M${tx - 3.5} ${ty - 7} l7 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="${tx}" cy="${ty - 13}" r="2.6" fill="#ffd23f"/></g>`
    case 'glasses':
      return `<g class="pet-acc" fill="none" stroke="#2b2b2b" stroke-width="2"><circle cx="${hx - w * 0.22}" cy="${hy}" r="${w * 0.15}" fill="rgba(255,255,255,.25)"/><circle cx="${hx + w * 0.22}" cy="${hy}" r="${w * 0.15}" fill="rgba(255,255,255,.25)"/><path d="M${hx - w * 0.07} ${hy} h${w * 0.14}"/></g>`
    case 'crown':
      return `<g class="pet-acc"><path d="M${tx - 11} ${ty + 4} l2 -13 l5 6 l4 -9 l4 9 l5 -6 l2 13 z" fill="#ffd23f" stroke="#d9a400" stroke-width="1.2" stroke-linejoin="round"/></g>`
    case 'headphones':
      return `<g class="pet-acc"><path d="M${hx - w * 0.5} ${hy + 2} C${hx - w * 0.5} ${ty - 8}, ${hx + w * 0.5} ${ty - 8}, ${hx + w * 0.5} ${hy + 2}" fill="none" stroke="#3a3f4a" stroke-width="3.2" stroke-linecap="round"/><rect x="${hx - w * 0.57}" y="${hy - 4}" width="8" height="15" rx="3.5" fill="#3a3f4a"/><rect x="${hx + w * 0.57 - 8}" y="${hy - 4}" width="8" height="15" rx="3.5" fill="#3a3f4a"/></g>`
    case 'scarf':
      return `<g class="pet-acc"><path d="M${nx - w * 0.42} ${ny - 2} Q${nx} ${ny + 8} ${nx + w * 0.42} ${ny - 2} l0 7 Q${nx} ${ny + 15} ${nx - w * 0.42} ${ny + 5} Z" fill="#e0574f"/><path d="M${nx + w * 0.2} ${ny + 5} l4 14 l7 -2 l-3 -13 z" fill="#c9443d"/></g>`
    // ----- festive outfits -----
    case 'santa':
      return `<g class="pet-acc"><path d="M${tx - w * 0.36} ${ty + 5} Q${tx - 2} ${ty - 22} ${tx + w * 0.42} ${ty - 6} L${tx + w * 0.3} ${ty + 5} Z" fill="#d23b2f"/><rect x="${tx - w * 0.4}" y="${ty + 1}" width="${w * 0.8}" height="7" rx="3.5" fill="#fff"/><circle cx="${tx + w * 0.44}" cy="${ty - 6}" r="4" fill="#fff"/></g>`
    case 'ghost': // a white sheet over the whole pet, with two eye holes
      return `<g class="pet-acc"><path d="M${hx - w * 0.62} ${ny + 30} V${hy} C${hx - w * 0.62} ${ty - 10}, ${hx + w * 0.62} ${ty - 10}, ${hx + w * 0.62} ${hy} V${ny + 30} l-${w * 0.155} -6 l-${w * 0.155} 6 l-${w * 0.155} -6 l-${w * 0.155} 6 l-${w * 0.155} -6 l-${w * 0.155} 6 l-${w * 0.155} -6 Z" fill="#f7f5ef" stroke="#d8d2c4" stroke-width="1.5"/><ellipse cx="${hx - w * 0.2}" cy="${hy}" rx="4.5" ry="6" fill="#2b2238"/><ellipse cx="${hx + w * 0.2}" cy="${hy}" rx="4.5" ry="6" fill="#2b2238"/><ellipse cx="${hx}" cy="${hy + 13}" rx="4" ry="3.5" fill="#2b2238"/></g>`
    case 'partyglasses':
      return `<g class="pet-acc"><rect x="${hx - w * 0.38}" y="${hy - 6}" width="${w * 0.3}" height="12" rx="4" fill="#f2c94c" stroke="#b8901f" stroke-width="1.2"/><rect x="${hx + w * 0.08}" y="${hy - 6}" width="${w * 0.3}" height="12" rx="4" fill="#f2c94c" stroke="#b8901f" stroke-width="1.2"/><path d="M${hx - w * 0.08} ${hy - 1} h${w * 0.16}" stroke="#b8901f" stroke-width="2"/></g>`
    case 'shades':
      return `<g class="pet-acc"><path d="M${hx - w * 0.4} ${hy - 5} h${w * 0.32} v4 a6 6 0 0 1 -6 6 h-${w * 0.32 - 12} a6 6 0 0 1 -6 -6 Z M${hx + w * 0.08} ${hy - 5} h${w * 0.32} v4 a6 6 0 0 1 -6 6 h-${w * 0.32 - 12} a6 6 0 0 1 -6 -6 Z" fill="#1f2d27"/><path d="M${hx - w * 0.42} ${hy - 5} h${w * 0.84}" stroke="#1f2d27" stroke-width="2"/></g>`
    case 'heart':
      return `<g class="pet-acc"><path d="M${nx} ${ny + 16} c-9 -6 -11 -10 -11 -13 a5.5 5.5 0 0 1 11 -2 a5.5 5.5 0 0 1 11 2 c0 3 -2 7 -11 13 z" fill="#d6456b" stroke="#fff" stroke-width="1.5"/></g>`
    case 'redscarf':
      return `<g class="pet-acc"><path d="M${nx - w * 0.42} ${ny - 2} Q${nx} ${ny + 8} ${nx + w * 0.42} ${ny - 2} l0 7 Q${nx} ${ny + 15} ${nx - w * 0.42} ${ny + 5} Z" fill="#d1342a"/><path d="M${nx - w * 0.42} ${ny + 4} Q${nx} ${ny + 13} ${nx + w * 0.42} ${ny + 4}" fill="none" stroke="#d4a437" stroke-width="1.6"/><circle cx="${nx}" cy="${ny + 15}" r="4.5" fill="#f2c94c" stroke="#b8901f"/><rect x="${nx - 1.5}" y="${ny + 13.5}" width="3" height="3" fill="#b8901f"/></g>`
    case 'songkok':
      return `<g class="pet-acc"><path d="M${tx - w * 0.33} ${ty + 6} V${ty - 7} Q${tx} ${ty - 13} ${tx + w * 0.33} ${ty - 7} V${ty + 6} Q${tx} ${ty + 1} ${tx - w * 0.33} ${ty + 6} Z" fill="#1f2d27"/><path d="M${tx - w * 0.33} ${ty + 3} Q${tx} ${ty - 2} ${tx + w * 0.33} ${ty + 3}" fill="none" stroke="#d4a437" stroke-width="1.3"/></g>`
    case 'bindi':
      return `<g class="pet-acc"><circle cx="${hx}" cy="${hy - w * 0.22}" r="2.6" fill="#d1342a"/></g>`
    case 'garland':
      return `<g class="pet-acc">${[-0.4, -0.27, -0.13, 0, 0.13, 0.27, 0.4].map((k, i) => `<circle cx="${nx + w * k}" cy="${ny + 2 + (0.16 - k * k) * 30}" r="4" fill="${i % 2 ? '#f2c94c' : '#f08a24'}"/>`).join('')}</g>`
    case 'lotus':
      return `<g class="pet-acc"><path d="M${nx} ${ny + 2} q5 7 0 15 q-5 -8 0 -15 z M${nx - 9} ${ny + 6} q8 2 9 11 q-8 -1 -9 -11 z M${nx + 9} ${ny + 6} q-8 2 -9 11 q8 -1 9 -11 z" fill="#f2a7c1" stroke="#d6799b" stroke-width="1"/></g>`
    case 'flag': // the Jalur Gemilang on a little pole beside the head
      return `<g class="pet-acc"><path d="M${hx + w * 0.6} ${ty - 10} V${ny + 10}" stroke="#7a5a3a" stroke-width="2"/><g transform="translate(${hx + w * 0.6} ${ty - 10})"><rect width="26" height="16" fill="#fff"/><path d="M0 0h26v2.3H0zM0 4.6h26v2.3H0zM0 9.2h26v2.3H0zM0 13.8h26v2.2H0z" fill="#cc1f2f"/><rect width="13" height="9.2" fill="#1f3a7a"/><circle cx="5.5" cy="4.6" r="3" fill="#f2c94c"/><circle cx="6.6" cy="4.6" r="2.6" fill="#1f3a7a"/><circle cx="10" cy="4.6" r="1.4" fill="#f2c94c"/></g></g>`
    case 'headband': // Gawai: a beaded band with a hornbill feather
      return `<g class="pet-acc"><path d="M${tx - w * 0.36} ${ty + 6} Q${tx} ${ty - 2} ${tx + w * 0.36} ${ty + 6} l0 5 Q${tx} ${ty + 3} ${tx - w * 0.36} ${ty + 11} Z" fill="#1f2d27"/>${[-0.24, -0.12, 0, 0.12, 0.24].map((k, i) => `<circle cx="${tx + w * k}" cy="${ty + 5.5 - (0.06 - k * k) * 20}" r="1.6" fill="${i % 2 ? '#d1342a' : '#f2c94c'}"/>`).join('')}<path d="M${tx + w * 0.26} ${ty + 4} q4 -18 12 -24 q-2 14 -8 26 z" fill="#1f2d27"/><path d="M${tx + w * 0.29} ${ty} q3 -12 8 -17 q-1 10 -5 18 z" fill="#f4f1ea"/></g>`
    case 'siga': // Kaamatan: a black headcloth with gold pattern and a point
      return `<g class="pet-acc"><path d="M${tx - w * 0.38} ${ty + 8} Q${tx} ${ty - 6} ${tx + w * 0.38} ${ty + 8} L${tx + w * 0.34} ${ty - 2} Q${tx} ${ty - 10} ${tx - w * 0.34} ${ty - 2} Z" fill="#1f2d27"/><path d="M${tx - w * 0.3} ${ty + 2} Q${tx} ${ty - 6} ${tx + w * 0.3} ${ty + 2}" fill="none" stroke="#d4a437" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M${tx + w * 0.3} ${ty - 2} l9 -9 l-2 12 z" fill="#1f2d27"/></g>`
    case 'bowtie':
      return `<g class="pet-acc"><path d="M${nx} ${ny + 3} l-9 -5 v10 z M${nx} ${ny + 3} l9 -5 v10 z" fill="#3f7a96"/><circle cx="${nx}" cy="${ny + 3}" r="2.4" fill="#2c5a70"/></g>`
    case 'mug':
      return `<g class="pet-acc"><path d="M${nx - 9} ${ny + 6} h14 v10 a4 4 0 0 1 -4 4 h-6 a4 4 0 0 1 -4 -4 z" fill="#fff" stroke="#8a6a2f" stroke-width="1.6"/><path d="M${nx + 5} ${ny + 9} h2.5 a2.5 2.5 0 0 1 0 5 h-2.5" fill="none" stroke="#8a6a2f" stroke-width="1.6"/><path d="M${nx - 5} ${ny + 3} q2 -3 0 -6 M${nx} ${ny + 3} q2 -3 0 -6" fill="none" stroke="#b9a27a" stroke-width="1.3" stroke-linecap="round"/></g>`
    case 'nightcap':
      return `<g class="pet-acc"><path d="M${tx - w * 0.36} ${ty + 5} Q${tx} ${ty - 22} ${tx + w * 0.5} ${ty - 2} Q${tx + w * 0.55} ${ty + 6} ${tx + w * 0.48} ${ty + 10} L${tx + w * 0.3} ${ty + 5} Z" fill="#3f5aa8"/><rect x="${tx - w * 0.4}" y="${ty + 1}" width="${w * 0.8}" height="7" rx="3.5" fill="#e8ecf7"/><circle cx="${tx + w * 0.48}" cy="${ty + 11}" r="4" fill="#e8ecf7"/><text x="${tx + w * 0.55}" y="${ty - 12}" font-size="9" font-weight="800" fill="#8fa0cf">z</text></g>`
    case 'umbrella': // held above the head
      return `<g class="pet-acc"><path d="M${tx - w * 0.85} ${ty - 6} Q${tx} ${ty - 40} ${tx + w * 0.85} ${ty - 6} q-${w * 0.14} -6 -${w * 0.28} 0 q-${w * 0.14} -6 -${w * 0.28} 0 q-${w * 0.15} -6 -${w * 0.29} 0 q-${w * 0.14} -6 -${w * 0.28} 0 q-${w * 0.14} -6 -${w * 0.28} 0 q-${w * 0.15} -6 -${w * 0.29} 0 Z" fill="#f2c94c" stroke="#d4a437" stroke-width="1.5"/><path d="M${tx} ${ty - 24} V${ty - 6}" stroke="#5a4a3a" stroke-width="2"/></g>`
    default:
      return ''
  }
}
