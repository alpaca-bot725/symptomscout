/**
 * Generates public/icons/icon-192.png and icon-512.png (blue rounded square
 * with a white medical cross) using only Node built-ins — no image libraries.
 * Run once with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BLUE = [37, 99, 235] // #2563eb
const WHITE = [255, 255, 255]
const BG = [240, 247, 255] // page background, shows in rounded corners

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makeIcon(size) {
  const radius = size * 0.22
  const cross = { arm: size * 0.16, span: size * 0.54, r: size * 0.05 }
  const px = Buffer.alloc(size * size * 3)

  const insideRounded = (x, y) => {
    const r = radius
    const cx = x < r ? r : x > size - r ? size - r : x
    const cy = y < r ? r : y > size - r ? size - r : y
    if (cx === x || cy === y) return true
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }

  // The cross = union of two rounded bars centered in the icon.
  const insideBar = (x, y, w, h) => {
    const dx = Math.abs(x - size / 2)
    const dy = Math.abs(y - size / 2)
    const hw = w / 2
    const hh = h / 2
    const r = cross.r
    if (dx > hw || dy > hh) return false
    if (dx <= hw - r || dy <= hh - r) return true
    return (dx - (hw - r)) ** 2 + (dy - (hh - r)) ** 2 <= r * r
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG
      if (insideRounded(x + 0.5, y + 0.5)) color = BLUE
      if (
        insideBar(x + 0.5, y + 0.5, cross.arm, cross.span) ||
        insideBar(x + 0.5, y + 0.5, cross.span, cross.arm)
      )
        color = WHITE
      const i = (y * size + x) * 3
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
    }
  }

  // PNG format: each row is prefixed with a filter byte (0 = none).
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), makeIcon(size))
  console.log(`icon-${size}.png written`)
}
