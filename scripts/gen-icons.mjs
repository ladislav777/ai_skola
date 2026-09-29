/**
 * Generátor ikon pre Android/PWA – bez externých závisností.
 * Kreslí logo „AI škola“ (maturitný klobúk) do PNG súborov:
 *   - public/icons/…                 (PWA / web)
 *   - android/.../res/mipmap-*dpi/…  (launcher ikony)
 *   - android/.../res/drawable-*dpi/ (úvodná obrazovka)
 * Spustenie: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'icons')
mkdirSync(OUT, { recursive: true })

/* --------------------------------------------------------- PNG kodér ---- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* -------------------------------------------------------- kreslenie ----- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => a + (b - a) * clamp01(t)

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function inPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]
    const yi = pts[i + 1]
    const xj = pts[j]
    const yj = pts[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Vráti [r,g,b,a] pre jeden pixel. */
function shade(x, y, s, maskable) {
  const pad = maskable ? s * 0.1 : 0
  const radius = maskable ? s * 0.5 : s * 0.235
  if (!inRoundedRect(x, y, pad, pad, s - pad, s - pad, radius)) return [0, 0, 0, 0]

  const g = clamp01((y - pad) / (s - 2 * pad))
  const bg = [mix(79, 34, g), mix(70, 211, g), mix(229, 238, g)]

  const cx = s / 2
  const cy = s * 0.52
  const u = s / 100

  const board = [cx, cy - 20 * u, cx + 38 * u, cy, cx, cy + 20 * u, cx - 38 * u, cy]
  const head = [cx - 22 * u, cy + 4 * u, cx + 22 * u, cy + 4 * u, cx + 16 * u, cy + 28 * u, cx - 16 * u, cy + 28 * u]
  const tasselLine = [
    [cx + 34 * u, cy + 2 * u, cx + 40 * u, cy + 24 * u],
    [cx + 40 * u, cy + 24 * u, cx + 30 * u, cy + 34 * u],
  ]
  const onLine = tasselLine.some(([ax, ay, bx, by]) => {
    const dx = bx - ax
    const dy = by - ay
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))
    return (x - (ax + dx * t)) ** 2 + (y - (ay + dy * t)) ** 2 <= (3.2 * u) ** 2
  })
  const onTassel = inCircle(x, y, cx + 30 * u, cy + 34 * u, 6 * u)

  if (inPoly(x, y, board) || inPoly(x, y, head) || onLine || onTassel) return [255, 255, 255, 255]
  return [Math.round(bg[0]), Math.round(bg[1]), Math.round(bg[2]), 255]
}

function render(size, maskable = false) {
  const SS = 3 // supersampling pre antialiasing
  const buf = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = shade(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, size, maskable)
          r += pr * pa
          g += pg * pa
          b += pb * pa
          a += pa
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      buf[i] = a ? Math.round(r / a) : 0
      buf[i + 1] = a ? Math.round(g / a) : 0
      buf[i + 2] = a ? Math.round(b / a) : 0
      buf[i + 3] = Math.round(a / n)
    }
  }
  return buf
}

/* ------------------------------------------------------------ výstup --- */
for (const [file, size, maskable] of [
  ['icon-64.png', 64, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  const png = encodePng(size, size, render(size, maskable))
  writeFileSync(path.join(OUT, file), png)
  console.log(`web    ${file.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

/* Android launcher ikony pre každú hustotu obrazovky */
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
const densities = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
]

if (existsSync(RES)) {
  for (const [dir, size] of densities) {
    const target = path.join(RES, dir)
    if (!existsSync(target)) continue
    const png = encodePng(size, size, render(size))
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      writeFileSync(path.join(target, name), png)
    }
    console.log(`android ${dir.padEnd(24)} ${size}x${size}`)
  }

  /* Úvodná obrazovka: tmavé pozadie + logo uprostred */
  const splashPng = (w, h) => {
    const px = Buffer.alloc(w * h * 4)
    const size = Math.round(Math.min(w, h) * 0.42)
    const icon = render(size)
    const ox = Math.round((w - size) / 2)
    const oy = Math.round((h - size) / 2)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const g = y / h
        let [r, gr, b] = [Math.round(mix(9, 13, g)), Math.round(mix(12, 27, g)), Math.round(mix(24, 43, g))]
        if (x >= ox && x < ox + size && y >= oy && y < oy + size) {
          const s = ((y - oy) * size + (x - ox)) * 4
          const a = icon[s + 3] / 255
          r = Math.round(mix(r, icon[s], a))
          gr = Math.round(mix(gr, icon[s + 1], a))
          b = Math.round(mix(b, icon[s + 2], a))
        }
        px[i] = r
        px[i + 1] = gr
        px[i + 2] = b
        px[i + 3] = 255
      }
    }
    return encodePng(w, h, px)
  }

  const splashes = [
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
  ]

  let splashCount = 0
  for (const [dir, w, h] of splashes) {
    const target = path.join(RES, dir, 'splash.png')
    if (!existsSync(path.dirname(target))) continue
    writeFileSync(target, splashPng(w, h))
    splashCount++
  }
  console.log(`android splash.png (${splashCount} hustôt)`)
} else {
  console.log('\nAndroid projekt chýba – preskočené mipmap/splash. Spustite: npx cap add android && npm run icons')
}

console.log(`\nHotovo → ${OUT}`)
