import { columnColor } from './constants'
import { galleryUrl } from './backgrounds'

// Background of a board: { type: 'color', color: 'sage' } or { type: 'gallery', id: 'forest' } (used on its preview card)
export function boardBgStyle(bg) {
  if (bg?.type === 'gallery' && galleryUrl(bg.id)) {
    return { backgroundImage: `url("${galleryUrl(bg.id)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const hex = columnColor(bg?.color) || columnColor('sage')
  return { background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 55%, #ffffff))` }
}
