/**
 * Dedupe Scuttlebug puzzles by D4 start-layout fingerprint (8 rotations/reflections).
 * Keeps the first occurrence across tutorial → easy → medium → hard.
 *
 *   node tools/tetromino/dedupeScuttlebugPuzzles.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(root, 'puzzlegames/scuttlebug/puzzles.js')
const { default: data } = await import(pathToFileURL(abs).href + `?t=${Date.now()}`)
const { normalizePuzzleInput } = await import(
  pathToFileURL(path.join(root, 'puzzlegames/scuttlebug/engine.js')).href
)

function mapCell(r, c, n, orient) {
  const rot = orient % 4
  const reflect = orient >= 4
  let rr = r
  let cc = c
  for (let i = 0; i < rot; i++) {
    const nr = cc
    const nc = n - 1 - rr
    rr = nr
    cc = nc
  }
  if (reflect) cc = n - 1 - cc
  return [rr, cc]
}

function encodeStart(size, player, hole, pieces) {
  const pieceKeys = pieces
    .map((p) => {
      const cells = p.cells
        .map((c) => `${c.r},${c.c}`)
        .sort()
        .join('|')
      return `${p.type}:${cells}`
    })
    .sort()
  return JSON.stringify({
    s: size,
    pl: [player.r, player.c],
    h: [hole.r, hole.c],
    p: pieceKeys,
  })
}

/** Min encoding over the 8 D4 orientations of the start layout. */
function d4StartFingerprint(raw) {
  const p = normalizePuzzleInput(raw, false)
  const size = p.size
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const [pr, pc] = mapCell(p.player.r, p.player.c, size, orient)
    const [hr, hc] = mapCell(p.target.r, p.target.c, size, orient)
    const mapped = p.pieces.map((piece) => ({
      type: piece.type || '?',
      cells: piece.cells.map((c) => {
        const [r, c2] = mapCell(c.r, c.c, size, orient)
        return { r, c: c2 }
      }),
    }))
    const key = encodeStart(size, { r: pr, c: pc }, { r: hr, c: hc }, mapped)
    if (best == null || key < best) best = key
  }
  return best
}

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatPuzzle(raw) {
  const p = normalizePuzzleInput(raw, false)
  let piecesPart
  if (raw.pieces && !Array.isArray(raw.pieces)) {
    piecesPart = JSON.stringify(raw.pieces)
  } else {
    const grouped = {}
    for (const piece of p.pieces) {
      const type = piece.type || '?'
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(piece.cells.map((c) => [c.r, c.c]))
    }
    piecesPart = JSON.stringify(grouped)
  }
  const pushes = raw.pushes ?? raw.minPushes
  const head =
    `    { size: ${p.size}, pieces: ${piecesPart}, ` +
    `player: ${cellPair(raw.player ?? p.player)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

function glyphs(p) {
  return typeof p.solution === 'string' ? p.solution.length : 0
}

const TIERS = ['tutorial', 'easy', 'medium', 'hard']
const seen = new Map()
const next = {}
const removed = []

for (const tier of TIERS) {
  const list = data[tier] || []
  const keep = []
  list.forEach((raw, i) => {
    const fp = d4StartFingerprint(raw)
    if (seen.has(fp)) {
      removed.push({ tier, i, of: seen.get(fp), glyphs: glyphs(raw) })
    } else {
      seen.set(fp, { tier, i })
      keep.push(raw)
    }
  })
  next[tier] = keep
}

// Re-sort each tier by glyph count after cull
const byGlyph = (a, b) =>
  glyphs(a) - glyphs(b) ||
  (a.pushes ?? 0) - (b.pushes ?? 0) ||
  String(a.solution || '').localeCompare(String(b.solution || ''))
for (const tier of TIERS) {
  next[tier] = [...next[tier]].sort(byGlyph)
}

const src = fs.readFileSync(abs, 'utf8')
const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
if (!headerMatch) throw new Error('header not found')
const header = headerMatch[0].replace(/\r\n/g, '\n')

const body = TIERS.map((tier) => {
  const lines = next[tier].map(formatPuzzle).join('\n')
  return `  ${tier}: [\n${lines}\n  ],`
}).join('\n\n')

const out = `${header}${body}\n}\n`
fs.writeFileSync(abs, src.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out, 'utf8')

console.log(`Removed ${removed.length} D4-duplicate(s):`)
for (const r of removed) {
  console.log(`  ${r.tier}[${r.i}] (glyphs ${r.glyphs}) duplicate of ${r.of.tier}[${r.of.i}]`)
}
console.log(
  `Kept: tutorial ${next.tutorial.length}, easy ${next.easy.length}, medium ${next.medium.length}, hard ${next.hard.length} (total ${TIERS.reduce((s, t) => s + next[t].length, 0)})`
)
