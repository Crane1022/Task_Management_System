// Profile photos are shrunk in the browser to a small square (about 160 px, under 30 KB) and saved on the
// person's own profile document, so no file storage is needed.
export async function squarePhoto(file, size = 160) {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length < 30000) return url
  }
  throw new Error('That picture is too detailed to shrink. Try another one.')
}
export const timeZones = () => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Asia/Kuala_Lumpur', 'UTC'])
