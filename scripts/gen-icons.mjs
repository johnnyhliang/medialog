// Generates MediaLog PWA icons (no external deps) — a dark tile with a layered
// "card stack" accent glyph. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [17, 18, 22, 255]        // #111116
const CARD = [110, 168, 254, 255]   // accent #6ea8fe
const CARD_BACK = [60, 92, 150, 255] // dimmer accent for the back card

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  const r = Math.round(size * 0.12)
  const m = Math.round(size * 0.22) // margin
  // back card (offset up-right), front card (offset down-left)
  const off = Math.round(size * 0.06)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = BG
      if (inRoundRect(x, y, m + off, m - off, size - m + off, size - m - off, r)) c = CARD_BACK
      if (inRoundRect(x, y, m - off, m + off, size - m - off, size - m + off, r)) c = CARD
      const i = (y * size + x) * 4
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3]
    }
  }
  return buf
}

// --- minimal PNG encoder ---
const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}x${size}.png`, png(size, render(size)))
  console.log(`wrote public/pwa-${size}x${size}.png`)
}
