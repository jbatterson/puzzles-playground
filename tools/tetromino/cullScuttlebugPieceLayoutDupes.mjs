/**
 * Cull Scuttlebug puzzles that share a D4 piece layout (ignore player + hole).
 * Within each tier, keep the highest-dif member (tie: later index).
 *
 *   node tools/tetromino/cullScuttlebugPieceLayoutDupes.mjs
 *   node tools/tetromino/cullScuttlebugPieceLayoutDupes.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')
const dryRun = process.argv.includes('--dry-run')

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

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

function d4PiecesKey(raw) {
  const p = normalizePuzzleInput(raw, false)
  const size = p.size
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const pieceKeys = p.pieces
      .map((piece) => {
        const cells = piece.cells
          .map((c) => {
            const [r, c2] = mapCell(c.r, c.c, size, orient)
            return `${r},${c2}`
          })
          .sort()
          .join('|')
        return `${piece.type || '?'}:${cells}`
      })
      .sort()
    const key = JSON.stringify({ s: size, p: pieceKeys })
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
    (Number.isFinite(raw.dif) ? `, dif: ${raw.dif}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

const next = {}
let totalRemoved = 0

for (const tier of TIERS) {
  const list = data[tier] || []
  const byKey = new Map()
  for (const [i, raw] of list.entries()) {
    const key = d4PiecesKey(raw)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push({ i, raw, dif: raw.dif ?? -Infinity })
  }

  const drop = new Set()
  let clusters = 0
  for (const members of byKey.values()) {
    if (members.length < 2) continue
    clusters++
    members.sort((a, b) => b.dif - a.dif || b.i - a.i)
    for (let k = 1; k < members.length; k++) drop.add(members[k].i)
  }

  next[tier] = list.filter((_, i) => !drop.has(i))
  totalRemoved += drop.size
  console.log(
    `${tier}: clusters=${clusters} −${drop.size} → ${next[tier].length} (was ${list.length})`
  )
}

console.log(
  `Removed ${totalRemoved}. Ledger: tutorial ${next.tutorial.length}, easy ${next.easy.length}, medium ${next.medium.length}, hard ${next.hard.length}`
)

if (dryRun) {
  console.log('dry-run: no write')
  process.exit(0)
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
console.log('Wrote', abs)
