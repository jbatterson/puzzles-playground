/**
 * Rebucket Scuttlebug easy/medium/hard by size + solution glyph length.
 * Tutorial is left untouched.
 *
 *   easy:   5×5, glyphs 15–25
 *   medium: 6×6, glyphs 20–35
 *   hard:   6×6, glyphs > 35
 * Delete everything else in those tiers unless note matches /don't\s*delete/i.
 *
 *   node tools/tetromino/rebucketScuttlebugByGlyphs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

const KEEP_NOTE = /don'?t\s*delete/i

function glyphs(p) {
  return typeof p.solution === 'string' ? p.solution.length : 0
}

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatScuttlePuzzle(raw) {
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

const pool = [...(data.easy || []), ...(data.medium || []), ...(data.hard || [])]
const easy = []
const medium = []
const hard = []
const keptByNote = []
let deleted = 0

for (const p of pool) {
  const size = p.size ?? 5
  const g = glyphs(p)
  if (size === 5 && g >= 15 && g <= 25) {
    easy.push(p)
    continue
  }
  if (size === 6 && g >= 20 && g <= 35) {
    medium.push(p)
    continue
  }
  if (size === 6 && g > 35) {
    hard.push(p)
    continue
  }
  if (typeof p.note === 'string' && KEEP_NOTE.test(p.note)) {
    keptByNote.push(p)
    continue
  }
  deleted++
}

const byGlyph = (a, b) => glyphs(a) - glyphs(b) || String(a.solution).localeCompare(String(b.solution))
easy.sort(byGlyph)
medium.sort(byGlyph)
hard.sort(byGlyph)

// Note-kept leftovers: append to hard (still playable) so they aren't lost.
hard.push(...keptByNote)

const src = fs.readFileSync(abs, 'utf8')
const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
if (!headerMatch) throw new Error('header not found')
const header = headerMatch[0].replace(/\r\n/g, '\n')

const next = {
  tutorial: data.tutorial || [],
  easy,
  medium,
  hard,
}

const body = ['tutorial', 'easy', 'medium', 'hard']
  .map((tier) => {
    const lines = (next[tier] || []).map(formatScuttlePuzzle).join('\n')
    return `  ${tier}: [\n${lines}\n  ],`
  })
  .join('\n\n')

const crlf = src.includes('\r\n')
const out = `${header}${body}\n}\n`
fs.writeFileSync(abs, crlf ? out.replace(/\n/g, '\r\n') : out, 'utf8')

console.log('Scuttlebug rebucket (tutorial untouched)')
console.log('  easy   ', easy.length, easy.length ? `(glyphs ${glyphs(easy[0])}–${glyphs(easy[easy.length - 1])})` : '(empty — no 5×5 in daily pool)')
console.log('  medium ', medium.length, medium.length ? `(glyphs ${glyphs(medium[0])}–${glyphs(medium[medium.length - 1])})` : '')
console.log('  hard   ', hard.length, hard.length ? `(glyphs ${glyphs(hard[0])}–${glyphs(hard[Math.max(0, hard.length - 1 - keptByNote.length)])}${keptByNote.length ? ` + ${keptByNote.length} note-kept` : ''})` : '')
console.log('  deleted', deleted)
console.log('  note-kept', keptByNote.length)
console.log('  tutorial', (data.tutorial || []).length, '(unchanged)')
