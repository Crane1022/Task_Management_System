// Puts a drawing together: the body, then the head (which moves when the pet looks around), an optional face photo,
// the face features, and an accessory. Pure strings, no Vue, so it can be tested.
import { accessorySvg } from './accessories.js'
import { getAnimal } from './registry.js'

// Each file holds one group of animals and is only downloaded when one of them is needed.
const GROUPS = {
  cats: () => import('./art/cats.js'),
  pets: () => import('./art/pets.js'),
  farm: () => import('./art/farm.js'),
  wild: () => import('./art/wild.js'),
  water: () => import('./art/water.js'),
}
const loaded = new Map()
export async function loadArt(animalId) {
  const a = getAnimal(animalId)
  if (!a) return null
  if (!loaded.has(a.group)) loaded.set(a.group, GROUPS[a.group]().then((m) => m.default))
  return (await loaded.get(a.group))[a.art] ?? null
}
export const artGroups = () => Object.keys(GROUPS)

// A picture source may only be one we made ourselves: a blob: URL for a stored picture, or a data:image URL
const SAFE_SRC = /^(blob:[^"'<>\s]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/

// photo = { href, zoom, x, y }; zoom 1..3, x and y -1..1 (only have an effect once zoomed in)
export function composePetSvg({ art, uid = 'p', photo = null, accessory = 'none' }) {
  if (!art) return ''
  const usePhoto = !!(photo && art.face && SAFE_SRC.test(photo.href ?? ''))
  let photoLayer = ''
  if (usePhoto) {
    const [bx, by, bw, bh] = art.face.box
    const z = Math.min(3, Math.max(1, photo.zoom || 1))
    const w = bw * z, h = bh * z
    const ox = (photo.x || 0) * bw * (z - 1) / 2, oy = (photo.y || 0) * bh * (z - 1) / 2
    const id = `pf-${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}`
    photoLayer = `<defs><clipPath id="${id}"><path d="${art.face.d}"/></clipPath></defs>`
      + `<g class="pet-photo" clip-path="url(#${id})"><image href="${photo.href}" x="${bx + bw / 2 - w / 2 + ox}" y="${by + bh / 2 - h / 2 + oy}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></g>`
      + `<path d="${art.face.d}" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1.2"/>`
  }
  const acc = accessorySvg(accessory, art.anchors)
  const scarf = accessory === 'scarf'
  return `${art.under}${scarf ? acc : ''}<g class="pet-head">${art.head}${photoLayer}${usePhoto ? '' : art.front}${scarf ? '' : acc}</g>`
}
