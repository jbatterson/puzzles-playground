/**
 * Rasterizes tools/cube.svg (All Ten cube asset, same as hub chrome) onto a white 180×180 PNG for iOS home screen.
 * Artwork is drawn at 80% of the tile and centered (cube.svg is also shifted to center isometric art in the viewBox).
 * Writes two copies: `public/` for `<link rel="apple-touch-icon">`, `src/assets/` for bundling in the Add to Home modal (correct URL on GitHub Pages).
 * Run: node tools/generateAppleTouchIcon.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, 'cube.svg')
const publicDir = join(__dirname, '..', 'public')
const assetsDir = join(__dirname, '..', 'src', 'assets')
const outPublic = join(publicDir, 'apple-touch-icon.png')
const outAssets = join(assetsDir, 'apple-touch-icon.png')

/** Output size (iOS @3x slot uses 180×180 source). */
const OUT = 180
/** Scale cube artwork relative to filling the square (smaller = more breathing room). */
const SCALE = 0.8

const svg = readFileSync(svgPath)
mkdirSync(publicDir, { recursive: true })
mkdirSync(assetsDir, { recursive: true })

const inner = Math.round(OUT * SCALE)
const pad = Math.floor((OUT - inner) / 2)

const innerBuffer = await sharp(svg)
  .resize(inner, inner, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    position: 'center',
  })
  .png()
  .toBuffer()

const png = sharp({
  create: {
    width: OUT,
    height: OUT,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
}).composite([{ input: innerBuffer, top: pad, left: pad }])

await png.clone().png().toFile(outPublic)
await png.clone().png().toFile(outAssets)

console.log('Wrote', outPublic)
console.log('Wrote', outAssets)
