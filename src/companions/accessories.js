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
export const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id)

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
    default:
      return ''
  }
}
