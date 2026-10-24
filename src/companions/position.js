// Where the pet sits. It is stored as a share of the window (0..1), so it stays sensible on any screen,
// after a resize, and on another device. Pure functions (no DOM) so they can be tested.
export const MARGIN = 8

export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max))

// the largest size that still fits comfortably on a small screen
export const fitSize = (size, vw, vh) => Math.round(Math.min(size, Math.max(48, Math.min(vw, vh) * 0.4)))

// share of the window -> top-left corner in pixels, always fully inside the window
export function toPixels(pos, size, vw, vh, margin = MARGIN) {
  return {
    left: clamp(pos.x * vw - size / 2, margin, vw - size - margin),
    top: clamp(pos.y * vh - size / 2, margin, vh - size - margin),
  }
}

// top-left corner in pixels -> share of the window (the centre of the pet)
export function toShare(left, top, size, vw, vh) {
  return {
    x: clamp((left + size / 2) / vw, 0, 1),
    y: clamp((top + size / 2) / vh, 0, 1),
  }
}

// a drag: the new corner for a pointer that moved by (dx, dy) from where it started
export function dragTo(start, dx, dy, size, vw, vh, margin = MARGIN) {
  return {
    left: clamp(start.left + dx, margin, vw - size - margin),
    top: clamp(start.top + dy, margin, vh - size - margin),
  }
}

// small movements are a click (a pat), not a drag
export const DRAG_THRESHOLD = 5
export const isDrag = (dx, dy) => Math.hypot(dx, dy) > DRAG_THRESHOLD
